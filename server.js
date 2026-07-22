import Anthropic from "@anthropic-ai/sdk";
import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });
const apiKey = process.env.ANTHROPIC_API_KEY || "";
const baseURL = process.env.ANTHROPIC_BASE_URL || "https://anthropic.prod.ai-gateway.quantumblack.com/aa49ae17-4478-470b-8538-f2dfafa91d52";

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

wss.on("connection", (ws) => {
  const sessionId = Date.now().toString();
  conversationHistory.set(sessionId, []);

  ws.on("message", async (data) => {
    let payload;
    try {
      payload = JSON.parse(data);
    } catch {
      return;
    }

    if (payload.type === "user_speech") {
      const userText = payload.text?.trim();
      if (!userText) return;

      const history = conversationHistory.get(sessionId);
      history.push({ role: "user", content: userText });

      ws.send(JSON.stringify({ type: "thinking" }));

      try {
        const stream = await client.messages.stream({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1024,
          system:
            "You are a helpful, friendly voice assistant. Keep responses concise and conversational — ideally 1-3 sentences unless the user asks for detail. Avoid markdown, bullet points, or formatting since your responses will be spoken aloud.",
          messages: history,
        });

        let assistantText = "";

        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            assistantText += event.delta.text;
            ws.send(
              JSON.stringify({ type: "token", text: event.delta.text })
            );
          }
        }

        history.push({ role: "assistant", content: assistantText });

        // Keep conversation history to last 20 turns to avoid token bloat
        if (history.length > 40) {
          history.splice(0, 2);
        }

        ws.send(JSON.stringify({ type: "done", fullText: assistantText }));
      } catch (err) {
        console.error("Claude API error:", err.message);
        ws.send(
          JSON.stringify({
            type: "error",
            message: "Sorry, I encountered an error. Please try again.",
          })
        );
      }
    }

    if (payload.type === "reset") {
      conversationHistory.set(sessionId, []);
      ws.send(JSON.stringify({ type: "reset_ok" }));
    }
  });

  ws.on("close", () => {
    conversationHistory.delete(sessionId);
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Voice agent running at http://localhost:${PORT}`);
});
