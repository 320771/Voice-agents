// WhatsApp Business Cloud API integration
// Set these in your .env file:
//   WHATSAPP_TOKEN        — permanent system user token (or temporary 24hr token)
//   WHATSAPP_PHONE_ID     — Phone Number ID from Meta App → WhatsApp → API Setup
//   WHATSAPP_VERIFY_TOKEN — any secret string you choose for webhook verification

import fetch from "node-fetch";

const WA_TOKEN    = process.env.WHATSAPP_TOKEN    || "";
const WA_PHONE_ID = process.env.WHATSAPP_PHONE_ID || "";
const WA_API_URL  = `https://graph.facebook.com/v19.0/${WA_PHONE_ID}/messages`;

// ── Send a text message ───────────────────────────────────────────────────────

export async function sendWhatsApp(to, message) {
  if (!WA_TOKEN || !WA_PHONE_ID) throw new Error("WhatsApp credentials not configured");

  // Normalise number: strip spaces/dashes, ensure country code (no +)
  const number = to.replace(/[\s\-\(\)]/g, "").replace(/^\+/, "");

  const res = await fetch(WA_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WA_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: number,
      type: "text",
      text: { body: message },
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `WhatsApp API error ${res.status}`);
  return data.messages?.[0]?.id || "sent";
}

// ── Send a template message (for proactive notifications) ────────────────────
// Meta requires pre-approved templates for messages sent outside the 24-hr window.
// "hello_world" is pre-approved on all accounts for testing.

export async function sendWhatsAppTemplate(to, templateName = "hello_world", langCode = "en_US") {
  if (!WA_TOKEN || !WA_PHONE_ID) throw new Error("WhatsApp credentials not configured");
  const number = to.replace(/[\s\-\(\)]/g, "").replace(/^\+/, "");

  const res = await fetch(WA_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WA_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: number,
      type: "template",
      template: { name: templateName, language: { code: langCode } },
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `WhatsApp API error ${res.status}`);
  return data.messages?.[0]?.id || "sent";
}

// ── Mark a message as read ────────────────────────────────────────────────────

export async function markAsRead(messageId) {
  if (!WA_TOKEN || !WA_PHONE_ID) return;
  await fetch(WA_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WA_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      status: "read",
      message_id: messageId,
    }),
  }).catch(() => {});
}

// ── Webhook verification (GET) ────────────────────────────────────────────────

export function verifyWebhook(req, res) {
  const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || "voice_agent_webhook";
  const mode      = req.query["hub.mode"];
  const token     = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.status(403).send("Forbidden");
  }
}

// ── Parse incoming webhook payload → array of { from, messageId, text, type } ─

export function parseIncomingMessages(body) {
  const messages = [];
  try {
    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        const value = change.value;
        for (const msg of value.messages || []) {
          if (msg.type === "text") {
            messages.push({
              from: msg.from,           // sender's phone number
              messageId: msg.id,
              text: msg.text.body,
              type: "text",
              timestamp: msg.timestamp,
            });
          } else if (msg.type === "audio") {
            messages.push({
              from: msg.from,
              messageId: msg.id,
              text: "[Voice message — audio not transcribed]",
              type: "audio",
              timestamp: msg.timestamp,
            });
          }
          // ignore other types (image, video, etc.) for now
        }
      }
    }
  } catch { /* malformed payload */ }
  return messages;
}
