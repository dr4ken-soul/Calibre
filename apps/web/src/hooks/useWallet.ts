/**
 * EIP-1193 wallet connection for Somnia testnet.
 *
 * No private key custody: the wallet stays in the user's extension. Calibre
 * only requests accounts, chain switching, and explicit transaction approval.
 * Nothing is ever auto-signed.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { CHAIN_ID, CHAIN_ID_HEX, RPC_URL } from "../config.js";

export type WalletState =
  | { phase: "disconnected" }
  | { phase: "connecting" }
  | { phase: "connected"; address: string; chainId: number }
  | { phase: "error"; message: string };

export interface EthereumProvider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(event: string, handler: (...args: unknown[]) => void): void;
  removeListener?(event: string, handler: (...args: unknown[]) => void): void;
  isMetaMask?: boolean;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

const SOMNIA_PARAMS = [
  {
    chainId: CHAIN_ID_HEX,
    chainName: "Somnia Testnet",
    nativeCurrency: { name: "STT", symbol: "STT", decimals: 18 },
    rpcUrls: [RPC_URL],
    blockExplorerUrls: ["https://shannon-explorer.somnia.network"],
  },
];

function getProvider(): EthereumProvider | null {
  return typeof window !== "undefined" ? (window.ethereum ?? null) : null;
}

export function useWallet() {
  const [state, setState] = useState<WalletState>({ phase: "disconnected" });
  const [chainSwitching, setChainSwitching] = useState(false);

  const accountsChanged = useCallback((accounts: unknown) => {
    const list = Array.isArray(accounts) ? (accounts as string[]) : [];
    if (list.length === 0) {
      setState({ phase: "disconnected" });
    } else {
      setState((prev) =>
        prev.phase === "connected" ? { ...prev, address: list[0]! } : prev,
      );
    }
  }, []);

  const chainChanged = useCallback((_chainId: unknown) => {
    void checkChain();
  }, []);

  const checkChain = useCallback(async () => {
    const provider = getProvider();
    if (!provider) return;
    try {
      const hex = (await provider.request({ method: "eth_chainId" })) as string;
      const numeric = parseInt(hex, 16);
      setState((prev) => (prev.phase === "connected" ? { ...prev, chainId: numeric } : prev));
    } catch {
      // Chain check failure is non fatal.
    }
  }, []);

  useEffect(() => {
    const provider = getProvider();
    if (!provider) return;
    provider.on?.("accountsChanged", accountsChanged);
    provider.on?.("chainChanged", chainChanged);
    return () => {
      provider.removeListener?.("accountsChanged", accountsChanged);
      provider.removeListener?.("chainChanged", chainChanged);
    };
  }, [accountsChanged, chainChanged]);

  const connect = useCallback(async () => {
    const provider = getProvider();
    if (!provider) {
      setState({ phase: "error", message: "No EVM wallet detected. Install a wallet extension first." });
      return;
    }
    setState({ phase: "connecting" });
    try {
      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
      const hex = (await provider.request({ method: "eth_chainId" })) as string;
      const chainId = parseInt(hex, 16);
      setState({ phase: "connected", address: accounts[0] ?? "", chainId });
    } catch (error) {
      const rejected = (error as { code?: number }).code === 4001;
      const message = rejected
          ? "Connection request rejected in the wallet."
          : "Wallet connection failed.";
      setState({ phase: "error", message });
    }
  }, []);

  const ensureChain = useCallback(async (): Promise<boolean> => {
    const provider = getProvider();
    if (!provider) return false;
    setChainSwitching(true);
    try {
      const hex = (await provider.request({ method: "eth_chainId" })) as string;
      if (parseInt(hex, 16) === CHAIN_ID) return true;
      try {
        await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN_ID_HEX }] });
      } catch (switchError) {
        const code = (switchError as { code?: number }).code;
        if (code === 4902) {
          await provider.request({ method: "wallet_addEthereumChain", params: SOMNIA_PARAMS });
        } else {
          throw switchError;
        }
      }
      await checkChain();
      return true;
    } catch (error) {
      const message =
        error instanceof Error && "code" in error && (error as { code: number }).code === 4001
          ? "Chain switch rejected in the wallet."
          : "Could not switch to Somnia testnet.";
      setState((prev) => (prev.phase === "connected" ? prev : { phase: "error", message }));
      return false;
    } finally {
      setChainSwitching(false);
    }
  }, [checkChain]);

  /**
   * Sends a transaction after explicit user approval in the wallet. Returns
   * the tx hash, or null when the user rejected. Never resolves to a fake hash.
   */
  const sendTransaction = useCallback(
    async (tx: { to: string; value: string; data: string }): Promise<string | null> => {
      const provider = getProvider();
      if (!provider || state.phase !== "connected") return null;
      const valueHex = `0x${BigInt(Math.round(Number(tx.value) * 1e18)).toString(16)}`;
      try {
        const hash = (await provider.request({
          method: "eth_sendTransaction",
          params: [
            {
              from: state.address,
              to: tx.to,
              value: valueHex,
              data: tx.data,
            },
          ],
        })) as string;
        return hash;
      } catch (error) {
        const rejected = (error as { code?: number }).code === 4001;
        if (!rejected) {
          console.error("Transaction failed", error);
        }
        return null;
      }
    },
    [state],
  );

  const wrongChain = state.phase === "connected" && state.chainId !== CHAIN_ID;

  return useMemo(
    () => ({ state, connect, ensureChain, sendTransaction, wrongChain, chainSwitching }),
    [state, connect, ensureChain, sendTransaction, wrongChain, chainSwitching],
  );
}
