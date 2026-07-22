// Product search and deals — Amazon India + Flipkart
// Uses DuckDuckGo HTML search (no API key, no registration required).
// Searches DuckDuckGo with site:amazon.in or site:flipkart.com to surface
// relevant product listings with prices from both platforms.

import fetch from "node-fetch";

const DDG_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-IN,en;q=0.9",
  "Referer": "https://duckduckgo.com/",
};

/**
 * Search DuckDuckGo HTML and extract result snippets.
 * Returns up to maxResults { title, snippet, url } objects.
 */
async function ddgSearch(query, { maxResults = 3 } = {}) {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=in-en`;
  const html = await fetch(url, { headers: DDG_HEADERS }).then(r => r.text());

  const results = [];
  // DuckDuckGo wraps each result in <div class="result__body"> / <a class="result__a"> / <a class="result__snippet">
  const blockRx = /class="result__body">([\s\S]*?)(?=class="result__body"|<\/div>\s*<\/div>\s*<\/div>)/g;
  let bm;
  while ((bm = blockRx.exec(html)) !== null && results.length < maxResults) {
    const block = bm[1];
    const titleM   = block.match(/class="result__a"[^>]*>([^<]{5,120})<\/a>/);
    const snippetM = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);
    const urlM     = block.match(/class="result__url"[^>]*>([^<]+)<\/a>/);
    if (titleM) {
      const snippet = snippetM ? snippetM[1].replace(/<[^>]+>/g, "").trim() : "";
      results.push({
        title: titleM[1].replace(/<[^>]+>/g, "").trim(),
        snippet,
        url: urlM ? urlM[1].trim() : "",
      });
    }
  }
  return results;
}

/** Extract a price string from a snippet/title, e.g. "₹14,999" or "Rs. 14999" */
function extractPrice(text) {
  const m = text.match(/(?:₹|Rs\.?\s*)[\d,]+(?:\.\d+)?/i);
  return m ? m[0].replace(/\s/g, "") : "";
}

// ── Amazon India ──────────────────────────────────────────────────────────────

export async function searchAmazon(query, { maxResults = 3 } = {}) {
  try {
    const results = await ddgSearch(`${query} site:amazon.in`, { maxResults });
    if (!results.length) return `No Amazon results found for "${query}".`;

    const lines = results.map((r, i) => {
      const price = extractPrice(r.snippet) || extractPrice(r.title) || "";
      const title = r.title.replace(/Amazon\.in\s*:?\s*/i, "").slice(0, 80);
      return `${i + 1}. ${title}${price ? ` — ${price}` : ""}`;
    });
    return `Amazon results for "${query}": ${lines.join(". ")}`;
  } catch {
    return "Amazon search unavailable.";
  }
}

export async function getAmazonDeals({ maxResults = 3 } = {}) {
  try {
    const results = await ddgSearch("best deals discount offers today site:amazon.in", { maxResults });
    if (!results.length) return "Amazon deals unavailable right now.";

    const lines = results.map((r, i) => {
      const price = extractPrice(r.snippet) || extractPrice(r.title) || "";
      const title = r.title.replace(/Amazon\.in\s*:?\s*/i, "").slice(0, 80);
      return `${i + 1}. ${title}${price ? ` — ${price}` : ""}`;
    });
    return `Top Amazon deals: ${lines.join(". ")}`;
  } catch {
    return "Amazon deals unavailable.";
  }
}

// ── Flipkart ──────────────────────────────────────────────────────────────────

export async function searchFlipkart(query, { maxResults = 3 } = {}) {
  try {
    const results = await ddgSearch(`${query} site:flipkart.com`, { maxResults });
    if (!results.length) return `No Flipkart results found for "${query}".`;

    const lines = results.map((r, i) => {
      const price = extractPrice(r.snippet) || extractPrice(r.title) || "";
      const title = r.title.replace(/Flipkart\.com\s*:?\s*/i, "").slice(0, 80);
      return `${i + 1}. ${title}${price ? ` — ${price}` : ""}`;
    });
    return `Flipkart results for "${query}": ${lines.join(". ")}`;
  } catch {
    return "Flipkart search unavailable.";
  }
}

export async function getFlipkartDeals({ maxResults = 3 } = {}) {
  try {
    const results = await ddgSearch("best deals sale discount offers today site:flipkart.com", { maxResults });
    if (!results.length) return "Flipkart deals unavailable right now.";

    const lines = results.map((r, i) => {
      const price = extractPrice(r.snippet) || extractPrice(r.title) || "";
      const title = r.title.replace(/Flipkart\.com\s*:?\s*/i, "").slice(0, 80);
      return `${i + 1}. ${title}${price ? ` — ${price}` : ""}`;
    });
    return `Top Flipkart deals: ${lines.join(". ")}`;
  } catch {
    return "Flipkart deals unavailable.";
  }
}

// ── Combined helpers ──────────────────────────────────────────────────────────

export async function searchProducts(param = "") {
  const sep = param.indexOf("::");
  let platform = "both";
  let query = param;
  if (sep !== -1) {
    platform = param.slice(0, sep).trim().toLowerCase();
    query    = param.slice(sep + 2).trim();
  }
  if (!query) return "Please specify a product to search for.";

  if (platform === "amazon")   return await searchAmazon(query);
  if (platform === "flipkart") return await searchFlipkart(query);

  const [amz, fk] = await Promise.all([searchAmazon(query), searchFlipkart(query)]);
  const parts = [];
  if (!amz.includes("unavailable") && !amz.includes("No Amazon")) parts.push(amz);
  if (!fk.includes("unavailable") && !fk.includes("No Flipkart")) parts.push(fk);
  if (!parts.length) return `Product search for "${query}" is unavailable right now.`;
  return parts.join(" | ");
}

export async function getDeals(param = "") {
  const sep = param.indexOf("::");
  let platform = "both";
  if (sep !== -1) platform = param.slice(0, sep).trim().toLowerCase();

  if (platform === "amazon")   return await getAmazonDeals();
  if (platform === "flipkart") return await getFlipkartDeals();

  const [amz, fk] = await Promise.all([getAmazonDeals(), getFlipkartDeals()]);
  const parts = [];
  if (!amz.includes("unavailable")) parts.push(amz);
  if (!fk.includes("unavailable"))  parts.push(fk);
  if (!parts.length) return "Deals unavailable right now.";
  return parts.join(" | ");
}
