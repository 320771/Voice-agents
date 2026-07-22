// Intent vector store using fastembed (all-MiniLM-L6-v2 dense embeddings)
// Covers English, Hinglish (transliterated), and Devanagari Hindi

import { FlagEmbedding, EmbeddingModel } from "fastembed";

// ── Training corpus ──────────────────────────────────────────────────────────
// [text, intent, param]  — param is a hint about which entity to extract

const TRAINING_DATA = [
  // WEATHER
  ["what is the weather in Mumbai",                  "weather", "Mumbai"],
  ["weather in Delhi today",                         "weather", "Delhi"],
  ["Mumbai ka weather batao",                        "weather", "Mumbai"],
  ["aaj Delhi mein kaisi garmi hai",                 "weather", "Delhi"],
  ["Bangalore mein barish ho rahi hai kya",          "weather", "Bangalore"],
  ["London ka mausam kaisa hai",                     "weather", "London"],
  ["Chennai weather forecast",                       "weather", "Chennai"],
  ["mausam batao",                                   "weather", ""],
  ["is it going to rain today",                      "weather", ""],
  ["should i carry an umbrella today",               "weather", ""],
  ["how cold is it outside",                         "weather", ""],
  ["temperature in Hyderabad",                       "weather", "Hyderabad"],
  ["New York ka temperature kya hai",                "weather", "New York"],
  ["kya aaj baarish hogi",                           "weather", ""],
  ["aaj ka mausam kaisa rahega",                     "weather", ""],
  ["Pune mein mausam kaisa hai",                     "weather", "Pune"],
  ["will it snow tomorrow in Shimla",                "weather", "Shimla"],
  ["how hot is it in Dubai",                         "weather", "Dubai"],
  ["Paris mein abhi kaisa mausam hai",               "weather", "Paris"],
  ["Tokyo weather today",                            "weather", "Tokyo"],
  ["Sydney temperature aaj kya hai",                 "weather", "Sydney"],
  ["is it sunny in Goa",                             "weather", "Goa"],
  ["chhata lana chahiye kya",                        "weather", ""],
  ["jacket chahiye kya aaj",                         "weather", ""],
  ["wind speed in Mumbai",                           "weather", "Mumbai"],
  ["humidity in Chennai today",                      "weather", "Chennai"],
  ["mausam theek hai kya",                           "weather", ""],
  ["barish ka mauka hai kya aaj",                    "weather", ""],
  ["मौसम कैसा है",                                   "weather", ""],
  ["मुंबई में बारिश होगी क्या",                      "weather", "Mumbai"],
  ["आज दिल्ली में ठंड है",                           "weather", "Delhi"],
  ["kolkata mein aaj barish hogi kya",               "weather", "Kolkata"],
  ["Jaipur weather batao please",                    "weather", "Jaipur"],
  ["what is the temperature outside right now",      "weather", ""],
  ["is it hot or cold in Singapore",                 "weather", "Singapore"],

  // NEWS
  ["latest news",                                    "news", ""],
  ["what is the news today",                         "news", ""],
  ["aaj ki khabar sunao",                            "news", ""],
  ["koi breaking news hai kya",                      "news", ""],
  ["duniya mein kya ho raha hai",                    "news", ""],
  ["top headlines today",                            "news", ""],
  ["news about India",                               "news", "India"],
  ["India mein kya ho raha hai latest",              "news", "India"],
  ["world news abhi kya hai",                        "news", ""],
  ["kya hua aaj duniya mein",                        "news", ""],
  ["samachar batao",                                 "news", ""],
  ["taza khabar kya hai",                            "news", ""],
  ["today's top stories",                            "news", ""],
  ["breaking news kya chal raha hai",                "news", ""],
  ["nayi khabar sunao",                              "news", ""],
  ["current events update",                          "news", ""],
  ["what happened today in the world",               "news", ""],
  ["anything important in news",                     "news", ""],
  ["headlines kya hain aaj",                         "news", ""],
  ["खबर बताओ",                                       "news", ""],
  ["आज की खबर",                                      "news", ""],
  ["दुनिया में क्या हो रहा है",                      "news", ""],
  ["latest updates se kya chal raha hai",            "news", ""],
  ["tell me what is happening in the world",         "news", ""],
  ["catch me up on the news",                        "news", ""],
  ["khabar batao",                                   "news", ""],
  ["khabar sunao",                                   "news", ""],
  ["khabar kya hai",                                 "news", ""],
  ["aaj ki taza khabar",                             "news", ""],
  ["news sunao",                                     "news", ""],
  ["koi nayi khabar hai",                            "news", ""],

  // STOCK
  ["what is Apple stock price",                      "stock", "Apple"],
  ["Apple ka share price kya hai",                   "stock", "Apple"],
  ["TSLA stock today",                               "stock", "TSLA"],
  ["Tesla ka price kya chal raha hai",               "stock", "Tesla"],
  ["Reliance share price batao",                     "stock", "Reliance"],
  ["Infosys stock market mein kaisa hai",            "stock", "Infosys"],
  ["sensex aaj kitna hai",                           "stock", "SENSEX"],
  ["nifty kya chal raha hai",                        "stock", "NIFTY"],
  ["Google stock price",                             "stock", "Google"],
  ["Microsoft ka share price",                       "stock", "Microsoft"],
  ["TCS ka share price batao",                       "stock", "TCS"],
  ["Wipro stock kya hai",                            "stock", "Wipro"],
  ["AAPL stock price today",                         "stock", "AAPL"],
  ["Amazon stock kitna hai",                         "stock", "Amazon"],
  ["Tata Motors share price kya hai",                "stock", "Tata Motors"],
  ["market mein kya chal raha hai",                  "stock", ""],
  ["share bazaar aaj kaisa hai",                     "stock", ""],
  ["how is the stock market today",                  "stock", ""],
  ["BSE kya chal raha hai",                          "stock", "BSE"],
  ["NSE pe kya ho raha hai",                         "stock", ""],
  ["शेयर बाज़ार कैसा है",                            "stock", ""],
  ["सेंसेक्स आज कितना है",                           "stock", "SENSEX"],
  ["HCL Technologies share price",                   "stock", "HCL"],
  ["Bajaj Finance stock today",                      "stock", "Bajaj Finance"],
  ["Meta stock kya chal raha hai",                   "stock", "Meta"],

  // SPORTS
  ["cricket score kya hai",                          "sports", "cricket"],
  ["India ka cricket match kaisa raha",              "sports", "India cricket"],
  ["IPL mein aaj kaun jeeta",                        "sports", "IPL"],
  ["Premier League results today",                   "sports", "Premier League"],
  ["kya India ne match jeeta",                       "sports", "India cricket"],
  ["latest football scores",                         "sports", "football"],
  ["NBA game results today",                         "sports", "NBA"],
  ["Virat Kohli ne kitne run banaye",                "sports", "cricket"],
  ["World Cup match result",                         "sports", "World Cup"],
  ["India vs Australia match",                       "sports", "India vs Australia"],
  ["Champions League kya hua",                       "sports", "Champions League"],
  ["F1 race result today",                           "sports", "F1"],
  ["Wimbledon tennis score",                         "sports", "tennis"],
  ["aaj ka cricket match score",                     "sports", "cricket"],
  ["sports news kya hai aaj",                        "sports", ""],
  ["khel ki khabar batao",                           "sports", ""],
  ["India vs Pakistan match kya hua",                "sports", "India vs Pakistan"],
  ["क्रिकेट स्कोर क्या है",                         "sports", "cricket"],
  ["आईपीएल में कौन जीता",                            "sports", "IPL"],
  ["Rohit Sharma ka score batao",                    "sports", "cricket"],
  ["football match aaj kaisa tha",                   "sports", "football"],
  ["badminton results today",                        "sports", "badminton"],
  ["Olympics mein India ne kya jeeta",               "sports", "Olympics India"],

  // WIKI
  ["who is Elon Musk",                               "wiki", "Elon Musk"],
  ["tell me about Mahatma Gandhi",                   "wiki", "Mahatma Gandhi"],
  ["what is quantum computing",                      "wiki", "quantum computing"],
  ["black hole kya hota hai",                        "wiki", "black hole"],
  ["explain machine learning",                       "wiki", "machine learning"],
  ["Albert Einstein kaun the",                       "wiki", "Albert Einstein"],
  ["Taj Mahal ka itihas batao",                      "wiki", "Taj Mahal"],
  ["French Revolution ke baare mein batao",          "wiki", "French Revolution"],
  ["what is artificial intelligence",                "wiki", "artificial intelligence"],
  ["who was Jawaharlal Nehru",                       "wiki", "Jawaharlal Nehru"],
  ["climate change kya hai",                         "wiki", "climate change"],
  ["how does the internet work",                     "wiki", "internet"],
  ["Bitcoin kya hota hai",                           "wiki", "Bitcoin"],
  ["Sachin Tendulkar ke baare mein batao",           "wiki", "Sachin Tendulkar"],
  ["Mount Everest ki height kitni hai",              "wiki", "Mount Everest"],
  ["what is DNA",                                    "wiki", "DNA"],
  ["Amazon river ke baare mein batao",               "wiki", "Amazon river"],
  ["history of World War 2",                         "wiki", "World War 2"],
  ["who invented the telephone",                     "wiki", "telephone"],
  ["कौन है एलन मस्क",                                "wiki", "Elon Musk"],
  ["महात्मा गांधी के बारे में बताओ",                 "wiki", "Mahatma Gandhi"],
  ["Solar System ke baare mein batao",               "wiki", "Solar System"],
  ["photosynthesis kya hoti hai",                    "wiki", "photosynthesis"],
  ["Indian Constitution kab bana",                   "wiki", "Indian Constitution"],
  ["who is the president of USA",                    "wiki", "president of USA"],
  ["gravity kya hoti hai",                           "wiki", "gravity"],
  ["tell me about the Great Wall of China",          "wiki", "Great Wall of China"],

  // WHATSAPP
  ["send WhatsApp to 919876543210 saying hello",         "whatsapp", "919876543210::hello"],
  ["WhatsApp message to John saying I'll be late",       "whatsapp", ""],
  ["send a WhatsApp to my number",                       "whatsapp", ""],
  ["WhatsApp karo message bhejo",                        "whatsapp", ""],
  ["send WhatsApp message",                              "whatsapp", ""],
  ["message on WhatsApp",                                "whatsapp", ""],
  ["drop a WhatsApp to 918888888888 saying meeting at 5","whatsapp", "918888888888::meeting at 5"],
  ["WhatsApp bhejo",                                     "whatsapp", ""],
  ["send WA message",                                    "whatsapp", ""],
  ["text on WhatsApp",                                   "whatsapp", ""],

  // NONE
  ["hello",                                          "none", ""],
  ["hi there",                                       "none", ""],
  ["how are you",                                    "none", ""],
  ["kya haal hai",                                   "none", ""],
  ["what is 5 plus 3",                               "none", ""],
  ["tell me a joke",                                 "none", ""],
  ["mujhe ek joke sunao",                            "none", ""],
  ["thanks",                                         "none", ""],
  ["shukriya",                                       "none", ""],
  ["good morning",                                   "none", ""],
  ["can you help me",                                "none", ""],
  ["who are you",                                    "none", ""],
  ["tum kaun ho",                                    "none", ""],
  ["what can you do",                                "none", ""],
  ["ok",                                             "none", ""],
  ["got it",                                         "none", ""],
  ["what day is today",                              "none", ""],
  ["aaj kaunsa din hai",                             "none", ""],
  ["set a reminder",                                 "none", ""],
  ["play some music",                                "none", ""],
];

// ── Param extractors ──────────────────────────────────────────────────────────

const PARAM_EXTRACTORS = {
  weather: (text) => {
    const p = [
      /([A-Za-z]{3,25})\s+(?:ka|ki|ke|mein)\s+(?:weather|mausam|temperature|barish|baarish)/i,
      /(?:weather|mausam|temperature|forecast|barish|baarish)\s+(?:in|at|for|ka|mein)\s+([A-Za-z]{3,25})/i,
      /\b(?:in|at|for)\s+([A-Z][a-z]{2,20})\b/,
      /([A-Z][a-z]{2,20}(?:\s+[A-Z][a-z]{2,20})?)\s+(?:weather|mausam)/i,
    ];
    for (const rx of p) { const m = text.match(rx); if (m?.[1]?.trim().length > 2) return m[1].trim(); }
    return "";
  },
  news: (text) => {
    return text.match(/news (?:about|on|regarding)\s+(.+?)(?:\?|$)/i)?.[1]?.trim() ||
           text.match(/khabar (?:ke baare mein|about)\s+(.+?)(?:\?|$)/i)?.[1]?.trim() || "";
  },
  stock: (text) => {
    // "$TSLA" ticker
    const ticker = text.match(/\$([A-Z]{2,5})\b/)?.[1];
    if (ticker) return ticker;
    // "Apple ka share" — entity comes BEFORE "ka share/stock"
    const before = text.match(/([A-Za-z][A-Za-z\s]{1,20}?)\s+(?:ka|ki|ke)\s+(?:share|stock|price)/i)?.[1]?.trim();
    if (before) return before;
    // "stock of Apple" / "share price of TCS"
    const after = text.match(/(?:stock|share|price)\s+(?:of|for|ka|ke|ki)?\s*([A-Za-z][A-Za-z\s]{1,20}?)(?:\s+(?:kya|hai|kitna|batao|\?|$))/i)?.[1]?.trim();
    if (after) return after;
    // ALL-CAPS ticker: AAPL, TCS, TSLA
    const caps = text.match(/\b([A-Z]{2,6})\b/)?.[1];
    if (caps && !["KYA","HAI","KA","KE","KI","AUR","MEI","PE"].includes(caps)) return caps;
    return "";
  },
  sports: (text) => {
    // "India vs Pakistan" style
    const vs = text.match(/([A-Za-z\s]+?)\s+vs\s+([A-Za-z\s]+?)(?:\?|$|match|mein)/i);
    if (vs) return `${vs[1].trim()} vs ${vs[2].trim()}`;
    // Named sport/team/league
    const named = text.match(/\b(cricket|football|soccer|basketball|tennis|IPL|NBA|NFL|Premier League|Champions League|World Cup|F1|badminton|hockey|rugby|Olympics)\b/i);
    if (named) return named[1];
    return "";
  },
  whatsapp: (text) => {
    // Extract number and message: "send WhatsApp to 91XXXXXXXXXX saying <msg>"
    const m = text.match(/(?:to|ko)\s+([\d\s\+\-]{7,15})\s+(?:saying|message|saying that|with|bolo|bolke|likhke)\s+(.+)/i);
    if (m) return `${m[1].replace(/\s/g, "")}::${m[2].trim()}`;
    // Just a number with no message
    const num = text.match(/(?:to|ko)\s+([\d\+]{10,15})/i)?.[1];
    if (num) return `${num}::`;
    return "";
  },
  wiki: (text) => {
    const stopPhrases = /who is|who was|what is|what are|tell me about|explain|wikipedia|history of|biography of|definition of|meaning of|how does|how did|what does|where is|when was|why is|give me information about|i want to know about|describe|facts about|what happened in|background on|kaun hai|kya hai|ke baare mein batao|ke baare mein|itihas|kya hota hai|matlab kya hai|kaise kaam karta hai|kahan hai|kab hua|kyon hai|jaankari do|information do|explain karo|bata do|batao|kaun the/gi;
    return text.replace(stopPhrases, "").replace(/[?]/g, "").trim() || "";
  },
};

// ── Vector Store ──────────────────────────────────────────────────────────────

let embedder = null;
let vectorStore = null; // [{ vec: Float32Array, intent, param }]

function cosineSim(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na  += a[i] * a[i];
    nb  += b[i] * b[i];
  }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

// Call once at server startup — builds the in-memory vector store
export async function buildVectorStore() {
  embedder = await FlagEmbedding.init({
    model: EmbeddingModel.AllMiniLML6V2,
  });

  const texts = TRAINING_DATA.map(([text]) => text);
  const embeddings = [];
  for await (const batch of embedder.embed(texts, 32)) {
    for (const vec of batch) embeddings.push(Float32Array.from(vec));
  }

  vectorStore = TRAINING_DATA.map(([text, intent, param], i) => ({
    vec: embeddings[i],
    intent,
    param,
    text,
  }));

  console.log(`[intent] Vector store built: ${vectorStore.length} examples, dim=${vectorStore[0].vec.length}`);
}

// Query the vector store — returns { intent, param, score }
export async function vectorDetectIntent(text) {
  if (!vectorStore || !embedder) throw new Error("Vector store not initialised");

  const qVecs = [];
  for await (const batch of embedder.embed([text], 1)) {
    for (const v of batch) qVecs.push(Float32Array.from(v));
  }
  const qVec = qVecs[0];

  let best = { score: -1, intent: "none", param: "" };
  for (const entry of vectorStore) {
    const score = cosineSim(qVec, entry.vec);
    if (score > best.score) best = { score, intent: entry.intent, param: entry.param };
  }

  // Low-confidence fallback
  if (best.score < 0.35) return { intent: "none", param: "", score: best.score };

  // Re-extract param from the live user text (training param is just a hint)
  const extractor = PARAM_EXTRACTORS[best.intent];
  const param = extractor ? (extractor(text) || best.param) : best.param;

  return { intent: best.intent, param, score: best.score };
}
