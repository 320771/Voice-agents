import Anthropic from "@anthropic-ai/sdk";
import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { fileURLToPath } from "url";
import path from "path";
import fetch from "node-fetch";
import fs from "fs";
import { buildVectorStore, vectorDetectIntent } from "./intent-library.js";
import { getRecentSessions, saveSession, buildMemoryContext, buildGreeting } from "./memory.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });

const apiKey = process.env.ANTHROPIC_API_KEY || "";
const baseURL = process.env.ANTHROPIC_BASE_URL ||
  "https://anthropic.prod.ai-gateway.quantumblack.com/aa49ae17-4478-470b-8538-f2dfafa91d52";

const client = new Anthropic({
  baseURL,
  apiKey,
});

app.use(express.static(path.join(__dirname, "public")));

const LOG_FILE = path.join(__dirname, "agent.log");
function slog(...args) {
  const line = `[${new Date().toISOString()}] ${args.join(" ")}\n`;
  process.stdout.write(line);
  fs.appendFileSync(LOG_FILE, line);
}

const conversationHistory = new Map();

// ── Tool implementations ─────────────────────────────────────────────────────

async function get_weather(city) {
  try {
    const geo = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`
    ).then(r => r.json());
    if (!geo.results?.length) return `Could not find city: ${city}`;
    const { latitude, longitude, name, country } = geo.results[0];
    const wx = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
      `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&temperature_unit=celsius`
    ).then(r => r.json());
    const c = wx.current;
    const codes = { 0:"Clear sky",1:"Mainly clear",2:"Partly cloudy",3:"Overcast",
      45:"Foggy",51:"Light drizzle",61:"Light rain",63:"Moderate rain",65:"Heavy rain",
      71:"Light snow",80:"Rain showers",95:"Thunderstorm" };
    return `${name}, ${country}: ${codes[c.weather_code]||"Unknown"}, ${c.temperature_2m}°C, humidity ${c.relative_humidity_2m}%, wind ${c.wind_speed_10m} km/h`;
  } catch { return "Weather data unavailable."; }
}

async function get_news(query = "") {
  try {
    const rss = await fetch("https://feeds.bbci.co.uk/news/world/rss.xml").then(r => r.text());
    const titles = [...rss.matchAll(/<title>([^<]+)<\/title>/)].slice(1).map(m => m[1].trim());
    const filtered = query
      ? titles.filter(t => t.toLowerCase().includes(query.toLowerCase()))
      : titles;
    return (filtered.length ? filtered : titles).slice(0, 5).map((t, i) => `${i+1}. ${t}`).join(". ");
  } catch { return "News unavailable."; }
}

async function get_wikipedia(topic) {
  try {
    const data = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topic)}`
    ).then(r => r.json());
    return data.extract?.slice(0, 500) || `No Wikipedia article found for: ${topic}`;
  } catch { return "Wikipedia unavailable."; }
}

async function get_stock(symbol) {
  try {
    const data = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol.toUpperCase()}?interval=1d&range=1d`
    ).then(r => r.json());
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta) return `Could not find stock: ${symbol}`;
    const price = meta.regularMarketPrice;
    const prev  = meta.chartPreviousClose;
    const pct   = ((price - prev) / prev * 100).toFixed(2);
    return `${meta.symbol}: $${price} (${pct >= 0 ? "+" : ""}${pct}% today)`;
  } catch { return "Stock data unavailable."; }
}

async function get_sports(query = "") {
  try {
    const rss = await fetch("https://feeds.bbci.co.uk/sport/rss.xml").then(r => r.text());
    const titles = [...rss.matchAll(/<title>([^<]+)<\/title>/)].slice(1).map(m => m[1].trim());
    const filtered = query
      ? titles.filter(t => t.toLowerCase().includes(query.toLowerCase()))
      : titles;
    return (filtered.length ? filtered : titles).slice(0, 5).map((t, i) => `${i+1}. ${t}`).join(". ");
  } catch { return "Sports data unavailable."; }
}

// ── Vector-based intent detection + tool routing ─────────────────────────────

async function fetchToolData(text, sendLog) {
  const { intent, param, score } = await vectorDetectIntent(text);
  slog(`INTENT: ${intent} | PARAM: ${param} | SCORE: ${score?.toFixed(3)}`);

  if (intent === "weather") {
    if (!param) return { tool: "weather", data: "Please specify a city. For example: what is the weather in Mumbai?" };
    sendLog("tool_call", "get_weather", { city: param });
    return { tool: "weather", data: await get_weather(param) };
  }
  if (intent === "news") {
    sendLog("tool_call", "get_news", { query: param });
    return { tool: "news", data: await get_news(param) };
  }
  if (intent === "stock") {
    if (!param) return { tool: "stock", data: "Please specify a stock symbol or company. For example: what is Apple stock price?" };
    sendLog("tool_call", "get_stock", { symbol: param });
    return { tool: "stock", data: await get_stock(param) };
  }
  if (intent === "sports") {
    sendLog("tool_call", "get_sports", { query: param });
    return { tool: "sports", data: await get_sports(param) };
  }
  if (intent === "wiki") {
    if (!param) return null;
    sendLog("tool_call", "get_wikipedia", { topic: param });
    return { tool: "wiki", data: await get_wikipedia(param) };
  }
  return null;
}

// ── WebSocket handler ────────────────────────────────────────────────────────

wss.on("connection", (ws) => {
  const sessionId = Date.now().toString();
  const sessionStartedAt = new Date().toISOString();
  conversationHistory.set(sessionId, []);

  // Load episodic memory and greet user
  const recentSessions = getRecentSessions();
  const memoryContext = buildMemoryContext(recentSessions);
  const greeting = buildGreeting(recentSessions);
  if (greeting) {
    ws.send(JSON.stringify({ type: "memory_greeting", text: greeting }));
    slog("MEMORY: Sent greeting from", recentSessions.length, "past session(s)");
  }

  const SYSTEM_PROMPT =
    "You are a helpful, friendly voice assistant. " +
    "When tool data is provided in [Tool data - ...] brackets, use it to answer accurately and concisely. " +
    "Keep responses conversational — 1-3 sentences, no markdown, no bullet points, since your response will be spoken aloud." +
    memoryContext;

  const sendLog = (type, tool, input) => {
    ws.send(JSON.stringify({ type, tool, input }));
  };

  // Summarise the session and persist to episodic memory
  async function persistMemory() {
    const history = conversationHistory.get(sessionId) || [];
    if (history.length < 2) return; // nothing worth saving
    try {
      const transcript = history
        .map(m => `${m.role === "user" ? "User" : "Agent"}: ${m.content.slice(0, 300)}`)
        .join("\n");
      const res = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 200,
        system: 'Summarise this conversation in 1-2 sentences. Then on a new line write "TOPICS:" followed by up to 5 comma-separated key topics. Be concise.',
        messages: [{ role: "user", content: transcript }],
      });
      const raw = res.content[0]?.text?.trim() || "";
      const [summaryPart, topicsPart] = raw.split(/\nTOPICS:/i);
      const summary = summaryPart?.trim() || "General conversation.";
      const topics = topicsPart ? topicsPart.split(",").map(t => t.trim()).filter(Boolean) : [];
      saveSession({ id: sessionId, startedAt: sessionStartedAt, endedAt: new Date().toISOString(), summary, topics });
      slog("MEMORY: Session saved —", summary.slice(0, 80));
    } catch (e) {
      slog("MEMORY ERROR:", e.message);
    }
  }

  ws.on("message", async (data) => {
    let payload;
    try { payload = JSON.parse(data); } catch { return; }

    if (payload.type === "user_speech") {
      const userText = payload.text?.trim();
      if (!userText) return;

      slog("USER:", userText);
      const history = conversationHistory.get(sessionId);
      ws.send(JSON.stringify({ type: "thinking" }));

      try {
        // 1. Check if a tool should be called
        const toolResult = await fetchToolData(userText, sendLog);
        if (toolResult) slog("TOOL RESULT:", toolResult.tool, "=>", toolResult.data.slice(0, 120));

        // 2. Build the message — inject tool data if available
        let userContent = userText;
        if (toolResult) {
          userContent = `${userText}\n\n[Tool data - ${toolResult.tool}]: ${toolResult.data}`;
        }

        history.push({ role: "user", content: userContent });

        // 3. Stream Claude's response
        const stream = await client.messages.stream({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          messages: history,
        });

        let finalText = "";
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            finalText += event.delta.text;
            ws.send(JSON.stringify({ type: "token", text: event.delta.text }));
          }
        }

        slog("RESPONSE:", finalText.slice(0, 120));
        history.push({ role: "assistant", content: finalText });
        if (history.length > 40) history.splice(0, 2);
        ws.send(JSON.stringify({ type: "done", fullText: finalText }));

      } catch (err) {
        const detail = [
          err.status ? `HTTP ${err.status}` : "",
          err.message || "",
          err.error ? JSON.stringify(err.error) : "",
        ].filter(Boolean).join(" | ");
        slog("ERROR:", detail);
        ws.send(JSON.stringify({ type: "error", message: `Error: ${detail}` }));
      }
    }

    if (payload.type === "reset") {
      conversationHistory.set(sessionId, []);
      ws.send(JSON.stringify({ type: "reset_ok" }));
    }
  });

  ws.on("close", async () => {
    await persistMemory();
    conversationHistory.delete(sessionId);
  });
});

const PORT = process.env.PORT || 3000;

// Build embedding vector store, then start HTTP server
slog("Building intent vector store...");
buildVectorStore()
  .then(() => {
    httpServer.listen(PORT, () => console.log(`Voice agent running at http://localhost:${PORT}`));
  })
  .catch(err => {
    slog("Failed to build vector store:", err.message);
    process.exit(1);
  });
