// Episodic memory — persists session summaries to disk, retains 7 days
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MEMORY_FILE = path.join(__dirname, "episodic-memory.json");
const RETENTION_DAYS = 7;

// ── Schema ────────────────────────────────────────────────────────────────────
// { sessions: [ { id, startedAt, endedAt, summary, topics: [] } ] }

function loadAll() {
  try {
    if (!fs.existsSync(MEMORY_FILE)) return { sessions: [] };
    return JSON.parse(fs.readFileSync(MEMORY_FILE, "utf8"));
  } catch {
    return { sessions: [] };
  }
}

function saveAll(data) {
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(data, null, 2), "utf8");
}

// Prune sessions older than RETENTION_DAYS
function pruneOld(sessions) {
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  return sessions.filter(s => new Date(s.startedAt).getTime() > cutoff);
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Return sessions from the last 7 days, newest first */
export function getRecentSessions() {
  const { sessions } = loadAll();
  return pruneOld(sessions).sort(
    (a, b) => new Date(b.startedAt) - new Date(a.startedAt)
  );
}

/** Save a completed session summary */
export function saveSession({ id, startedAt, endedAt, summary, topics }) {
  const data = loadAll();
  data.sessions = pruneOld(data.sessions);
  // Replace if same id, else append
  const idx = data.sessions.findIndex(s => s.id === id);
  const entry = { id, startedAt, endedAt, summary, topics };
  if (idx >= 0) data.sessions[idx] = entry;
  else data.sessions.push(entry);
  saveAll(data);
}

/** Build the memory context string injected into Claude's system prompt */
export function buildMemoryContext(sessions) {
  if (!sessions.length) return "";
  const lines = sessions.slice(0, 5).map(s => {
    const date = new Date(s.startedAt).toLocaleDateString("en-IN", {
      weekday: "short", day: "numeric", month: "short",
    });
    const topics = s.topics?.length ? ` [${s.topics.join(", ")}]` : "";
    return `• ${date}${topics}: ${s.summary}`;
  });
  return `\n\nEpisodic memory (recent sessions, newest first):\n${lines.join("\n")}`;
}

/** Build the greeting message sent to the user at session start */
export function buildGreeting(sessions) {
  if (!sessions.length) return null;
  const last = sessions[0];
  const date = new Date(last.startedAt).toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long",
  });
  const topicStr = last.topics?.length
    ? ` We talked about ${last.topics.slice(0, 3).join(", ")}.`
    : "";
  return `Welcome back! Last time we spoke on ${date}.${topicStr} ${last.summary}`;
}
