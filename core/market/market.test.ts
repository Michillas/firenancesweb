import { describe, expect, it } from "vitest";
import { parseNasdaqHistory } from "./nasdaq";
import { decodeEntities, parseBluesky, parseRss } from "./news";
import { num, usDate } from "./types";
import { parseYahooChart } from "./yahoo";
import { createMarket, type FetchLike } from "./service";

describe("market parsers", () => {
  it("reads Nasdaq number and date formats", () => {
    expect(num("$1,332.9586")).toBeCloseTo(1332.9586);
    expect(num("-0.02%")).toBe(-0.02);
    expect(usDate("is estimated to report earnings on  10/29/2026.")).toBe("2026-10-29");
    expect(parseNasdaqHistory([{ date: "10/02/2026", close: "$333.69" }, { date: "10/01/2026", close: "$330.32" }])).toEqual([["2026-10-01", 330.32], ["2026-10-02", 333.69]]);
  });
  it("reads a Yahoo chart", () => {
    const r = parseYahooChart({ chart: { result: [{ meta: { symbol: "VWCE.DE", currency: "EUR", regularMarketPrice: 140, longName: "Vanguard FTSE All-World" }, timestamp: [1790000000, 1790086400], indicators: { quote: [{ close: [138, 140] }] }, events: { dividends: { a: { amount: 0.5, date: 1780000000 } } } }] } });
    expect(r.quote).toMatchObject({ symbol: "VWCE.DE", currency: "EUR", price: 140, change: 2 });
    expect(r.history).toHaveLength(2);
    expect(r.events[0]).toMatchObject({ kind: "dividend_payment", amount: 0.5 });
  });
  it("parses Google News RSS", () => {
    const xml = `<rss><channel><item><title>Apple sube un 3% - Expansión</title><link>https://news.google.com/x</link><pubDate>Mon, 05 Oct 2026 10:00:00 GMT</pubDate><source url="https://expansion.com">Expansión</source></item></channel></rss>`;
    expect(parseRss(xml)).toEqual([{ title: "Apple sube un 3%", url: "https://news.google.com/x", source: "Expansión", publishedAt: "2026-10-05T10:00:00.000Z" }]);
    expect(decodeEntities("S&amp;P 500 &#8211; récord")).toBe("S&P 500 – récord");
  });
  it("maps Bluesky posts to links", () => {
    const posts = parseBluesky({ posts: [{ uri: "at://did:plc:x/app.bsky.feed.post/abc", author: { handle: "trader.bsky.social", displayName: "Trader" }, record: { text: "$AAPL to the moon", createdAt: "2026-10-05T00:00:00Z" }, likeCount: 3 }] });
    expect(posts[0]).toMatchObject({ author: "Trader", url: "https://bsky.app/profile/trader.bsky.social/post/abc", likes: 3 });
  });
});

describe("market service fallbacks", () => {
  const respond = (status: number, body: unknown): Awaited<ReturnType<FetchLike>> => ({ ok: status < 400, status, text: async () => JSON.stringify(body), json: async () => body, headers: { get: () => null } });
  it("falls back from Yahoo to Nasdaq for US tickers", async () => {
    const calls: string[] = [];
    const f: FetchLike = async (url) => {
      calls.push(new URL(url).host);
      if (url.includes("yahoo")) return respond(429, "Too Many Requests");
      return respond(200, { data: { symbol: "VOO", companyName: "Vanguard S&P 500 ETF", primaryData: { lastSalePrice: "$712.43", netChange: "+1.00", percentageChange: "+0.14%" } } });
    };
    const q = await createMarket(f).quote("yahoo", "VOO");
    expect(q).toMatchObject({ source: "nasdaq", price: 712.43, change: 1 });
    expect(calls).toContain("api.nasdaq.com");
  });
});

describe("European fund sources", () => {
  it("parses an FT fund tearsheet", async () => {
    const { parseFtTearsheet } = await import("./europe");
    const html = `<h1 class="mod-tearsheet-overview__header__name mod-tearsheet-overview__header__name--large">Vanguard Global Stock Index Fund EUR Acc</h1><span class="mod-ui-data-list__label">Price (EUR)</span><span class="mod-ui-data-list__value">1,063.81</span></li><li><span class="mod-ui-data-list__label">Today's Change</span><span class="mod-ui-data-list__value"><span class="mod-format--neg"><i class="o-ft-icons-icon"></i>0.347 / 0.55%</span></span><div class="mod-disclaimer">Data delayed at least 15 minutes, as of Oct 02 2026.</div>`;
    expect(parseFtTearsheet(html)).toMatchObject({ name: "Vanguard Global Stock Index Fund EUR Acc", price: 1063.81, currency: "EUR", change: -0.347, changePct: -0.55, asOf: "2026-10-02T18:00:00.000Z" });
  });
});

describe("FT global equities", () => {
  it("parses search, chart, timestamps and Yahoo fallbacks", async () => {
    const { parseFtChart, parseFtTearsheet, yahooToFt, ftSearch } = await import("./europe");
    expect(yahooToFt("6702.T")).toBe("6702:TYO");
    expect(yahooToFt("VSURE.ST")).toBe("VSURE:STO");
    expect(yahooToFt("AAPL")).toBeNull();
    expect(parseFtChart({ Dates: ["2026-10-05T00:00:00", "2026-10-06T00:00:00"], Elements: [{ ComponentSeries: [{ Type: "Close", Values: [4063, 4053] }] }] })).toEqual([["2026-10-05", 4063], ["2026-10-06", 4053]]);
    const html = `<span class="mod-ui-data-list__label">Price (JPY)</span><span class="mod-ui-data-list__value">4,053.00</span><span class="mod-ui-data-list__label">Today's Change</span><span class="mod-ui-data-list__value"><span class="mod-format--neg"><i class="x"></i>-10.00 / -0.25%</span></span> Data delayed at least 20 minutes, as of Oct 06 2026 07:30 BST.`;
    expect(parseFtTearsheet(html)).toMatchObject({ price: 4053, currency: "JPY", change: -10, changePct: -0.25, asOf: "2026-10-06T06:30:00.000Z" });
    const f = (async () => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => ({}), text: async () => JSON.stringify({ data: { security: [{ name: "Fujitsu Limited", symbol: "FJTSY:PKL", isPrimary: false, assetClass: "Equities" }, { name: "Fujitsu Limited", symbol: "6702:TYO", isPrimary: true, assetClass: "Equities" }, { name: "Index", symbol: "X:IDX", assetClass: "Indices" }] } }) })) as unknown as Parameters<typeof ftSearch>[0];
    const results = await ftSearch(f, "fujitsu");
    expect(results.map((r) => r.id)).toEqual(["6702:TYO", "FJTSY:PKL"]);
    expect(results[0]).toMatchObject({ source: "ftstock", exchange: "TYO", assetType: "stock" });
  });
});
