// Cross-sell offer library
// Each offer has:
//   id          – unique key
//   name        – short product name
//   pitch       – 1-sentence conversational pitch (spoken naturally by the agent)
//   triggers    – topics/keywords from session summaries that signal relevance
//   cooldownDays – don't re-present for N days after first presentation

export const OFFERS = [
  {
    id: "premium_weather",
    name: "Premium Weather Alerts",
    pitch: "By the way, since you check the weather often, you might love our Premium Weather Alerts — real-time severe weather notifications sent straight to your phone.",
    rebuttal: "I totally get it — but just so you know, last month our alerts helped users avoid three major storm events. It takes 30 seconds to set up and it's completely free for the first month.",
    triggers: ["weather", "rain", "forecast", "temperature", "humidity", "storm"],
    cooldownDays: 5,
  },
  {
    id: "stock_portfolio_tracker",
    name: "Portfolio Tracker",
    pitch: "Since you've been following stocks, our Portfolio Tracker can automatically monitor all your holdings and alert you when they hit your target prices.",
    rebuttal: "Fair enough — but imagine never missing a price target again. The Portfolio Tracker saved users an average of two hours a week on manual tracking. Worth a look when you're ready.",
    triggers: ["stock", "share", "nifty", "sensex", "market", "invest", "portfolio", "equity"],
    cooldownDays: 7,
  },
  {
    id: "news_digest",
    name: "Personalised News Digest",
    pitch: "You seem to follow the news closely — we have a Personalised News Digest that sends you a curated morning briefing based on topics you care about.",
    rebuttal: "No pressure at all — but our digest actually filters out clickbait and only surfaces verified stories. Most users say it saves them 45 minutes of news-scrolling every morning.",
    triggers: ["news", "headline", "article", "breaking", "politics", "economy", "sports news"],
    cooldownDays: 5,
  },
  {
    id: "language_learning",
    name: "Language Learning Pack",
    pitch: "Since you've been practising translations, our Language Learning Pack offers daily vocabulary challenges and pronunciation coaching in 30 languages.",
    rebuttal: "I understand — learning a language is a commitment. But our pack is just 5 minutes a day, and users typically hold a basic conversation within 3 weeks. It's very different from traditional apps.",
    triggers: ["translate", "translation", "language", "hindi", "spanish", "french", "german", "word", "meaning"],
    cooldownDays: 7,
  },
  {
    id: "sports_live_scores",
    name: "Live Sports Score Alerts",
    pitch: "As a sports fan, you'd love our Live Score Alerts — get notified the moment your favourite team scores, completely free.",
    rebuttal: "Totally fine — just thought you'd want to know it's free forever and covers over 50 leagues including IPL, Premier League, and the NBA. Nothing to lose by trying it.",
    triggers: ["cricket", "football", "ipl", "match", "score", "team", "player", "sports", "tournament"],
    cooldownDays: 5,
  },
  {
    id: "travel_planner",
    name: "Smart Travel Planner",
    pitch: "Since you've been asking about different cities and countries, our Smart Travel Planner can put together full itineraries with flights, hotels, and local tips in seconds.",
    rebuttal: "Of course — but the next time you're planning a trip, give it one try. Users typically save 3 to 4 hours of research, and it finds deals most booking sites miss.",
    triggers: ["travel", "trip", "holiday", "vacation", "flight", "hotel", "city", "country", "tourism", "visit"],
    cooldownDays: 7,
  },
  {
    id: "recipe_meal_plan",
    name: "Weekly Meal Planner",
    pitch: "You've been exploring recipes — our Weekly Meal Planner builds a full grocery list and step-by-step cooking schedule based on dishes you enjoy.",
    rebuttal: "Understood — but the coolest part is it adapts to what's already in your fridge and cuts your grocery bill by suggesting what to use up first. Might be worth a try next week.",
    triggers: ["recipe", "cook", "food", "meal", "ingredient", "dish", "cuisine", "kitchen"],
    cooldownDays: 5,
  },
  {
    id: "currency_alerts",
    name: "Currency Rate Alerts",
    pitch: "Since you track currency rates, our Currency Alert service pings you instantly when your target exchange rate is hit — great for travel or transfers.",
    rebuttal: "No worries — just keep in mind that rates can move 2 to 3 percent in a single day. Our alert fires the second your target is hit so you never miss the window.",
    triggers: ["currency", "exchange", "forex", "dollar", "euro", "rupee", "rate", "convert"],
    cooldownDays: 7,
  },
  {
    id: "trivia_quiz_club",
    name: "Daily Trivia Club",
    pitch: "You love trivia — our Daily Trivia Club sends you five fresh questions every morning with leaderboard rankings against other members.",
    rebuttal: "Fair — but our top players say it's genuinely addictive, and there are monthly prizes for the leaderboard leaders. Only 2 minutes a day and it keeps your mind sharp.",
    triggers: ["trivia", "quiz", "fact", "general knowledge", "question"],
    cooldownDays: 5,
  },
  {
    id: "whatsapp_assistant",
    name: "WhatsApp Assistant",
    pitch: "Did you know you can also reach me directly on WhatsApp? Just add our number and get all this help right in your chat.",
    rebuttal: "I get it — but it means you can ask me anything even when you're away from your laptop, no app needed. Just a WhatsApp message, anytime.",
    triggers: ["whatsapp", "message", "chat", "send", "contact", "phone"],
    cooldownDays: 14,
  },
];

/**
 * Given a list of session topics and a summary string,
 * return the IDs of offers whose triggers match.
 */
export function detectOpportunities(topics = [], summary = "") {
  const haystack = [...topics, summary].join(" ").toLowerCase();
  return OFFERS
    .filter(offer => offer.triggers.some(t => haystack.includes(t)))
    .map(offer => offer.id);
}

/** Look up an offer by ID */
export function getOffer(id) {
  return OFFERS.find(o => o.id === id) || null;
}
