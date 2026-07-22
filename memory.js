// Episodic memory — per-user, persists session summaries, retains 7 days
// Schema: {
//   users:     { "<name_key>": [ { id, startedAt, endedAt, summary, topics } ] },
//   crosssell: { "<name_key>": { pending: [offerId], presented: [{ offerId, at }] } }
// }

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MEMORY_FILE = path.join(__dirname, "episodic-memory.json");
const RETENTION_DAYS = 7;

// ── Storage helpers ───────────────────────────────────────────────────────────

function loadAll() {
  try {
    if (!fs.existsSync(MEMORY_FILE)) return { users: {} };
    const raw = JSON.parse(fs.readFileSync(MEMORY_FILE, "utf8"));
    // migrate old schema (flat sessions array → users map)
    if (raw.sessions && !raw.users) return { users: { anonymous: raw.sessions } };
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

function pruneOld(sessions) {
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  return (sessions || []).filter(s => new Date(s.startedAt).getTime() > cutoff);
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Return sessions for a user from the last 7 days, newest first */
export function getRecentSessions(name) {
  const data = loadAll();
  const key = nameKey(name);
  const sessions = data.users[key] || [];
  return pruneOld(sessions).sort(
    (a, b) => new Date(b.startedAt) - new Date(a.startedAt)
  );
}

/** List all known user keys (for the UI user-switcher) */
export function listUsers() {
  const data = loadAll();
  return Object.keys(data.users).filter(k => pruneOld(data.users[k]).length > 0);
}

/** Save a completed session summary under the correct user */
export function saveSession(name, { id, startedAt, endedAt, summary, topics }) {
  const data = loadAll();
  const key = nameKey(name);
  if (!data.users[key]) data.users[key] = [];
  data.users[key] = pruneOld(data.users[key]);
  const idx = data.users[key].findIndex(s => s.id === id);
  const entry = { id, startedAt, endedAt, summary, topics };
  if (idx >= 0) data.users[key][idx] = entry;
  else data.users[key].push(entry);
  saveAll(data);
}

/** Build the memory context string injected into Claude's system prompt */
export function buildMemoryContext(name, sessions) {
  const nameStr = name && name !== "anonymous" ? ` for ${name}` : "";
  if (!sessions.length) return nameStr ? `\n\nYou are speaking with ${name}. This is their first session.` : "";
  const lines = sessions.slice(0, 5).map(s => {
    const date = new Date(s.startedAt).toLocaleDateString("en-IN", {
      weekday: "short", day: "numeric", month: "short",
    });
    const topics = s.topics?.length ? ` [${s.topics.join(", ")}]` : "";
    return `• ${date}${topics}: ${s.summary}`;
  });
  return `\n\nYou are speaking with ${name || "the user"}. Their recent sessions (newest first):\n${lines.join("\n")}`;
}

// ── Cross-sell helpers ────────────────────────────────────────────────────────

/** Return the cross-sell map for a user (creates it if missing) */
function getCrossSellMap(data, key) {
  if (!data.crosssell) data.crosssell = {};
  if (!data.crosssell[key]) data.crosssell[key] = { pending: [], presented: [] };
  return data.crosssell[key];
}

/**
 * After a session ends, queue any newly-detected offer IDs that aren't already
 * pending or in cooldown.
 * @param {string} name
 * @param {Array<{id: string, cooldownDays: number}>} offers  resolved offer objects
 */
export function queueCrossSellOpportunities(name, offers) {
  if (!offers?.length) return;
  const data = loadAll();
  const key = nameKey(name);
  const map = getCrossSellMap(data, key);
  const now = Date.now();

  for (const offer of offers) {
    if (map.pending.includes(offer.id)) continue; // already queued
    const prior = map.presented.find(p => p.offerId === offer.id);
    if (prior) {
      const cooldownMs = (offer.cooldownDays ?? 7) * 24 * 60 * 60 * 1000;
      if (now - new Date(prior.at).getTime() < cooldownMs) continue;
    }
    map.pending.push(offer.id);
  }
  saveAll(data);
}

/**
 * Return the next pending cross-sell offer for a user (without removing it yet).
 * Returns null if none pending.
 */
export function getNextCrossSellOffer(name) {
  const data = loadAll();
  const key = nameKey(name);
  const map = getCrossSellMap(data, key);
  return map.pending[0] || null;
}

/**
 * Mark the given offer as presented for this user (moves from pending → presented).
 */
export function markCrossSellPresented(name, offerId) {
  const data = loadAll();
  const key = nameKey(name);
  const map = getCrossSellMap(data, key);
  map.pending = map.pending.filter(id => id !== offerId);
  // Remove any prior presentation of same offer, then record new one
  map.presented = map.presented.filter(p => p.offerId !== offerId);
  map.presented.push({ offerId, at: new Date().toISOString() });
  saveAll(data);
}

/**
 * Build the cross-sell context string to inject into the system prompt.
 * If the offer was already pitched last session (rebuttal mode), use the rebuttal.
 * @param {string} name
 * @param {Array<{id,pitch,rebuttal}>} catalog  full OFFERS array
 */
export function buildCrossSellContext(name, catalog = []) {
  const data = loadAll();
  const key = nameKey(name);
  const map = getCrossSellMap(data, key);
  if (!map.pending.length) return "";
  const offerId = map.pending[0];
  const offer = catalog.find(o => o.id === offerId);
  if (!offer) return "";

  // If this offer has been pitched before (in presented list), use the rebuttal
  const wasPresented = map.presented.some(p => p.offerId === offerId);
  const line = wasPresented && offer.rebuttal ? offer.rebuttal : offer.pitch;
  const mode = wasPresented ? "REBUTTAL" : "PITCH";

  return (
    `\n\nCROSS-SELL ${mode}: Mention this offer to ${name || "the user"} exactly once during this conversation. ` +
    `Do NOT say it as your very first response. After the first exchange, find a natural moment — ` +
    `even if the topic doesn't flow there perfectly, weave it in briefly after answering their question. ` +
    `Be warm and conversational, not salesy. Say: "${line}"`
  );
}

/** Build the greeting message sent to the user at session start */
export function buildGreeting(name, sessions) {
  const firstName = (name || "").trim().split(" ")[0];
  if (!sessions.length) {
    return firstName ? `Hello ${firstName}! Great to meet you. How can I help you today?` : null;
  }
  const last = sessions[0];
  const date = new Date(last.startedAt).toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long",
  });
  const topicStr = last.topics?.length
    ? ` We talked about ${last.topics.slice(0, 3).join(", ")}.`
    : "";
  return `Welcome back${firstName ? ", " + firstName : ""}! Last time we spoke on ${date}.${topicStr} ${last.summary}`;
}
