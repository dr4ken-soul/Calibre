/**
 * Groq AI provider.
 *
 * Optional. Only enabled when AI_API_KEY is present. The provider returns an
 * untrusted JSON response that the audit engine validates with a Zod schema
 * and bounds to a small adjustment window. No network, no exceptions escaping:
 * the engine falls back to the deterministic baseline on any failure.
 */

import type { AiProvider } from "./audit-engine.js";

export interface GroqProviderConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

const SYSTEM_PROMPT = [
  "You are a probability calibration assistant for a market audit tool.",
  "You receive market evidence: order book prices, imbalance, momentum, time to expiry.",
  "Estimate the probability that the market resolves UP, from 0 to 1.",
  "Respond ONLY with compact JSON: {\"adjustedProbability\": number, \"reasoning\": string}.",
  "The reasoning must be one sentence and must not promise outcomes.",
].join(" ");

export class GroqProvider implements AiProvider {
  readonly providerLabel = "groq";
  readonly modelLabel: string;
  private readonly config: Required<Omit<GroqProviderConfig, "model">> & { model: string };

  constructor(config: GroqProviderConfig) {
    this.config = {
      apiKey: config.apiKey,
      model: config.model,
      baseUrl: config.baseUrl ?? "https://api.groq.com/openai/v1",
      fetchImpl: config.fetchImpl ?? fetch,
      timeoutMs: config.timeoutMs ?? 10_000,
    };
    this.modelLabel = config.model;
  }

  async adjust(input: {
    marketProbabilityBp: bigint;
    baselineProbabilityBp: bigint;
    evidence: { id: string; value: string }[];
    context: {
      asset: string;
      secondsToExpiry: number;
      spreadBp: bigint;
      momentumBp: bigint;
    };
  }): Promise<unknown> {
    const userContent = JSON.stringify({
      marketProbability: Number(input.marketProbabilityBp) / 10_000,
      deterministicBaseline: Number(input.baselineProbabilityBp) / 10_000,
      asset: input.context.asset,
      secondsToExpiry: input.context.secondsToExpiry,
      spreadBp: Number(input.context.spreadBp),
      momentumBp: Number(input.context.momentumBp),
      evidence: input.evidence,
      instruction:
        "You may adjust the baseline probability by at most 0.08. Return JSON only.",
    });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await this.config.fetchImpl(
        `${this.config.baseUrl}/chat/completions`,
        {
          method: "POST",
          signal: controller.signal,
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${this.config.apiKey}`,
          },
          body: JSON.stringify({
            model: this.config.model,
            temperature: 0.2,
            max_tokens: 300,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: userContent },
            ],
          }),
        },
      );
      if (!response.ok) {
        throw new Error(`groq http ${response.status}`);
      }
      const data = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error("groq empty response");
      return JSON.parse(content);
    } finally {
      clearTimeout(timer);
    }
  }
}
