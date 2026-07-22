// Intent phrase library — English + Hindi (transliterated & Devanagari)
// Each entry: { phrase, intent, extractParam: fn | null }

export const INTENT_LIBRARY = {
  weather: {
    // English
    en: [
      "weather", "temperature", "forecast", "climate", "rain", "raining", "rainfall",
      "sunny", "sunshine", "cloudy", "clouds", "cold", "hot", "humid", "humidity",
      "wind", "windy", "storm", "thunderstorm", "snow", "snowing", "hail",
      "what's it like outside", "how's the weather", "will it rain", "should i carry umbrella",
      "umbrella today", "jacket today", "is it cold outside", "is it hot outside",
      "today's weather", "weather today", "weather tomorrow", "weather this week",
      "heat wave", "feels like", "dew point"
    ],
    // Hindi transliterated
    hi_translit: [
      "mausam", "barish", "baarish", "garmi", "sardi", "thand", "dhoop",
      "badal", "baadal", "toofan", "baarish hogi", "mausam kaisa hai",
      "aaj ka mausam", "kal ka mausam", "temperature kya hai", "kitni garmi hai",
      "kitni sardi hai", "mausam batao", "weather batao", "baarish hogi kya",
      "chhata chahiye kya", "jacket leni chahiye", "mausam theek hai kya",
      "aaj baarish hogi", "barish hogi kya aaj", "garam hai", "thanda hai"
    ],
    // Hindi Devanagari
    hi_dev: [
      "मौसम", "बारिश", "वर्षा", "गर्मी", "सर्दी", "ठंड", "धूप",
      "बादल", "तूफान", "आज का मौसम", "कल का मौसम", "तापमान",
      "मौसम कैसा है", "बारिश होगी"
    ],
    // Param extraction: try to find city name after location words
    extractParam: (text) => {
      const t = text.toLowerCase();
      const patterns = [
        /(?:weather|mausam|temperature|forecast|barish|baarish)\s+(?:in|at|for|ka|mein|में)\s+([a-zA-Zऀ-ॿ\s]{2,30?})(?:\?|$|,|\.|please|batao)/i,
        /(?:in|at|for|ka|mein|में)\s+([a-zA-Zऀ-ॿ]{3,20})\s+(?:weather|mausam|ka|mein)/i,
        /(?:in|at|for|ka|mein|में)\s+([a-zA-Zऀ-ॿ]{3,20})(?:\?|$|,|\.)/i,
        /([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})?)\s+(?:weather|mausam)/i,
      ];
      for (const p of patterns) {
        const m = text.match(p);
        if (m?.[1]?.trim()) return m[1].trim();
      }
      return null;
    }
  },

  news: {
    en: [
      "news", "headline", "headlines", "latest news", "breaking news", "top stories",
      "what's happening", "what is happening", "current events", "today's news",
      "news update", "news about", "tell me news", "any news", "whats in the news",
      "world news", "local news", "recent news", "latest updates", "what happened today",
      "anything new", "catch me up"
    ],
    hi_translit: [
      "khabar", "khabaren", "samachar", "taza khabar", "aaj ki khabar", "news batao",
      "kya hua", "kya ho raha hai", "desh mein kya ho raha hai", "aaj kya hua",
      "nayi khabar", "breaking news kya hai", "khabar sunao", "samachar batao",
      "headline kya hai", "duniya mein kya ho raha hai"
    ],
    hi_dev: [
      "खबर", "खबरें", "समाचार", "ताज़ा खबर", "आज की खबर", "क्या हुआ",
      "क्या हो रहा है", "नई खबर", "हेडलाइन"
    ],
    extractParam: (text) => {
      const m =
        text.match(/news (?:about|on|regarding|ke baare mein)\s+(.+?)(?:\?|$)/i)?.[1] ||
        text.match(/khabar (?:about|on|ke baare mein)\s+(.+?)(?:\?|$)/i)?.[1] ||
        "";
      return m.trim();
    }
  },

  stock: {
    en: [
      "stock", "stocks", "share price", "share", "shares", "market", "equity",
      "nasdaq", "nyse", "sensex", "nifty", "bse", "nse", "dow jones",
      "stock price", "stock market", "how is", "trading at", "market cap",
      "invest", "investment", "portfolio", "bull", "bear", "ipo",
      "apple stock", "google stock", "tesla stock", "amazon stock", "microsoft stock",
      "infosys stock", "tcs stock", "reliance stock", "wipro stock"
    ],
    hi_translit: [
      "share price", "share kya hai", "share market", "stock kya hai", "sensex kya hai",
      "nifty kya hai", "bazar", "bazaar", "share bazaar", "stock kitna hai",
      "company ka share", "invest karna chahta", "market upar hai", "market neeche hai",
      "share price batao", "kaunsa stock lena chahiye"
    ],
    hi_dev: [
      "शेयर", "स्टॉक", "बाज़ार", "शेयर बाज़ार", "सेंसेक्स", "निफ्टी",
      "शेयर कीमत", "निवेश"
    ],
    extractParam: (text) => {
      // ticker symbol
      const ticker = text.match(/\$([A-Z]{2,5})\b/)?.[1] ||
        text.match(/\b([A-Z]{2,5})\b(?=\s+stock|\s+share)/)?.[1];
      if (ticker) return ticker;
      // company name
      const company = text.match(/(?:stock|share|price)\s+(?:of|for|ka|ke|ki)?\s*([A-Za-z]+(?:\s+[A-Za-z]+)?)/i)?.[1] ||
        text.match(/([A-Za-z]+(?:\s+[A-Za-z]+)?)\s+(?:stock|share|ka share|ki price)/i)?.[1];
      return company?.trim() || null;
    }
  },

  sports: {
    en: [
      "sport", "sports", "cricket", "football", "soccer", "basketball", "tennis",
      "baseball", "hockey", "rugby", "golf", "badminton", "volleyball",
      "ipl", "nba", "nfl", "premier league", "la liga", "bundesliga", "serie a",
      "world cup", "champions league", "score", "scorecard", "match result",
      "who won", "did india win", "game result", "live score", "match today",
      "tournament", "championship", "league table", "standings", "fixtures",
      "player stats", "team score", "latest score", "sports news"
    ],
    hi_translit: [
      "cricket", "cricket ka score", "match kaisa raha", "india ne jeeta kya",
      "ipl mein kaun jeeta", "football", "khel", "score kya hai", "match result batao",
      "india cricket", "india ka match", "kohli ne kitne run banaye",
      "sports khabar", "khel ki khabar", "kaunsa team jeeta"
    ],
    hi_dev: [
      "क्रिकेट", "फुटबॉल", "खेल", "स्कोर", "मैच", "आईपीएल",
      "विश्व कप", "भारत ने जीता", "मैच का नतीजा"
    ],
    extractParam: (text) => {
      const q = text.match(/(?:about|on|in|ka|ke|ki|mein)\s+([a-zA-Z\s]+?)(?:\?|$)/i)?.[1] || "";
      return q.trim();
    }
  },

  wiki: {
    en: [
      "who is", "who was", "what is", "what are", "tell me about", "explain",
      "wikipedia", "history of", "biography of", "definition of", "meaning of",
      "how does", "how did", "what does", "where is", "when was", "why is",
      "give me information about", "i want to know about", "describe",
      "facts about", "what happened in", "background on"
    ],
    hi_translit: [
      "kaun hai", "kya hai", "batao", "ke baare mein batao", "itihas",
      "wikipedia pe", "wikipedia mein", "kya hota hai", "matlab kya hai",
      "kaise kaam karta hai", "kahan hai", "kab hua", "kyon hai",
      "jaankari do", "information do", "explain karo", "bata do"
    ],
    hi_dev: [
      "कौन है", "क्या है", "बताओ", "के बारे में", "इतिहास",
      "विकिपीडिया", "क्या होता है", "मतलब क्या है", "जानकारी दो"
    ],
    extractParam: (text) => {
      const cleaned = text
        .replace(/who is|who was|what is|what are|tell me about|explain|wikipedia|history of|biography of|definition of|meaning of|how does|how did|what does|where is|when was|why is|give me information about|i want to know about|describe|facts about|what happened in|background on/gi, "")
        .replace(/kaun hai|kya hai|batao|ke baare mein batao|itihas|kya hota hai|matlab kya hai|kaise kaam karta hai|kahan hai|kab hua|kyon hai|jaankari do|information do|explain karo|bata do/gi, "")
        .replace(/[?]/g, "").trim();
      return cleaned || null;
    }
  }
};

// Score text against an intent's phrase library
function scoreIntent(text, intentData) {
  const t = text.toLowerCase();
  const allPhrases = [
    ...intentData.en,
    ...intentData.hi_translit,
    ...intentData.hi_dev,
  ];
  let score = 0;
  for (const phrase of allPhrases) {
    if (t.includes(phrase.toLowerCase())) {
      // longer matches score higher
      score += phrase.split(" ").length;
    }
  }
  return score;
}

// Fast local intent detection — returns { intent, param } or null if unsure
export function localDetectIntent(text) {
  const scores = {};
  let best = { intent: "none", score: 0 };

  for (const [intentName, intentData] of Object.entries(INTENT_LIBRARY)) {
    const s = scoreIntent(text, intentData);
    scores[intentName] = s;
    if (s > best.score) best = { intent: intentName, score: s };
  }

  if (best.score === 0) return null; // no match — let Claude decide

  const intentData = INTENT_LIBRARY[best.intent];
  const param = intentData.extractParam ? intentData.extractParam(text) : null;
  return { intent: best.intent, param: param || "", score: best.score };
}
