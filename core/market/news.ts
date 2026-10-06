import { getJson, getText, type FetchLike, type NewsItem, type SocialPost } from "./types";

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&(\w+);/g, (m, name: string) => ENTITIES[name] ?? m)
    .replace(/<[^>]+>/g, "")
    .trim();
}

const tag = (xml: string, name: string) => xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"))?.[1] ?? "";

// Minimal RSS 2.0 reader (Google News, Yahoo, Expansión...). No XML library on the server needed.
export function parseRss(xml: string, fallbackSource = ""): NewsItem[] {
  const items = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];
  return items.map((item) => {
    const source = decodeEntities(tag(item, "source")) || fallbackSource;
    let title = decodeEntities(tag(item, "title"));
    // Google News appends " - Source" to every title.
    if (source && title.endsWith(` - ${source}`)) title = title.slice(0, -(source.length + 3));
    const date = tag(item, "pubDate");
    return { title, url: decodeEntities(tag(item, "link")), source, publishedAt: date ? new Date(date).toISOString() : "" };
  }).filter((n) => n.title && n.url);
}

export async function googleNews(f: FetchLike, query: string, lang: "es" | "en" = "es"): Promise<NewsItem[]> {
  const params = lang === "es" ? "hl=es&gl=ES&ceid=ES:es" : "hl=en-US&gl=US&ceid=US:en";
  const xml = await getText(f, `https://news.google.com/rss/search?q=${encodeURIComponent(`${query} when:30d`)}&${params}`, { "User-Agent": "Mozilla/5.0 FireNances" });
  return parseRss(xml, "Google News");
}

type BskyResponse = { posts?: { uri: string; author?: { handle?: string; displayName?: string }; record?: { text?: string; createdAt?: string }; likeCount?: number; indexedAt?: string }[] };

export function parseBluesky(json: BskyResponse): SocialPost[] {
  return (json.posts ?? []).map((p) => {
    const handle = p.author?.handle ?? "";
    const rkey = p.uri.split("/").pop() ?? "";
    return {
      author: p.author?.displayName || handle,
      handle,
      text: p.record?.text ?? "",
      url: handle && rkey ? `https://bsky.app/profile/${handle}/post/${rkey}` : "",
      publishedAt: p.record?.createdAt ?? p.indexedAt ?? "",
      likes: p.likeCount ?? 0,
      network: "bluesky",
    };
  }).filter((p) => p.text);
}

// Public Bluesky search (X/Twitter has no free API). Cashtags ($AAPL) are what traders use.
export async function blueskySearch(f: FetchLike, query: string, sort: "latest" | "top" = "top"): Promise<SocialPost[]> {
  const json = (await getJson(f, `https://api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=${encodeURIComponent(query)}&limit=25&sort=${sort}`)) as BskyResponse;
  return parseBluesky(json);
}

export async function fxRates(f: FetchLike, base: string): Promise<{ base: string; date: string; rates: Record<string, number> }> {
  const json = (await getJson(f, `https://api.frankfurter.dev/v1/latest?base=${encodeURIComponent(base)}`)) as { base: string; date: string; rates: Record<string, number> };
  return { base: json.base, date: json.date, rates: json.rates ?? {} };
}
