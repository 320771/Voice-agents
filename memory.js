// Episodic memory — per-user, persists session summaries, retains 7 days
// Schema: { users: { "<name_key>": [ { id, startedAt, endedAt, summary, topics } ] } }

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
