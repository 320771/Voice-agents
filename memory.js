// Episodic memory — per-user, stores only the latest session summary string.
// Schema: {
//   users:     { "<name_key>": { summary: "...", updatedAt: "ISO" } },
//   crosssell: { "<name_key>": { pending: [offerId], presented: [{ offerId, at }] } }
// }

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MEMORY_FILE = path.join(__dirname, "episodic-memory.json");

// ── Storage helpers ───────────────────────────────────────────────────────────

function loadAll() {
  try {
    if (!fs.existsSync(MEMORY_FILE)) return { users: {} };
    const raw = JSON.parse(fs.readFileSync(MEMORY_FILE, "utf8"));
    return raw.users ? raw : { users: {} };
  } catch {
    return { users: {} };
  }
}

function saveAll(data) {
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(data, null, 2), "utf8");
}

// Normalise a name to a stable key: "Gourab Chanda" → "gourab_chanda"
export function nameKey(name) {
  return (name || "anonymous").trim().toLowerCase().replace(/\s+/g, "_");
}

// ── Public API ────────────────────────────────────────────────────────────────

/** List all known user keys (for the UI user-switcher) */
export function listUsers() {
  const data = loadAll();
  return Object.keys(data.users).filter(k => data.users[k]?.summary);
}

/** Return the stored summary string for a user, or null if none */
export function getUserSummary(name) {
  const data = loadAll();
  return data.users[nameKey(name)]?.summary || null;
}

/** Save (overwrite) the summary for a user */
export function saveSummary(name, summary) {
  const data = loadAll();
  const key = nameKey(name);
  data.users[key] = { summary, updatedAt: new Date().toISOString() };
  saveAll(data);
}

/** Build the memory context string injected into Claude's system prompt */
export function buildMemoryContext(name, summary) {
  if (!summary) {
    return name && name !== "anonymous"
      ? `\n\nYou are speaking with ${name}. This is their first session.`
      : "";
  }
  return `\n\nYou are speaking with ${name || "the user"}. Summary of their previous session: ${summary}`;
}

/** Build the greeting message sent to the user at session start */
export function buildGreeting(name, summary) {
  const firstName = (name || "").trim().split(" ")[0];
  if (!summary) {
    return firstName ? `Hello ${firstName}! Great to meet you. How can I help you today?` : null;
  }
  return `Welcome back${firstName ? ", " + firstName : ""}! ${summary}`;
}

// ── Cross-sell helpers ────────────────────────────────────────────────────────

function getCrossSellMap(data, key) {
  if (!data.crosssell) data.crosssell = {};
  if (!data.crosssell[key]) data.crosssell[key] = { pending: [], presented: [] };
  return data.crosssell[key];
}

export function queueCrossSellOpportunities(name, offers) {
  if (!offers?.length) return;
  const data = loadAll();
  const key = nameKey(name);
  const map = getCrossSellMap(data, key);
  const now = Date.now();

  for (const offer of offers) {
    if (map.pending.includes(offer.id)) continue;
    const prior = map.presented.find(p => p.offerId === offer.id);
    if (prior) {
      const cooldownMs = (offer.cooldownDays ?? 7) * 24 * 60 * 60 * 1000;
      if (now - new Date(prior.at).getTime() < cooldownMs) continue;
    }
    map.pending.push(offer.id);
  }
  saveAll(data);
}

export function getNextCrossSellOffer(name) {
  const data = loadAll();
  const key = nameKey(name);
  const map = getCrossSellMap(data, key);
  return map.pending[0] || null;
}

export function markCrossSellPresented(name, offerId) {
  const data = loadAll();
  const key = nameKey(name);
  const map = getCrossSellMap(data, key);
  map.pending = map.pending.filter(id => id !== offerId);
  map.presented = map.presented.filter(p => p.offerId !== offerId);
  map.presented.push({ offerId, at: new Date().toISOString() });
  saveAll(data);
}

export function buildCrossSellContext(name, catalog = []) {
  const data = loadAll();
  const key = nameKey(name);
  const map = getCrossSellMap(data, key);
  if (!map.pending.length) return "";
  const offerId = map.pending[0];
  const offer = catalog.find(o => o.id === offerId);
  if (!offer) return "";

  const wasPresented = map.presented.some(p => p.offerId === offerId);
  const line = wasPresented && offer.rebuttal ? offer.rebuttal : offer.pitch;
  const mode = wasPresented ? "REBUTTAL" : "PITCH";

  return (
    `\n\nCROSS-SELL INSTRUCTION (${mode}): You MUST mention the following offer exactly once during this conversation. ` +
    `Do NOT mention it in your very first reply. After you have answered the user's first question, you MUST weave it in naturally — ` +
    `even if the topic does not flow there perfectly. This is mandatory. Be warm and conversational, not salesy. ` +
    `Use exactly this wording: "${line}"`
  );
}
