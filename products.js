// Product search and deals — Amazon (via RapidAPI) + Flipkart (via Affiliate API)
//
// Required env vars (set whichever platforms you use):
//   RAPIDAPI_KEY              — RapidAPI key (used for Amazon Real-Time Amazon Data API)
//   FLIPKART_AFFILIATE_ID     — Flipkart affiliate tracking ID
//   FLIPKART_AFFILIATE_TOKEN  — Flipkart affiliate API token

import fetch from "node-fetch";

const RAPIDAPI_KEY          = process.env.RAPIDAPI_KEY || "";
const FLIPKART_AFFILIATE_ID = process.env.FLIPKART_AFFILIATE_ID || "";
const FLIPKART_TOKEN        = process.env.FLIPKART_AFFILIATE_TOKEN || "";

// ── Amazon ────────────────────────────────────────────────────────────────────

/**
 * Search Amazon products via RapidAPI "Real-Time Amazon Data" endpoint.
 * Returns a short voice-friendly summary of the top 3 results.
 */
export async function searchAmazon(query, { country = "IN", maxResults = 3 } = {}) {
  if (!RAPIDAPI_KEY) return "Amazon search is not configured. Please set the RAPIDAPI_KEY environment variable.";
  try {
    const url = `https://real-time-amazon-data.p.rapidapi.com/search?query=${encodeURIComponent(query)}&page=1&country=${country}&sort_by=RELEVANCE&product_condition=ALL`;
    const res = await fetch(url, {
      headers: {
        "X-RapidAPI-Key": RAPIDAPI_KEY,
        "X-RapidAPI-Host": "real-time-amazon-data.p.rapidapi.com",
      },
    });
    if (!res.ok) return `Amazon search unavailable (HTTP ${res.status}).`;
    const data = await res.json();
    const products = data?.data?.products?.slice(0, maxResults) || [];
    if (!products.length) return `No Amazon results found for "${query}".`;
    const lines = products.map((p, i) => {
      const price  = p.product_price || p.product_original_price || "price unavailable";
      const rating = p.product_star_rating ? ` ★${p.product_star_rating}` : "";
      const deal   = p.product_original_price && p.product_price && p.product_price !== p.product_original_price
        ? ` (was ${p.product_original_price})`
        : "";
      return `${i + 1}. ${p.product_title?.slice(0, 80)} — ${price}${deal}${rating}`;
    });
    return `Amazon results for "${query}": ${lines.join(". ")}`;
  } catch {
    return "Amazon search unavailable.";
  }
}

/**
 * Get Amazon deals / discounts for a category.
 * Uses the "best-sellers" endpoint which surfaces discounted popular products.
 */
export async function getAmazonDeals(category = "", { country = "IN" } = {}) {
  if (!RAPIDAPI_KEY) return "Amazon deals are not configured. Please set the RAPIDAPI_KEY environment variable.";
  try {
    const cat = category ? encodeURIComponent(category) : "deals-and-promotions";
    const url = `https://real-time-amazon-data.p.rapidapi.com/best-sellers?category=${cat}&type=BEST_SELLERS&page=1&country=${country}`;
    const res = await fetch(url, {
      headers: {
        "X-RapidAPI-Key": RAPIDAPI_KEY,
        "X-RapidAPI-Host": "real-time-amazon-data.p.rapidapi.com",
      },
    });
    if (!res.ok) return `Amazon deals unavailable (HTTP ${res.status}).`;
    const data = await res.json();
    const products = data?.data?.best_sellers?.slice(0, 3) || [];
    if (!products.length) return `No Amazon deals found${category ? ` for "${category}"` : ""}.`;
    const lines = products.map((p, i) => {
      const price  = p.product_price || "price unavailable";
      const rating = p.product_star_rating ? ` ★${p.product_star_rating}` : "";
      return `${i + 1}. ${p.product_title?.slice(0, 80)} — ${price}${rating}`;
    });
    return `Top Amazon deals${category ? ` in ${category}` : ""}: ${lines.join(". ")}`;
  } catch {
    return "Amazon deals unavailable.";
  }
}

// ── Flipkart ──────────────────────────────────────────────────────────────────

/**
 * Search Flipkart products via the Affiliate API.
 * Requires FLIPKART_AFFILIATE_ID and FLIPKART_AFFILIATE_TOKEN.
 */
export async function searchFlipkart(query, { maxResults = 3 } = {}) {
  if (!FLIPKART_AFFILIATE_ID || !FLIPKART_TOKEN) {
    return "Flipkart search is not configured. Please set FLIPKART_AFFILIATE_ID and FLIPKART_AFFILIATE_TOKEN.";
  }
  try {
    const url = `https://affiliate-api.flipkart.net/affiliate/search/json?query=${encodeURIComponent(query)}&resultCount=${maxResults}`;
    const res = await fetch(url, {
      headers: {
        "Fk-Affiliate-Id": FLIPKART_AFFILIATE_ID,
        "Fk-Affiliate-Token": FLIPKART_TOKEN,
      },
    });
    if (!res.ok) return `Flipkart search unavailable (HTTP ${res.status}).`;
    const data = await res.json();
    const products = data?.productInfoList?.slice(0, maxResults) || [];
    if (!products.length) return `No Flipkart results found for "${query}".`;
    const lines = products.map((item, i) => {
      const p       = item.productBaseInfo?.productAttributes;
      const pricing = item.productBaseInfo?.productPaymentInfo;
      const title   = p?.title?.slice(0, 80) || "Product";
      const price   = pricing?.flipkartSpecialPrice
        ? `₹${pricing.flipkartSpecialPrice}`
        : pricing?.mrp ? `₹${pricing.mrp}` : "price unavailable";
      const mrp     = pricing?.mrp && pricing?.flipkartSpecialPrice && pricing.mrp !== pricing.flipkartSpecialPrice
        ? ` (MRP ₹${pricing.mrp})`
        : "";
      const rating  = p?.productRating ? ` ★${p.productRating}` : "";
      return `${i + 1}. ${title} — ${price}${mrp}${rating}`;
    });
    return `Flipkart results for "${query}": ${lines.join(". ")}`;
  } catch {
    return "Flipkart search unavailable.";
  }
}

/**
 * Get Flipkart top offers / deals via the Affiliate API listing endpoint.
 */
export async function getFlipkartDeals(category = "", { maxResults = 3 } = {}) {
  if (!FLIPKART_AFFILIATE_ID || !FLIPKART_TOKEN) {
    return "Flipkart deals are not configured. Please set FLIPKART_AFFILIATE_ID and FLIPKART_AFFILIATE_TOKEN.";
  }
  try {
    // Use the listing API; if no category, default to a broad electronics search
    const query = category || "deals offer discount";
    const url = `https://affiliate-api.flipkart.net/affiliate/search/json?query=${encodeURIComponent(query)}&resultCount=${maxResults}&sort=popularity`;
    const res = await fetch(url, {
      headers: {
        "Fk-Affiliate-Id": FLIPKART_AFFILIATE_ID,
        "Fk-Affiliate-Token": FLIPKART_TOKEN,
      },
    });
    if (!res.ok) return `Flipkart deals unavailable (HTTP ${res.status}).`;
    const data = await res.json();
    const products = data?.productInfoList?.slice(0, maxResults) || [];
    if (!products.length) return `No Flipkart deals found${category ? ` for "${category}"` : ""}.`;
    const lines = products.map((item, i) => {
      const p       = item.productBaseInfo?.productAttributes;
      const pricing = item.productBaseInfo?.productPaymentInfo;
      const title   = p?.title?.slice(0, 80) || "Product";
      const price   = pricing?.flipkartSpecialPrice
        ? `₹${pricing.flipkartSpecialPrice}`
        : pricing?.mrp ? `₹${pricing.mrp}` : "price unavailable";
      const discount = pricing?.discount ? ` (${pricing.discount}% off)` : "";
      return `${i + 1}. ${title} — ${price}${discount}`;
    });
    return `Flipkart deals${category ? ` in ${category}` : ""}: ${lines.join(". ")}`;
  } catch {
    return "Flipkart deals unavailable.";
  }
}

// ── Combined helpers ──────────────────────────────────────────────────────────

/**
 * Search both platforms and combine results.
 * param format: "PLATFORM::QUERY"  e.g. "amazon::iPhone 15" / "flipkart::earphones" / "both::laptop"
 */
export async function searchProducts(param = "") {
  const sep = param.indexOf("::");
  let platform = "both";
  let query = param;
  if (sep !== -1) {
    platform = param.slice(0, sep).trim().toLowerCase();
    query    = param.slice(sep + 2).trim();
  }
  if (!query) return "Please specify a product to search for.";

  if (platform === "amazon") return await searchAmazon(query);
  if (platform === "flipkart") return await searchFlipkart(query);

  // both — run in parallel, combine
  const [amz, fk] = await Promise.all([searchAmazon(query), searchFlipkart(query)]);
  const parts = [];
  if (!amz.includes("unavailable") && !amz.includes("not configured")) parts.push(`Amazon — ${amz}`);
  if (!fk.includes("unavailable") && !fk.includes("not configured")) parts.push(`Flipkart — ${fk}`);
  if (!parts.length) return `Product search unavailable for "${query}".`;
  return parts.join(" | ");
}

/**
 * Get deals from either/both platforms.
 * param format: "PLATFORM::CATEGORY"  e.g. "amazon::electronics" / "flipkart::mobile" / "deals"
 */
export async function getDeals(param = "") {
  const sep = param.indexOf("::");
  let platform = "both";
  let category = "";
  if (sep !== -1) {
    platform = param.slice(0, sep).trim().toLowerCase();
    category = param.slice(sep + 2).trim();
  } else {
    category = param.trim();
  }

  if (platform === "amazon") return await getAmazonDeals(category);
  if (platform === "flipkart") return await getFlipkartDeals(category);

  const [amz, fk] = await Promise.all([getAmazonDeals(category), getFlipkartDeals(category)]);
  const parts = [];
  if (!amz.includes("unavailable") && !amz.includes("not configured")) parts.push(`Amazon — ${amz}`);
  if (!fk.includes("unavailable") && !fk.includes("not configured")) parts.push(`Flipkart — ${fk}`);
  if (!parts.length) return "Deals unavailable right now.";
  return parts.join(" | ");
}
