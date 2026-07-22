import Anthropic from "@anthropic-ai/sdk";
import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { fileURLToPath } from "url";
import path from "path";
import fetch from "node-fetch";
import fs from "fs";
import { localDetectIntent } from "./intent-library.js";

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

// ── Claude-based intent detection + tool routing ─────────────────────────────

async function detectIntent(text) {
  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 100,
      system: `You are an intent classifier. Reply with ONLY valid JSON, no extra text:
{"intent":"none","param":""}
intent options: weather | news | stock | sports | wiki | none
param: city name for weather, search query for news, ticker symbol for stock, sport/team for sports, topic for wiki, empty string for none`,
      messages: [{ role: "user", content: text }],
    });
    const raw = response.content[0]?.text?.trim() || '{"intent":"none","param":""}';
    return JSON.parse(raw);
  } catch (e) {
    slog("INTENT ERROR:", e.message);
    return { intent: "none", param: "" };
  }
}

async function fetchToolData(text, sendLog) {
  // 1. Try fast local library (Hindi + English phrases)
  let local = localDetectIntent(text);
  slog("LOCAL INTENT:", local ? `${local.intent} (score ${local.score})` : "none");

  // 2. Fall back to Claude for ambiguous/low-confidence cases
  let intent, param;
  if (local && local.score >= 2) {
    ({ intent, param } = local);
  } else {
    ({ intent, param } = await detectIntent(text));
  }
  slog("FINAL INTENT:", intent, "PARAM:", param);

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
