import Anthropic from "@anthropic-ai/sdk";
import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { fileURLToPath } from "url";
import path from "path";
import fetch from "node-fetch";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });

const apiKey = process.env.ANTHROPIC_API_KEY || "";
const baseURL = process.env.ANTHROPIC_BASE_URL ||
  "https://anthropic.prod.ai-gateway.quantumblack.com/aa49ae17-4478-470b-8538-f2dfafa91d52";

const isBasicAuth = apiKey.includes(":");
const client = new Anthropic({
  baseURL,
  apiKey: isBasicAuth ? "placeholder" : apiKey,
  defaultHeaders: isBasicAuth
    ? { Authorization: `Basic ${Buffer.from(apiKey).toString("base64")}` }
    : {},
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

// ── Keyword-based tool routing (no tool-use API needed) ──────────────────────

async function fetchToolData(text, sendLog) {
  const t = text.toLowerCase();

  if (/weather|temperature|forecast|rain|sunny|cold|hot/.test(t)) {
    const city = text.match(/(?:in|for|at)\s+([A-Za-z\s]+?)(?:\?|$|,)/i)?.[1]?.trim() || "London";
    sendLog("tool_call", "get_weather", { city });
    return { tool: "weather", data: await get_weather(city) };
  }

  if (/news|headline|latest|happening|today/.test(t)) {
    const query = text.match(/news (?:about|on|regarding)\s+(.+?)(?:\?|$)/i)?.[1] || "";
    sendLog("tool_call", "get_news", { query });
    return { tool: "news", data: await get_news(query) };
  }

  if (/stock|share price|market|nasdaq|nyse|\$[A-Z]{2,5}/.test(t)) {
    const sym = text.match(/\b([A-Z]{2,5})\b/)?.[1] ||
                text.match(/(?:stock|shares?) (?:of|for)?\s+(\w+)/i)?.[1] || "AAPL";
    sendLog("tool_call", "get_stock", { symbol: sym });
    return { tool: "stock", data: await get_stock(sym) };
  }

  if (/sport|cricket|football|soccer|basketball|nba|ipl|premier league|tennis|score/.test(t)) {
    const q = text.match(/(?:about|on|in)\s+([a-z\s]+?)(?:\?|$)/i)?.[1] || "";
    sendLog("tool_call", "get_sports", { query: q });
    return { tool: "sports", data: await get_sports(q) };
  }

  if (/who is|what is|tell me about|explain|wikipedia/.test(t)) {
    const topic = text.replace(/who is|what is|tell me about|explain|wikipedia/gi, "").replace(/[?]/g, "").trim();
    if (topic) {
      sendLog("tool_call", "get_wikipedia", { topic });
      return { tool: "wiki", data: await get_wikipedia(topic) };
    }
  }

  return null; // no tool needed
}

// ── WebSocket handler ────────────────────────────────────────────────────────

wss.on("connection", (ws) => {
  const sessionId = Date.now().toString();
  conversationHistory.set(sessionId, []);

  const sendLog = (type, tool, input) => {
    ws.send(JSON.stringify({ type, tool, input }));
  };

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
        slog("TOOL CHECK for:", userText);
        const toolResult = await fetchToolData(userText, sendLog);
        if (toolResult) slog("TOOL RESULT:", toolResult.tool, "=>", toolResult.data.slice(0, 120));

        // 2. Build the message — inject tool data into context if available
        let userContent = userText;
        if (toolResult) {
          userContent = `${userText}\n\n[Tool data - ${toolResult.tool}]: ${toolResult.data}`;
        }

        history.push({ role: "user", content: userContent });

        // 3. Stream Claude's response
        slog("CALLING Claude API, model=claude-haiku-4-5-20251001, baseURL=", baseURL);
        const stream = await client.messages.stream({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1024,
          system: "You are a helpful, friendly voice assistant. When tool data is provided in [Tool data - ...] brackets, use it to answer the user's question accurately and concisely. Keep responses conversational — 1-3 sentences, no markdown, no bullet points, since your response will be spoken aloud.",
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

  ws.on("close", () => conversationHistory.delete(sessionId));
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log(`Voice agent running at http://localhost:${PORT}`));
