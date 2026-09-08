// Live smoke of the exact GraphQL operations the GraphqlAdapter issues.
// Mirrors packages/dreamdex-adapter/src/graphql.ts queries 1:1.

const GQL = "https://dev.smk.somnia.host/v1/graphql";

const MARKET_FIELDS = `
  id marketId question asset strike intervalSec tradingStart expiry clobStatus
  lastPrice markPrice openInterest cumulativeQuoteVolume tradeCount collateral
  binaryPoolAddress yesTokenId noTokenId finalized voided winningOutcome
  resolvedAtTimestamp createdAtTimestamp
`;

const ORDER_FIELDS = "orderId side isBid price quantityRemaining status rested";

async function gql(document, variables) {
  const r = await fetch(GQL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: document, variables }),
    signal: AbortSignal.timeout(15000),
  });
  const j = await r.json();
  if (j.errors) throw new Error(JSON.stringify(j.errors).slice(0, 300));
  return j.data;
}

function priceToBp(v) {
  return v ? BigInt(v) / 100n : 0n;
}
function rawToDecimalString(v) {
  if (!v) return "0";
  const n = BigInt(v);
  const whole = n / 1000000n;
  const frac = n % 1000000n;
  if (frac === 0n) return whole.toString();
  return `${whole}.${frac.toString().padStart(6, "0").replace(/0+$/, "")}`;
}

console.log("=== listMarkets (limit 5, trading) ===");
const listData = await gql(
  `query ($where: Market_bool_exp, $limit: Int, $offset: Int) {
    Market(where: $where, order_by: { expiry: asc }, limit: $limit, offset: $offset) { ${MARKET_FIELDS} }
  }`,
  { where: { marketType: { _eq: "BINARY" }, clobStatus: { _eq: "Trading" } }, limit: 5, offset: 0 },
);
const rows = listData.Market ?? [];
for (const row of rows) {
  console.log(
    `${row.asset} "${row.question.slice(0, 48)}" status=trading p=${priceToBp(row.lastPrice)}bp vol=${rawToDecimalString(row.cumulativeQuoteVolume)} pool=${row.binaryPoolAddress} expiry=${new Date(Number(row.expiry) * 1000).toISOString()}`,
  );
}

if (rows.length > 0) {
  const row = rows[0];

  console.log("\n=== order book (mirror of fetchOrderBook) ===");
  const bookData = await gql(
    `query ($where: Order_bool_exp, $limit: Int) {
      Order(where: $where, order_by: { price: desc }, limit: $limit) { ${ORDER_FIELDS} }
    }`,
    { where: { market_id: { _eq: row.id }, status: { _eq: "Open" }, rested: { _eq: true } }, limit: 60 },
  );
  const bids = [];
  const asks = [];
  for (const o of bookData.Order ?? []) {
    if (o.status !== "Open" || !o.rested) continue;
    const lvl = { priceBp: priceToBp(o.price), size: BigInt(o.quantityRemaining) };
    if (o.isBid) bids.push(lvl);
    else asks.push(lvl);
  }
  console.log(`bids=${bids.length} asks=${asks.length}`);
  if (bids.length > 0) console.log("top bid:", bids[0].priceBp.toString(), "bp size", bids[0].size.toString());
  if (asks.length > 0) console.log("top ask:", asks[0].priceBp.toString(), "bp size", asks[0].size.toString());

  console.log("\n=== getExecutionInfo fields ===");
  console.log(JSON.stringify({
    poolAddress: row.binaryPoolAddress,
    collateral: row.collateral,
    yesTokenId: row.yesTokenId,
    noTokenId: row.noTokenId,
    expirySec: row.expiry,
    rowId: row.id,
  }, null, 1));

  console.log("\n=== getSettlement on resolved market (mirror) ===");
  const resolvedData = await gql(
    `query ($where: Market_bool_exp, $limit: Int) {
      Market(where: $where, order_by: { expiry: desc }, limit: $limit) {
        marketId clobStatus finalized voided winningOutcome resolvedAtTimestamp strike closingMid lastPrice
      }
    }`,
    { where: { marketType: { _eq: "BINARY" }, finalized: { _eq: true } }, limit: 3 },
  );
  for (const r of resolvedData.Market ?? []) {
    const outcome = r.winningOutcome === 0 ? "up" : r.winningOutcome === 1 ? "down" : null;
    console.log(`${r.marketId.slice(0, 20)}.. status=${r.voided ? "voided" : "resolved"} outcome=${outcome} resolvedAt=${r.resolvedAtTimestamp} closing=${r.closingMid ?? r.lastPrice}`);
  }
}

process.exit(0);
