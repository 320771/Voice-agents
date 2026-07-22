import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { fileURLToPath } from "url";
import path from "path";
import fetch from "node-fetch";
import fs from "fs";
import { buildVectorStore, vectorDetectIntent } from "./intent-library.js";
import { searchProducts, getDeals } from "./products.js";
import { getRecentSessions, saveSession, buildMemoryContext, buildGreeting, listUsers,
         buildCrossSellContext, queueCrossSellOpportunities, getNextCrossSellOffer, markCrossSellPresented } from "./memory.js";
import { OFFERS, detectOpportunities, getOffer } from "./crosssell-library.js";
import { sendWhatsApp, verifyWebhook, parseIncomingMessages, markAsRead } from "./whatsapp.js";

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

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ── Edge TTS endpoints ────────────────────────────────────────────────────────


// ── WhatsApp webhook ──────────────────────────────────────────────────────────

// GET: Meta verifies the webhook URL
app.get("/webhook", verifyWebhook);

// POST: incoming messages from WhatsApp users
app.post("/webhook", async (req, res) => {
  res.sendStatus(200); // always ack immediately to avoid Meta retries

  const incoming = parseIncomingMessages(req.body);
  for (const msg of incoming) {
    slog(`WHATSAPP IN [${msg.from}]: ${msg.text}`);
    markAsRead(msg.messageId);

    try {
      // Run through intent + tool detection, then Claude
      const toolResult = await fetchToolData(msg.text, () => {});
      let userContent = msg.text;
      if (toolResult) userContent = `${msg.text}\n\n[Tool data - ${toolResult.tool}]: ${toolResult.data}`;

      // Use a lightweight single-turn call (no persistent history for WA)
      const waHistory = [{ role: "user", content: userContent }];
      const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 512,
        system: "You are a helpful voice assistant replying over WhatsApp. Keep replies short and conversational — no markdown, no bullet points. When tool data is in [Tool data - ...] brackets, use it to answer accurately.",
        messages: waHistory,
      });
      const reply = response.content[0]?.text?.trim() || "Sorry, I couldn't process that.";
      slog(`WHATSAPP OUT [${msg.from}]: ${reply.slice(0, 80)}`);
      await sendWhatsApp(msg.from, reply);
    } catch (err) {
      slog("WHATSAPP REPLY ERROR:", err.message);
      await sendWhatsApp(msg.from, "Sorry, I ran into an error. Please try again.").catch(() => {});
    }
  }
});

const LOG_FILE = path.join(__dirname, "agent.log");
function slog(...args) {
  const line = `[${new Date().toISOString()}] ${args.join(" ")}\n`;
  process.stdout.write(line);
  fs.appendFileSync(LOG_FILE, line);
}

const conversationHistory = new Map();

// ── Tool implementations ─────────────────────────────────────────────────────

async function get_weather(city) {
  if (!city || city.trim().length < 2) return "NEED_CITY";
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

async function translate_text(text, targetLang) {
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${encodeURIComponent(targetLang)}`;
    const data = await fetch(url).then(r => r.json());
    const result = data.responseData?.translatedText;
    if (!result || result === text) return `Could not translate to ${targetLang}.`;
    return `Translation (${targetLang}): ${result}`;
  } catch { return "Translation unavailable."; }
}

async function get_definition(word) {
  try {
    const data = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`).then(r => r.json());
    if (!Array.isArray(data)) return `No definition found for: ${word}`;
    const entry = data[0];
    const meaning = entry.meanings?.[0];
    const def = meaning?.definitions?.[0]?.definition || "No definition found.";
    const phonetic = entry.phonetic ? ` (${entry.phonetic})` : "";
    return `${word}${phonetic}: [${meaning?.partOfSpeech}] ${def}`;
  } catch { return "Dictionary unavailable."; }
}

async function get_joke(topic = "") {
  try {
    if (topic.toLowerCase().includes("chuck") || topic.toLowerCase().includes("norris")) {
      const data = await fetch("https://api.chucknorris.io/jokes/random").then(r => r.json());
      return data.value || "No joke found.";
    }
    const data = await fetch("https://official-joke-api.appspot.com/random_joke").then(r => r.json());
    return `${data.setup} ... ${data.punchline}`;
  } catch { return "Could not fetch a joke right now."; }
}

async function get_currency(from, to, amount = 1) {
  try {
    const data = await fetch(`https://api.frankfurter.app/latest?from=${from.toUpperCase()}&to=${to.toUpperCase()}`).then(r => r.json());
    const rate = data.rates?.[to.toUpperCase()];
    if (!rate) return `Could not find exchange rate for ${from} to ${to}.`;
    const converted = (amount * rate).toFixed(2);
    return `${amount} ${from.toUpperCase()} = ${converted} ${to.toUpperCase()} (rate: ${rate})`;
  } catch { return "Currency data unavailable."; }
}

async function get_trivia(category = "") {
  try {
    const url = category
      ? `https://opentdb.com/api.php?amount=1&type=multiple&category=${encodeURIComponent(category)}`
      : "https://opentdb.com/api.php?amount=1&type=multiple";
    const data = await fetch(url).then(r => r.json());
    const q = data.results?.[0];
    if (!q) return "No trivia question available.";
    const question = q.question.replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, "&");
    const answer = q.correct_answer.replace(/&quot;/g, '"').replace(/&#039;/g, "'");
    return `Trivia [${q.category}]: ${question} — Answer: ${answer}`;
  } catch { return "Trivia unavailable."; }
}

async function get_quote() {
  try {
    const data = await fetch("https://api.quotable.io/random").then(r => r.json());
    return `"${data.content}" — ${data.author}`;
  } catch { return "Could not fetch a quote."; }
}

async function get_recipe(dish) {
  try {
    const data = await fetch(`https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(dish)}`).then(r => r.json());
    const meal = data.meals?.[0];
    if (!meal) return `No recipe found for: ${dish}`;
    const ingredients = Object.keys(meal)
      .filter(k => k.startsWith("strIngredient") && meal[k]?.trim())
      .slice(0, 8)
      .map(k => meal[k].trim()).join(", ");
    return `${meal.strMeal} (${meal.strArea} ${meal.strCategory}): Ingredients — ${ingredients}. ${meal.strInstructions?.slice(0, 200)}…`;
  } catch { return "Recipe data unavailable."; }
}

async function get_holidays(country, year = new Date().getFullYear()) {
  try {
    const data = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${country.toUpperCase()}`).then(r => r.json());
    if (!Array.isArray(data) || !data.length) return `No holidays found for ${country} in ${year}.`;
    const upcoming = data.filter(h => new Date(h.date) >= new Date()).slice(0, 5);
    const list = (upcoming.length ? upcoming : data.slice(0, 5))
      .map(h => `${h.date}: ${h.name}`).join(". ");
    return `Public holidays in ${country.toUpperCase()} (${year}): ${list}`;
  } catch { return "Holiday data unavailable."; }
}

async function get_time(timezone) {
  try {
    const data = await fetch(`https://worldtimeapi.org/api/timezone/${encodeURIComponent(timezone)}`).then(r => r.json());
    if (data.error) return `Unknown timezone: ${timezone}`;
    const dt = new Date(data.datetime);
    return `Current time in ${timezone}: ${dt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZoneName: "short" })} on ${dt.toDateString()}`;
  } catch { return "Time data unavailable."; }
}

async function get_country(name) {
  try {
    const data = await fetch(`https://restcountries.com/v3.1/name/${encodeURIComponent(name)}?fullText=false&fields=name,capital,population,currencies,languages,region`).then(r => r.json());
    const c = Array.isArray(data) ? data[0] : null;
    if (!c) return `No country found: ${name}`;
    const capital = c.capital?.[0] || "N/A";
    const pop = c.population?.toLocaleString() || "N/A";
    const currency = Object.values(c.currencies || {})[0];
    const currStr = currency ? `${currency.name} (${currency.symbol})` : "N/A";
    const langs = Object.values(c.languages || {}).slice(0, 3).join(", ");
    return `${c.name.common} (${c.region}): Capital — ${capital}, Population — ${pop}, Currency — ${currStr}, Languages — ${langs}`;
  } catch { return "Country data unavailable."; }
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
  if (intent === "translate") {
    const parts = param.split("::");
    const targetLang = parts[0]?.trim() || "hi";
    const textToTranslate = parts[1]?.trim() || text;
    sendLog("tool_call", "translate_text", { targetLang, text: textToTranslate });
    return { tool: "translate", data: await translate_text(textToTranslate, targetLang) };
  }
  if (intent === "dictionary") {
    if (!param) return { tool: "dictionary", data: "Please specify a word to look up." };
    sendLog("tool_call", "get_definition", { word: param });
    return { tool: "dictionary", data: await get_definition(param) };
  }
  if (intent === "joke") {
    sendLog("tool_call", "get_joke", { topic: param });
    return { tool: "joke", data: await get_joke(param) };
  }
  if (intent === "currency") {
    const parts = param.split("::");
    const from = parts[0]?.trim() || "USD";
    const to = parts[1]?.trim() || "INR";
    const amount = parseFloat(parts[2]) || 1;
    sendLog("tool_call", "get_currency", { from, to, amount });
    return { tool: "currency", data: await get_currency(from, to, amount) };
  }
  if (intent === "trivia") {
    sendLog("tool_call", "get_trivia", { category: param });
    return { tool: "trivia", data: await get_trivia(param) };
  }
  if (intent === "quote") {
    sendLog("tool_call", "get_quote", {});
    return { tool: "quote", data: await get_quote() };
  }
  if (intent === "recipe") {
    if (!param) return { tool: "recipe", data: "Please specify a dish or ingredient." };
    sendLog("tool_call", "get_recipe", { dish: param });
    return { tool: "recipe", data: await get_recipe(param) };
  }
  if (intent === "holiday") {
    const parts = param.split("::");
    const country = parts[0]?.trim() || "IN";
    const year = parts[1]?.trim() || new Date().getFullYear();
    sendLog("tool_call", "get_holidays", { country, year });
    return { tool: "holiday", data: await get_holidays(country, year) };
  }
  if (intent === "time") {
    const tz = param || "Asia/Kolkata";
    sendLog("tool_call", "get_time", { timezone: tz });
    return { tool: "time", data: await get_time(tz) };
  }
  if (intent === "country") {
    if (!param) return { tool: "country", data: "Please specify a country name." };
    sendLog("tool_call", "get_country", { name: param });
    return { tool: "country", data: await get_country(param) };
  }
  if (intent === "product") {
    if (!param || param.endsWith("::")) return { tool: "product", data: "Please tell me what product you are looking for." };
    sendLog("tool_call", "search_products", { param });
    return { tool: "product", data: await searchProducts(param) };
  }
  if (intent === "deals") {
    sendLog("tool_call", "get_deals", { param });
    return { tool: "deals", data: await getDeals(param) };
  }
  if (intent === "whatsapp") {
    // param format: "NUMBER::MESSAGE" — split on first ::
    const sep = param.indexOf("::");
    if (sep === -1) return { tool: "whatsapp", data: "Please say: send WhatsApp to <number> saying <message>" };
    const to = param.slice(0, sep).trim();
    const message = param.slice(sep + 2).trim();
    try {
      sendLog("tool_call", "send_whatsapp", { to, message });
      await sendWhatsApp(to, message);
      return { tool: "whatsapp", data: `WhatsApp message sent to ${to}.` };
    } catch (e) {
      return { tool: "whatsapp", data: `Failed to send WhatsApp: ${e.message}` };
    }
  }
  return null;
}

// ── Tool failure detection ────────────────────────────────────────────────────

const FAILURE_SUFFIXES = ["unavailable.", "unavailable", "unavailable right now.", "data unavailable.", "right now."];

function isToolFailure(data) {
  if (!data) return false;
  const lower = data.toLowerCase().trim();
  return FAILURE_SUFFIXES.some(s => lower.endsWith(s)) || lower === "need_city";
}

// ── Pending retry store ───────────────────────────────────────────────────────
// Map<retryId, { userText, userName, whatsappPhone, wsRef, attempts, createdAt }>
const pendingRetries = new Map();
let retryIdSeq = 0;

function scheduleRetry(userText, userName, whatsappPhone, wsRef) {
  const id = ++retryIdSeq;
  pendingRetries.set(id, { userText, userName, whatsappPhone, wsRef, attempts: 0, createdAt: Date.now() });
  slog(`RETRY [${id}]: Queued retry for "${userText.slice(0, 60)}" (user: ${userName})`);
  return id;
}

// Background retry loop — fires every 30 seconds
setInterval(async () => {
  if (!pendingRetries.size) return;
  const MAX_AGE_MS  = 10 * 60 * 1000; // give up after 10 min
  const MAX_TRIES   = 12;
  const now = Date.now();

  for (const [id, entry] of pendingRetries) {
    if (now - entry.createdAt > MAX_AGE_MS || entry.attempts >= MAX_TRIES) {
      pendingRetries.delete(id);
      slog(`RETRY [${id}]: Gave up after ${entry.attempts} attempts`);
      continue;
    }
    entry.attempts++;
    try {
      const result = await fetchToolData(entry.userText, () => {});
      if (!result || isToolFailure(result.data)) continue; // still failing

      pendingRetries.delete(id);
      const msg = `Got that update for you! ${result.data}`;
      slog(`RETRY [${id}]: Success on attempt ${entry.attempts} — delivering to ${entry.userName}`);

      // Deliver via WebSocket if still open, else WhatsApp
      const wsAlive = entry.wsRef?.readyState === 1; // 1 = OPEN
      if (wsAlive) {
        entry.wsRef.send(JSON.stringify({ type: "callback_result", text: msg }));
      } else if (entry.whatsappPhone) {
        await sendWhatsApp(entry.whatsappPhone, msg).catch(() => {});
        slog(`RETRY [${id}]: Sent via WhatsApp to ${entry.whatsappPhone}`);
      }
    } catch {
      // swallow — will retry next interval
    }
  }
}, 30_000);

// ── WebSocket handler ────────────────────────────────────────────────────────

wss.on("connection", (ws) => {
  const sessionId = Date.now().toString();
  const sessionStartedAt = new Date().toISOString();
  conversationHistory.set(sessionId, []);

  let userName = "anonymous";
  let systemPrompt = buildSystemPrompt(userName, []);

  // Send known users list so the UI can show autocomplete suggestions
  ws.send(JSON.stringify({ type: "known_users", users: listUsers() }));

  function buildSystemPrompt(name, sessions) {
    return "You are a helpful, friendly voice assistant. " +
      "When tool data is provided in [Tool data - ...] brackets, use it to answer accurately and concisely. " +
      "Keep responses conversational — 1-3 sentences, no markdown, no bullet points, since your response will be spoken aloud." +
      buildMemoryContext(name, sessions) +
      buildCrossSellContext(name, OFFERS);
  }

  function loadUserMemory(name) {
    userName = name;
    const recentSessions = getRecentSessions(name);
    systemPrompt = buildSystemPrompt(name, recentSessions);
    const pendingOffer = getNextCrossSellOffer(name);
    if (pendingOffer) {
      slog(`CROSSSELL [${name}]: Active offer in prompt — ${pendingOffer}`);
      slog(`CROSSSELL [${name}]: System prompt cross-sell snippet: ${systemPrompt.slice(systemPrompt.indexOf("CROSS-SELL"))?.slice(0, 200) || "(not found)"}`);
    } else {
      slog(`CROSSSELL [${name}]: No pending offer for this session`);
    }
    const greeting = buildGreeting(name, recentSessions);
    if (greeting) {
      ws.send(JSON.stringify({ type: "memory_greeting", text: greeting }));
      slog(`MEMORY [${name}]: Sent greeting from ${recentSessions.length} past session(s)`);
    }
  }

  const sendLog = (type, tool, input) => {
    ws.send(JSON.stringify({ type, tool, input }));
  };

  // Summarise the session and persist to episodic memory under userName
  async function persistMemory() {
    const history = conversationHistory.get(sessionId) || [];
    if (history.length < 2) return;

    // Save a placeholder synchronously FIRST so an immediate reconnect sees this session
    const endedAt = new Date().toISOString();
    saveSession(userName, { id: sessionId, startedAt: sessionStartedAt, endedAt, summary: "Recent conversation.", topics: [] });

    try {
      const transcript = history
        .map(m => `${m.role === "user" ? "User" : "Agent"}: ${m.content.slice(0, 300)}`)
        .join("\n");
      const res = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 200,
        system: 'Summarise this conversation in 1-2 sentences. Then on a new line write "TOPICS:" followed by up to 5 comma-separated key topics. Be concise.',
        messages: [{ role: "user", content: transcript }],
      });
      const raw = res.content[0]?.text?.trim() || "";
      const [summaryPart, topicsPart] = raw.split(/\nTOPICS:/i);
      const summary = summaryPart?.trim() || "Recent conversation.";
      const topics = topicsPart ? topicsPart.split(",").map(t => t.trim()).filter(Boolean) : [];

      // Update placeholder with real summary
      saveSession(userName, { id: sessionId, startedAt: sessionStartedAt, endedAt, summary, topics });
      slog(`MEMORY [${userName}]: Session saved — ${summary.slice(0, 80)}`);

      // 1. Mark whatever offer was injected THIS session as presented (before queuing new ones)
      const presentedThisSession = getNextCrossSellOffer(userName);
      if (presentedThisSession) {
        markCrossSellPresented(userName, presentedThisSession);
        slog(`CROSSSELL [${userName}]: Marked presented — ${presentedThisSession}`);
      }

      // 2. Detect new opportunities from this session's topics + summary → queue for NEXT session
      const opportunityIds = detectOpportunities(topics, summary);
      if (opportunityIds.length) {
        const resolvedOffers = opportunityIds.map(id => getOffer(id)).filter(Boolean);
        queueCrossSellOpportunities(userName, resolvedOffers);
        slog(`CROSSSELL [${userName}]: Queued for next session — ${opportunityIds.join(", ")}`);
      }
    } catch (e) {
      slog("MEMORY ERROR:", e.message, e.status ? `HTTP ${e.status}` : "");
    }
  }

  ws.on("message", async (data) => {
    let payload;
    try { payload = JSON.parse(data); } catch { return; }

    // User identified themselves
    if (payload.type === "set_user") {
      const name = payload.name?.trim();
      if (name) {
        conversationHistory.set(sessionId, []); // fresh history for new user
        loadUserMemory(name);
        slog(`USER SET: ${name}`);
      }
      return;
    }

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

        // 2. Handle tool failure — queue retry and tell Claude to respond gracefully
        const toolFailed = toolResult && isToolFailure(toolResult.data);
        if (toolFailed) {
          scheduleRetry(userText, userName, null /* whatsapp phone not tracked here */, ws);
          slog(`TOOL FAILURE: ${toolResult.tool} returned "${toolResult.data}" — queued retry`);
        }

        // 3. Build the message — inject tool data or failure hint
        let userContent = userText;
        if (toolResult && !toolFailed) {
          userContent = `${userText}\n\n[Tool data - ${toolResult.tool}]: ${toolResult.data}`;
        } else if (toolFailed) {
          userContent = `${userText}\n\n[Tool data - ${toolResult.tool}]: SERVICE_TEMPORARILY_UNAVAILABLE — ` +
            `Tell the user warmly that you're having a little trouble fetching that right now and you'll get back to them once it's sorted. ` +
            `Do not mention a technical error. Keep it conversational and brief.`;
        }

        history.push({ role: "user", content: userContent });

        // 3. Stream Claude's response
        const stream = await client.messages.stream({
          model: "claude-sonnet-4-6",
          max_tokens: 1024,
          system: systemPrompt,
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
