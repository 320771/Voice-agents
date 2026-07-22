import Anthropic from "@anthropic-ai/sdk";
import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { fileURLToPath } from "url";
import path from "path";
import fetch from "node-fetch";

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

const conversationHistory = new Map();

// ── Tool definitions ─────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "get_weather",
    description: "Get current weather for a city",
    input_schema: {
      type: "object",
      properties: {
        city: { type: "string", description: "City name e.g. London" },
      },
      required: ["city"],
    },
  },
  {
    name: "get_news",
    description: "Get latest top headlines, optionally filtered by topic/keyword",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Topic or keyword e.g. technology, sports, India" },
      },
      required: [],
    },
  },
  {
    name: "get_wikipedia",
    description: "Get a Wikipedia summary for a topic or person",
    input_schema: {
      type: "object",
      properties: {
        topic: { type: "string", description: "Topic to look up e.g. Eiffel Tower" },
      },
      required: ["topic"],
    },
  },
  {
    name: "get_stock",
    description: "Get current stock price and info for a company ticker symbol",
    input_schema: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "Stock ticker symbol e.g. AAPL, TSLA, GOOGL" },
      },
      required: ["symbol"],
    },
  },
  {
    name: "get_sports",
    description: "Get latest sports scores or news for a sport or team",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Sport or team e.g. cricket, Premier League, NBA" },
      },
      required: ["query"],
    },
  },
];

// ── Tool implementations ─────────────────────────────────────────────────────

async function get_weather({ city }) {
  try {
    const geo = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`
    ).then((r) => r.json());
    if (!geo.results?.length) return `Could not find city: ${city}`;
    const { latitude, longitude, name, country } = geo.results[0];
    const wx = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
      `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code` +
      `&temperature_unit=celsius`
    ).then((r) => r.json());
    const c = wx.current;
    const codes = { 0:"Clear sky",1:"Mainly clear",2:"Partly cloudy",3:"Overcast",
      45:"Foggy",48:"Icy fog",51:"Light drizzle",61:"Light rain",63:"Moderate rain",
      65:"Heavy rain",71:"Light snow",73:"Moderate snow",75:"Heavy snow",
      80:"Rain showers",81:"Moderate showers",82:"Heavy showers",95:"Thunderstorm" };
    const desc = codes[c.weather_code] || "Unknown";
    return `${name}, ${country}: ${desc}, ${c.temperature_2m}°C, humidity ${c.relative_humidity_2m}%, wind ${c.wind_speed_10m} km/h`;
  } catch (e) {
    return "Weather data unavailable right now.";
  }
}

async function get_news({ query = "" }) {
  try {
    const url = query
      ? `https://gnews.io/api/v4/search?q=${encodeURIComponent(query)}&lang=en&max=5&apikey=free`
      : `https://gnews.io/api/v4/top-headlines?lang=en&max=5&apikey=free`;
    // fallback: use NewsAPI.org public endpoint (no key needed for headlines)
    const res = await fetch(
      `https://api.currentsapi.services/v1/latest-news?language=en&keywords=${encodeURIComponent(query || "world")}`,
      { headers: { "Authorization": "free" } }
    );
    // Use RSS-based approach that needs no key
    const rss = await fetch(
      `https://feeds.bbci.co.uk/news/${query ? "world" : "world"}/rss.xml`
    ).then((r) => r.text());
    const items = [...rss.matchAll(/<title><!\[CDATA\[([^\]]+)\]/)].slice(1, 6);
    if (!items.length) {
      const titles = [...rss.matchAll(/<title>([^<]+)<\/title>/)].slice(1, 6);
      return titles.map((m, i) => `${i + 1}. ${m[1].trim()}`).join("\n") || "No news found.";
    }
    return items.map((m, i) => `${i + 1}. ${m[1].trim()}`).join("\n");
  } catch (e) {
    return "News unavailable right now.";
  }
}

async function get_wikipedia({ topic }) {
  try {
    const search = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topic)}`
    ).then((r) => r.json());
    if (search.extract) {
      return search.extract.slice(0, 600) + (search.extract.length > 600 ? "…" : "");
    }
    return `No Wikipedia article found for: ${topic}`;
  } catch (e) {
    return "Wikipedia unavailable right now.";
  }
}

async function get_stock({ symbol }) {
  try {
    const data = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol.toUpperCase()}?interval=1d&range=1d`
    ).then((r) => r.json());
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta) return `Could not find stock: ${symbol}`;
    const price = meta.regularMarketPrice;
    const prev = meta.chartPreviousClose;
    const change = ((price - prev) / prev * 100).toFixed(2);
    const dir = change >= 0 ? "▲" : "▼";
    return `${meta.symbol} (${meta.longName || symbol}): $${price} ${dir}${Math.abs(change)}% today. Exchange: ${meta.exchangeName}`;
  } catch (e) {
    return "Stock data unavailable right now.";
  }
}

async function get_sports({ query }) {
  try {
    const rss = await fetch(
      `https://feeds.bbci.co.uk/sport/rss.xml`
    ).then((r) => r.text());
    const titles = [...rss.matchAll(/<title>([^<]+)<\/title>/)].slice(1, 8);
    const q = query.toLowerCase();
    const filtered = titles.filter((m) => m[1].toLowerCase().includes(q));
    const results = (filtered.length ? filtered : titles).slice(0, 5);
    return results.map((m, i) => `${i + 1}. ${m[1].trim()}`).join("\n") || "No sports news found.";
  } catch (e) {
    return "Sports data unavailable right now.";
  }
}

const toolFns = { get_weather, get_news, get_wikipedia, get_stock, get_sports };

// ── WebSocket handler ────────────────────────────────────────────────────────

wss.on("connection", (ws) => {
  const sessionId = Date.now().toString();
  conversationHistory.set(sessionId, []);

  ws.on("message", async (data) => {
    let payload;
    try { payload = JSON.parse(data); } catch { return; }

    if (payload.type === "user_speech") {
      const userText = payload.text?.trim();
      if (!userText) return;

      const history = conversationHistory.get(sessionId);
      history.push({ role: "user", content: userText });
      ws.send(JSON.stringify({ type: "thinking" }));

      try {
        let finalText = "";

        const SYSTEM = "You are a helpful, friendly voice assistant with access to weather, news, Wikipedia, stocks, and sports tools. Use them when relevant. Keep responses concise and conversational — spoken aloud, no markdown or bullet points.";

        // agentic loop: handle tool calls, then get final text
        while (true) {
          const response = await client.messages.create({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 1024,
            system: SYSTEM,
            tools: TOOLS,
            messages: history,
          });

          if (response.stop_reason === "tool_use") {
            const toolResults = [];
            for (const block of response.content) {
              if (block.type === "tool_use") {
                ws.send(JSON.stringify({ type: "tool_call", tool: block.name }));
                const result = await (toolFns[block.name]?.(block.input) ?? Promise.resolve("Tool not found"));
                toolResults.push({ type: "tool_result", tool_use_id: block.id, content: String(result) });
              }
            }
            history.push({ role: "assistant", content: response.content });
            history.push({ role: "user", content: toolResults });
            continue;
          }

          // extract text directly from this response — no second API call needed
          for (const block of response.content) {
            if (block.type === "text") {
              finalText += block.text;
              // send tokens word by word so the UI streams nicely
              for (const word of block.text.split(" ")) {
                ws.send(JSON.stringify({ type: "token", text: word + " " }));
              }
            }
          }
          break;
        }

        history.push({ role: "assistant", content: finalText });
        if (history.length > 40) history.splice(0, 2);
        ws.send(JSON.stringify({ type: "done", fullText: finalText }));

      } catch (err) {
        console.error("Claude API error:", err.message);
        ws.send(JSON.stringify({ type: "error", message: "Sorry, I encountered an error. Please try again." }));
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
