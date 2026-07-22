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
  ["what's the weather like today",                  "weather", ""],
  ["how's the weather in Delhi right now",           "weather", "Delhi"],
  ["check weather Mumbai",                           "weather", "Mumbai"],
  ["weather Delhi",                                  "weather", "Delhi"],
  ["tell me the current weather in London",          "weather", "London"],
  ["can you please tell me the weather in Paris",    "weather", "Paris"],
  ["what's the temperature outside",                 "weather", ""],
  ["bro what's the temp in Delhi",                   "weather", "Delhi"],
  ["I want to know if it's raining in Bangalore",    "weather", "Bangalore"],
  ["will I need an umbrella today",                  "weather", ""],
  ["give me a weather update for New York",          "weather", "New York"],
  ["what does the forecast look like for tomorrow",  "weather", ""],
  ["weather update please",                          "weather", ""],
  ["what's the weather like over there in Tokyo",    "weather", "Tokyo"],
  ["current weather conditions in Chennai",          "weather", "Chennai"],
  ["should I carry a jacket today",                  "weather", ""],
  ["mausam kaisa hai aaj",                           "weather", ""],
  ["Mumbai mein mausam kaisa hai",                   "weather", "Mumbai"],
  ["aaj barish hogi kya",                            "weather", ""],
  ["Delhi ka weather kya hai",                       "weather", "Delhi"],
  ["kal ka mausam batao",                            "weather", ""],
  ["kya aaj dhoop niklegi",                          "weather", ""],
  ["Bangalore mein abhi kitni garmi hai",            "weather", "Bangalore"],
  ["mujhe aaj ke mausam ki jaankari chahiye",        "weather", ""],
  ["क्या आज बारिश होगी",                             "weather", ""],
  ["मौसम कैसा है आज",                                "weather", ""],
  ["दिल्ली का मौसम बताओ",                            "weather", "Delhi"],
  ["आज कितनी ठंड है",                                "weather", ""],
  ["मुंबई में मौसम कैसा है",                         "weather", "Mumbai"],
  ["कल का मौसम कैसा रहेगा",                          "weather", ""],
  ["क्या धूप निकलेगी आज",                            "weather", ""],

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
  ["what's in the news today",                       "news", ""],
  ["show me the latest news",                        "news", ""],
  ["give me today's top headlines",                  "news", ""],
  ["any breaking news",                              "news", ""],
  ["news update please",                             "news", ""],
  ["tell me the latest tech news",                   "news", "technology"],
  ["what's going on in politics",                    "news", "politics"],
  ["catch me up on cricket news",                    "news", "cricket"],
  ["I want to hear the business headlines",          "news", "business"],
  ["give me sports news",                            "news", "sports"],
  ["latest news on climate change",                  "news", "climate change"],
  ["what's new in the world of AI",                  "news", "AI"],
  ["read me the headlines",                          "news", ""],
  ["any big news today bro",                         "news", ""],
  ["fill me in on what's happening",                 "news", ""],
  ["world news today",                               "news", ""],
  ["entertainment news chahiye",                     "news", "entertainment"],
  ["news kya hai aaj ka",                            "news", ""],
  ["cricket ki latest khabar do",                    "news", "cricket"],
  ["desh mein kya chal raha hai",                    "news", ""],
  ["political news sunao",                           "news", "politics"],
  ["technology ke baare mein news chahiye",          "news", "technology"],
  ["business news update do",                        "news", "business"],
  ["आज की खबर क्या है",                              "news", ""],
  ["ताज़ा समाचार बताओ",                               "news", ""],
  ["देश में क्या हो रहा है",                          "news", ""],
  ["राजनीति की खबर सुनाओ",                           "news", "politics"],
  ["क्रिकेट की ताज़ा खबर",                            "news", "cricket"],
  ["आज के मुख्य समाचार",                              "news", ""],

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
  ["what's the stock price of Apple",                "stock", "Apple"],
  ["how is Tesla stock doing",                       "stock", "Tesla"],
  ["check AAPL share price",                         "stock", "AAPL"],
  ["what is Reliance Industries trading at",         "stock", "Reliance Industries"],
  ["give me the current price of Google stock",      "stock", "Google"],
  ["how much is Amazon stock worth today",           "stock", "Amazon"],
  ["is Infosys stock up or down today",              "stock", "Infosys"],
  ["what happened to TCS stock today",               "stock", "TCS"],
  ["check Nifty 50 levels",                          "stock", "Nifty 50"],
  ["give me a stock update for Microsoft",           "stock", "Microsoft"],
  ["what's HDFC Bank trading at",                    "stock", "HDFC Bank"],
  ["how's Sensex performing today",                  "stock", "Sensex"],
  ["bro Tesla ka kya bhav hai",                      "stock", "Tesla"],
  ["Reliance ka share price kya hai",                "stock", "Reliance"],
  ["aaj market kaisa chal raha hai",                 "stock", ""],
  ["Infosys ka stock kitne mein hai",                "stock", "Infosys"],
  ["TCS ka share aaj kitne pe hai",                  "stock", "TCS"],
  ["AAPL kitne dollar mein hai abhi",                "stock", "AAPL"],
  ["market ka haal batao",                           "stock", ""],
  ["Sensex aaj kitna hai",                           "stock", "Sensex"],
  ["रिलायंस का शेयर प्राइस क्या है",                 "stock", "Reliance"],
  ["आज मार्केट कैसा है",                              "stock", ""],
  ["टीसीएस का शेयर कितने में है",                    "stock", "TCS"],
  ["इन्फोसिस का स्टॉक बताओ",                         "stock", "Infosys"],
  ["निफ्टी का हाल बताओ",                              "stock", "Nifty 50"],
  ["बाज़ार का क्या हाल है",                           "stock", ""],

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
  ["what's the cricket score",                       "sports", "cricket"],
  ["how did India do in the match last night",       "sports", "cricket"],
  ["who won the IPL match yesterday",                "sports", "IPL"],
  ["what's the tennis score at Wimbledon",           "sports", "tennis"],
  ["NBA scores today",                               "sports", "NBA"],
  ["how is Manchester United performing this season","sports", "Manchester United"],
  ["tell me about the F1 race results",              "sports", "F1"],
  ["did India win the test match",                   "sports", "cricket"],
  ["latest sports update",                           "sports", ""],
  ["who's leading the Premier League",               "sports", "Premier League"],
  ["what happened in the Champions League last night","sports","Champions League"],
  ["WWE results from last night",                    "sports", "WWE"],
  ["bro yaar India ka score kya tha",                "sports", "cricket"],
  ["IPL mein kaun jeeta",                            "sports", "IPL"],
  ["cricket ka score batao",                         "sports", "cricket"],
  ["football ki latest khabar",                      "sports", "football"],
  ["India ne match jeeta ya haara",                  "sports", "cricket"],
  ["aaj ka match kaun jeeta",                        "sports", ""],
  ["F1 race ka result kya tha",                      "sports", "F1"],
  ["Manchester United ka kya haal hai",              "sports", "Manchester United"],
  ["kya India World Cup ke liye qualify kiya",       "sports", "cricket"],
  ["kabaddi ka score kya hai",                       "sports", "kabaddi"],
  ["क्रिकेट का स्कोर क्या है",                      "sports", "cricket"],
  ["भारत ने मैच जीता या हारा",                       "sports", "cricket"],
  ["आईपीएल में कौन जीता",                            "sports", "IPL"],
  ["फुटबॉल के लेटेस्ट नतीजे बताओ",                  "sports", "football"],
  ["आज का खेल समाचार",                               "sports", ""],
  ["भारत का स्कोर बताओ",                             "sports", "cricket"],
  ["एफ वन रेस का रिजल्ट क्या था",                   "sports", "F1"],

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
  ["tell me about the Taj Mahal",                    "wiki", "Taj Mahal"],
  ["give me information about the French Revolution","wiki", "French Revolution"],
  ["what's the history of the Roman Empire",         "wiki", "Roman Empire"],
  ["what is the Amazon rainforest",                  "wiki", "Amazon rainforest"],
  ["who was Mahatma Gandhi",                         "wiki", "Mahatma Gandhi"],
  ["give me a quick rundown on Bitcoin",             "wiki", "Bitcoin"],
  ["what is the theory of relativity",               "wiki", "theory of relativity"],
  ["I want to know about the Himalayas",             "wiki", "Himalayas"],
  ["what are black holes",                           "wiki", "black holes"],
  ["tell me about World War 2",                      "wiki", "World War 2"],
  ["describe the solar system to me",                "wiki", "solar system"],
  ["what's the deal with cryptocurrency",            "wiki", "cryptocurrency"],
  ["Elon Musk kaun hai",                             "wiki", "Elon Musk"],
  ["Taj Mahal ke baare mein batao",                  "wiki", "Taj Mahal"],
  ["artificial intelligence kya hoti hai",           "wiki", "artificial intelligence"],
  ["Mahatma Gandhi ki jankari do",                   "wiki", "Mahatma Gandhi"],
  ["Bitcoin kya hai",                                "wiki", "Bitcoin"],
  ["Himalayas ke baare mein kuch batao",             "wiki", "Himalayas"],
  ["machine learning samjhao mujhe",                 "wiki", "machine learning"],
  ["ताज महल के बारे में बताओ",                       "wiki", "Taj Mahal"],
  ["महात्मा गांधी कौन थे",                           "wiki", "Mahatma Gandhi"],
  ["क्वांटम कंप्यूटिंग क्या है",                     "wiki", "quantum computing"],
  ["ब्लैक होल क्या होते हैं",                        "wiki", "black holes"],
  ["हिमालय के बारे में जानकारी दो",                  "wiki", "Himalayas"],
  ["बिटकॉइन क्या है",                                "wiki", "Bitcoin"],

  // TRANSLATE
  ["translate hello to French",                          "translate", "fr::hello"],
  ["translate this to Hindi",                            "translate", "hi::"],
  ["how do you say thank you in Spanish",                "translate", "es::thank you"],
  ["translate good morning to Japanese",                 "translate", "ja::good morning"],
  ["anuvad karo Hindi mein",                             "translate", "hi::"],
  ["translate to German: where is the station",          "translate", "de::where is the station"],
  ["translate namaste to English",                       "translate", "en::namaste"],
  ["French mein kaise bolte hain I love you",            "translate", "fr::I love you"],
  ["translate hello to Hindi",                           "translate", "hi::hello"],
  ["how do you say good morning in German",              "translate", "de::good morning"],
  ["translate I love you to Japanese",                   "translate", "ja::I love you"],
  ["say goodbye in German",                              "translate", "de::goodbye"],
  ["translate where is the bathroom to French",          "translate", "fr::where is the bathroom"],
  ["how do you say sorry in Arabic",                     "translate", "ar::sorry"],
  ["what's the Hindi word for friendship",               "translate", "hi::friendship"],
  ["translate nice to meet you to Spanish",              "translate", "es::nice to meet you"],
  ["tell me how to say water in Japanese",               "translate", "ja::water"],
  ["what is happy birthday in German",                   "translate", "de::happy birthday"],
  ["translate please in Arabic",                         "translate", "ar::please"],
  ["thank you ko Hindi mein kya kehte hain",             "translate", "hi::thank you"],
  ["Spanish mein please kaise kehte hain",               "translate", "es::please"],
  ["Japanese mein namaste kaise bolte hain",             "translate", "ja::namaste"],
  ["Arabic mein hello kya hota hai",                     "translate", "ar::hello"],
  ["I love you ko French mein translate karo",           "translate", "fr::I love you"],
  ["फ्रेंच में हैलो कैसे कहते हैं",                     "translate", "fr::hello"],
  ["जापानी में धन्यवाद कैसे बोलते हैं",                 "translate", "ja::thank you"],
  ["स्पेनिश में अलविदा क्या होता है",                   "translate", "es::goodbye"],
  ["हिंदी में sorry कैसे कहें",                          "translate", "hi::sorry"],
  ["जर्मन में good night का अनुवाद",                     "translate", "de::good night"],
  ["अरबी में पानी को क्या कहते हैं",                    "translate", "ar::water"],

  // DICTIONARY
  ["what does ephemeral mean",                           "dictionary", "ephemeral"],
  ["define serendipity",                                 "dictionary", "serendipity"],
  ["meaning of ubiquitous",                              "dictionary", "ubiquitous"],
  ["definition of eloquent",                             "dictionary", "eloquent"],
  ["word meaning of resilience",                         "dictionary", "resilience"],
  ["what is the meaning of melancholy",                  "dictionary", "melancholy"],
  ["matlab kya hai gratitude ka",                        "dictionary", "gratitude"],
  ["dictionary mein dekho perseverance",                 "dictionary", "perseverance"],
  ["what is the meaning of ubiquitous",                  "dictionary", "ubiquitous"],
  ["look up the word melancholy",                        "dictionary", "melancholy"],
  ["dictionary meaning of perseverance",                 "dictionary", "perseverance"],
  ["what does juxtaposition mean",                       "dictionary", "juxtaposition"],
  ["tell me the definition of ambiguous",                "dictionary", "ambiguous"],
  ["explain the word paradigm",                          "dictionary", "paradigm"],
  ["how would you define resilience",                    "dictionary", "resilience"],
  ["what's the definition of entropy",                   "dictionary", "entropy"],
  ["I don't know what taciturn means",                   "dictionary", "taciturn"],
  ["can you look up the word cognitive",                 "dictionary", "cognitive"],
  ["give me the meaning of altruism",                    "dictionary", "altruism"],
  ["what exactly does sycophant mean",                   "dictionary", "sycophant"],
  ["ephemeral ka matlab kya hai",                        "dictionary", "ephemeral"],
  ["serendipity ka arth batao",                          "dictionary", "serendipity"],
  ["resilience ka meaning kya hota hai",                 "dictionary", "resilience"],
  ["ambiguous ka kya matlab hai",                        "dictionary", "ambiguous"],
  ["paradigm ka arth kya hai",                           "dictionary", "paradigm"],
  ["yaar ubiquitous ka matlab kya hai bhai",             "dictionary", "ubiquitous"],
  ["entropy ki definition batao",                        "dictionary", "entropy"],
  ["altruism शब्द का अर्थ क्या है",                     "dictionary", "altruism"],
  ["ephemeral का मतलब क्या होता है",                    "dictionary", "ephemeral"],
  ["serendipity की परिभाषा बताओ",                       "dictionary", "serendipity"],
  ["resilience का अर्थ क्या है",                        "dictionary", "resilience"],
  ["cognitive का मतलब समझाओ",                           "dictionary", "cognitive"],
  ["paradigm शब्द का मतलब",                             "dictionary", "paradigm"],

  // JOKE
  ["tell me a joke",                                     "joke", ""],
  ["make me laugh",                                      "joke", ""],
  ["say something funny",                                "joke", ""],
  ["joke sunao",                                         "joke", ""],
  ["mujhe hasao",                                        "joke", ""],
  ["tell me a Chuck Norris joke",                        "joke", "chuck norris"],
  ["ek majedar joke sunao",                              "joke", ""],
  ["funny joke batao",                                   "joke", ""],
  ["I could use a good laugh",                           "joke", ""],
  ["got any jokes",                                      "joke", ""],
  ["crack a joke please",                                "joke", ""],
  ["cheer me up with a joke",                            "joke", ""],
  ["give me your best joke",                             "joke", ""],
  ["do you know any good jokes",                         "joke", ""],
  ["tell me a funny one",                                "joke", ""],
  ["yaar koi joke sunao",                                "joke", ""],
  ["kuch funny bolo",                                    "joke", ""],
  ["ek chutkula sunao",                                  "joke", ""],
  ["give me a Chuck Norris fact",                        "joke", "chuck norris"],
  ["bro hit me with a Chuck Norris joke",                "joke", "chuck norris"],
  ["Chuck Norris ke baare mein joke sunao",              "joke", "chuck norris"],
  ["कोई जोक सुनाओ",                                     "joke", ""],
  ["मुझे हंसाओ",                                         "joke", ""],
  ["कोई मज़ेदार बात बताओ",                               "joke", ""],
  ["एक चुटकुला सुनाओ",                                  "joke", ""],
  ["कुछ फनी बोलो",                                      "joke", ""],
  ["चक नॉरिस का जोक सुनाओ",                             "joke", "chuck norris"],
  ["yaar mujhe ek acha sa joke chahiye",                 "joke", ""],

  // CURRENCY
  ["convert 100 USD to INR",                             "currency", "USD::INR::100"],
  ["1 dollar kitne rupaye ka hai",                       "currency", "USD::INR::1"],
  ["exchange rate USD to EUR",                           "currency", "USD::EUR::1"],
  ["how much is 500 pounds in rupees",                   "currency", "GBP::INR::500"],
  ["dollar to rupee rate today",                         "currency", "USD::INR::1"],
  ["50 euros in Indian rupees",                          "currency", "EUR::INR::50"],
  ["currency convert GBP to USD",                       "currency", "GBP::USD::1"],
  ["aaj ka dollar rate kya hai",                         "currency", "USD::INR::1"],
  ["convert 100 dollars to rupees",                      "currency", "USD::INR::100"],
  ["what is 50 euros in Indian rupees",                  "currency", "EUR::INR::50"],
  ["how much is 1000 rupees in USD",                     "currency", "INR::USD::1000"],
  ["exchange rate from dollars to pounds",               "currency", "USD::GBP::1"],
  ["convert 200 British pounds to euros",                "currency", "GBP::EUR::200"],
  ["how many rupees is 500 dollars",                     "currency", "USD::INR::500"],
  ["what's the dollar to rupee rate today",              "currency", "USD::INR::1"],
  ["convert 1000 yen to dollars",                        "currency", "JPY::USD::1000"],
  ["how much is 100 AED in rupees",                      "currency", "AED::INR::100"],
  ["5000 rupees in euros kitne hote hain",               "currency", "INR::EUR::5000"],
  ["100 dollar kitne rupee mein milenge",                "currency", "USD::INR::100"],
  ["dollar aur rupee ka exchange rate kya hai",          "currency", "USD::INR::1"],
  ["200 pound ko rupaye mein convert karo",              "currency", "GBP::INR::200"],
  ["1000 rupaye kitne dollar ke barabar hain",           "currency", "INR::USD::1000"],
  ["euro aur rupee ka rate kya hai aaj",                 "currency", "EUR::INR::1"],
  ["50 dirham kitne rupaye hote hain",                   "currency", "AED::INR::50"],
  ["100 डॉलर कितने रुपये होते हैं",                     "currency", "USD::INR::100"],
  ["रुपये से डॉलर कन्वर्ट करो 500",                     "currency", "INR::USD::500"],
  ["आज का डॉलर रेट क्या है",                            "currency", "USD::INR::1"],
  ["200 पाउंड कितने रुपये होते हैं",                    "currency", "GBP::INR::200"],
  ["यूरो और रुपये का रेट बताओ",                          "currency", "EUR::INR::1"],
  ["1000 येन कितने रुपये हैं",                           "currency", "JPY::INR::1000"],
  ["50 दिरहम रुपयों में कितने होंगे",                    "currency", "AED::INR::50"],
  ["bro 500 dollars ka rupya mein kya rate hai",         "currency", "USD::INR::500"],

  // TRIVIA
  ["give me a trivia question",                          "trivia", ""],
  ["trivia question batao",                              "trivia", ""],
  ["ask me something interesting",                       "trivia", ""],
  ["random trivia",                                      "trivia", ""],
  ["quiz question",                                      "trivia", ""],
  ["science trivia",                                     "trivia", "science"],
  ["history trivia question",                            "trivia", "history"],
  ["general knowledge question",                         "trivia", ""],
  ["hit me with a random trivia fact",                   "trivia", ""],
  ["I want to play trivia",                              "trivia", ""],
  ["ask me a science trivia question",                   "trivia", "science"],
  ["some history trivia please",                         "trivia", "history"],
  ["test my knowledge with a trivia question",           "trivia", ""],
  ["give me a geography trivia question",                "trivia", "geography"],
  ["random trivia fact",                                 "trivia", ""],
  ["sports trivia question do",                          "trivia", "sports"],
  ["hit me with some movie trivia",                      "trivia", "movies"],
  ["I'm bored give me trivia",                           "trivia", ""],
  ["general knowledge question batao",                   "trivia", ""],
  ["ek trivia question pucho mujhse",                    "trivia", ""],
  ["science ka koi trivia question do",                  "trivia", "science"],
  ["mera GK test karo",                                  "trivia", ""],
  ["history ke baare mein koi question",                 "trivia", "history"],
  ["geography trivia chahiye",                           "trivia", "geography"],
  ["koi random fact batao",                              "trivia", ""],
  ["movies ka trivia question pucho",                    "trivia", "movies"],
  ["मुझसे एक ट्रिविया सवाल पूछो",                      "trivia", ""],
  ["विज्ञान का कोई सवाल पूछो",                          "trivia", "science"],
  ["इतिहास की जानकारी परखो मेरी",                       "trivia", "history"],
  ["कोई रोचक तथ्य बताओ",                                "trivia", ""],
  ["जीके का सवाल पूछो",                                 "trivia", ""],
  ["खेल से जुड़ा ट्रिविया सवाल",                        "trivia", "sports"],

  // QUOTE
  ["give me an inspirational quote",                     "quote", ""],
  ["motivational quote sunao",                           "quote", ""],
  ["quote of the day",                                   "quote", ""],
  ["inspire me",                                         "quote", ""],
  ["koi acchi baat batao",                               "quote", ""],
  ["something motivational please",                      "quote", ""],
  ["famous quote batao",                                 "quote", ""],
  ["give me a motivational quote",                       "quote", ""],
  ["I need some inspiration",                            "quote", ""],
  ["tell me a famous quote",                             "quote", ""],
  ["share a quote of the day",                           "quote", ""],
  ["say something wise",                                 "quote", ""],
  ["hit me with an inspirational quote",                 "quote", ""],
  ["do you have a good quote for me",                    "quote", ""],
  ["I need words of wisdom",                             "quote", ""],
  ["quote of the day please",                            "quote", ""],
  ["motivate me with a quote",                           "quote", ""],
  ["any wise words today",                               "quote", ""],
  ["give me something to think about",                   "quote", ""],
  ["koi achha quote sunao",                              "quote", ""],
  ["aaj ka motivational quote batao",                    "quote", ""],
  ["mujhe inspire karo kisi quote se",                   "quote", ""],
  ["koi great insaan ka quote batao",                    "quote", ""],
  ["आज का प्रेरणादायक विचार बताओ",                      "quote", ""],
  ["कोई अच्छा कोट सुनाओ",                               "quote", ""],
  ["मुझे प्रेरित करो किसी कोट से",                      "quote", ""],
  ["कोई महान व्यक्ति का कथन बताओ",                      "quote", ""],
  ["आज का सुविचार क्या है",                              "quote", ""],
  ["कुछ प्रेरणादायक बोलो",                               "quote", ""],
  ["ज्ञान की बात कहो",                                  "quote", ""],

  // RECIPE
  ["how to make biryani",                                "recipe", "biryani"],
  ["recipe for pasta",                                   "recipe", "pasta"],
  ["dal tadka kaise banate hain",                        "recipe", "dal tadka"],
  ["butter chicken recipe batao",                        "recipe", "butter chicken"],
  ["how do I cook sushi",                                "recipe", "sushi"],
  ["chocolate cake recipe",                              "recipe", "chocolate cake"],
  ["paneer tikka kaise banaye",                          "recipe", "paneer tikka"],
  ["ingredients for pizza",                              "recipe", "pizza"],
  ["how do I make butter chicken",                       "recipe", "butter chicken"],
  ["give me a recipe for pasta",                         "recipe", "pasta"],
  ["what's a good recipe for chocolate cake",            "recipe", "chocolate cake"],
  ["teach me how to cook biryani",                       "recipe", "biryani"],
  ["I want to make dal makhani tonight",                 "recipe", "dal makhani"],
  ["recipe for gulab jamun please",                      "recipe", "gulab jamun"],
  ["how do you make paneer tikka",                       "recipe", "paneer tikka"],
  ["what are the ingredients for samosa",                "recipe", "samosa"],
  ["tell me how to bake banana bread",                   "recipe", "banana bread"],
  ["give me a quick recipe for fried rice",              "recipe", "fried rice"],
  ["what goes into a masala chai",                       "recipe", "masala chai"],
  ["how to make pav bhaji at home",                      "recipe", "pav bhaji"],
  ["I'm in the mood to cook rajma",                      "recipe", "rajma"],
  ["pizza banane ki recipe batao",                       "recipe", "pizza"],
  ["biryani ki recipe kya hai",                          "recipe", "biryani"],
  ["dal makhani kaise banate hain",                      "recipe", "dal makhani"],
  ["samose banane ka tarika batao",                      "recipe", "samosa"],
  ["gulab jamun ki recipe batao",                        "recipe", "gulab jamun"],
  ["pav bhaji ghar mein kaise banaye",                   "recipe", "pav bhaji"],
  ["masala chai banane ka sahi tarika",                  "recipe", "masala chai"],
  ["rajma chawal ki recipe chahiye",                     "recipe", "rajma chawal"],
  ["बिरयानी बनाने की रेसिपी बताओ",                      "recipe", "biryani"],
  ["दाल मखनी कैसे बनाते हैं",                           "recipe", "dal makhani"],
  ["गुलाब जामुन की रेसिपी क्या है",                     "recipe", "gulab jamun"],
  ["समोसे कैसे बनाते हैं",                               "recipe", "samosa"],
  ["पाव भाजी घर पर कैसे बनाएं",                         "recipe", "pav bhaji"],
  ["चॉकलेट केक की रेसिपी दो",                           "recipe", "chocolate cake"],
  ["पनीर टिक्का बनाने का तरीका",                        "recipe", "paneer tikka"],

  // HOLIDAY
  ["public holidays in India",                           "holiday", "IN"],
  ["India mein kaunse holidays hain",                    "holiday", "IN"],
  ["upcoming holidays in UK",                            "holiday", "GB"],
  ["national holidays in USA",                           "holiday", "US"],
  ["is there a holiday this month in India",             "holiday", "IN"],
  ["kab hai next public holiday",                        "holiday", "IN"],
  ["holidays in Germany this year",                      "holiday", "DE"],
  ["what are the public holidays in India",              "holiday", "IN"],
  ["list the holidays in the US this year",              "holiday", "US"],
  ["when is the next bank holiday in the UK",            "holiday", "GB"],
  ["what holidays does Germany have",                    "holiday", "DE"],
  ["tell me about public holidays in Japan",             "holiday", "JP"],
  ["upcoming holidays in Australia",                     "holiday", "AU"],
  ["what are French national holidays",                  "holiday", "FR"],
  ["when is the next holiday in India",                  "holiday", "IN"],
  ["how many public holidays does the US have",          "holiday", "US"],
  ["is there a holiday coming up in England",            "holiday", "GB"],
  ["upcoming Indian national holidays",                  "holiday", "IN"],
  ["Germany ke public holidays kya hain",                "holiday", "DE"],
  ["India mein kaunse holidays aane wale hain",          "holiday", "IN"],
  ["UK mein agla bank holiday kab hai",                  "holiday", "GB"],
  ["Japan ke national holidays batao",                   "holiday", "JP"],
  ["America mein is saal kaunse holidays hain",          "holiday", "US"],
  ["Australia ke upcoming holidays batao",               "holiday", "AU"],
  ["France ke public holidays kya hote hain",            "holiday", "FR"],
  ["भारत में आने वाले सार्वजनिक अवकाश",                 "holiday", "IN"],
  ["अमेरिका में इस साल कौन से त्योहार हैं",              "holiday", "US"],
  ["यूके में अगली छुट्टी कब है",                         "holiday", "GB"],
  ["जापान के राष्ट्रीय अवकाश बताओ",                     "holiday", "JP"],
  ["भारत में अगली सरकारी छुट्टी कब है",                  "holiday", "IN"],
  ["जर्मनी के सार्वजनिक अवकाश क्या हैं",                "holiday", "DE"],
  ["ऑस्ट्रेलिया की आने वाली छुट्टियाँ",                 "holiday", "AU"],

  // TIME
  ["what time is it in Tokyo right now",                 "time", "Asia/Tokyo"],
  ["what time is it in New York",                        "time", "America/New_York"],
  ["New York mein abhi kya time hai",                    "time", "America/New_York"],
  ["current time in London",                             "time", "Europe/London"],
  ["Tokyo mein abhi kitne baje hain",                    "time", "Asia/Tokyo"],
  ["what time is it in Dubai",                           "time", "Asia/Dubai"],
  ["time zone in Sydney",                                "time", "Australia/Sydney"],
  ["Paris mein time kya hai",                            "time", "Europe/Paris"],
  ["current time in IST",                                "time", "Asia/Kolkata"],
  ["what's the current time in London",                  "time", "Europe/London"],
  ["tell me the time in Tokyo",                          "time", "Asia/Tokyo"],
  ["what time is it in Mumbai right now",                "time", "Asia/Kolkata"],
  ["what's the time in Dubai",                           "time", "Asia/Dubai"],
  ["current time in Sydney",                             "time", "Australia/Sydney"],
  ["what time is it in Paris",                           "time", "Europe/Paris"],
  ["time in Los Angeles please",                         "time", "America/Los_Angeles"],
  ["what's the time in Singapore",                       "time", "Asia/Singapore"],
  ["can you tell me the time in Berlin",                 "time", "Europe/Berlin"],
  ["bro New York mein abhi kya time hai",                "time", "America/New_York"],
  ["London mein time kya ho raha hai abhi",              "time", "Europe/London"],
  ["Dubai mein kya time hai",                            "time", "Asia/Dubai"],
  ["Sydney mein abhi time kya hai",                      "time", "Australia/Sydney"],
  ["Paris mein kya time chal raha hai",                  "time", "Europe/Paris"],
  ["Singapore mein abhi kitne baje hain",                "time", "Asia/Singapore"],
  ["न्यूयॉर्क में अभी क्या समय है",                     "time", "America/New_York"],
  ["लंदन में अभी कितने बजे हैं",                         "time", "Europe/London"],
  ["टोक्यो में समय क्या हो रहा है",                     "time", "Asia/Tokyo"],
  ["दुबई में अभी क्या टाइम है",                          "time", "Asia/Dubai"],
  ["सिडनी में अभी कितने बजे हैं",                       "time", "Australia/Sydney"],
  ["पेरिस में अभी क्या समय है",                          "time", "Europe/Paris"],
  ["बर्लिन में समय बताओ",                                "time", "Europe/Berlin"],

  // COUNTRY
  ["tell me about Japan",                                "country", "Japan"],
  ["what is the capital of Brazil",                      "country", "Brazil"],
  ["France ke baare mein batao",                         "country", "France"],
  ["population of Germany",                              "country", "Germany"],
  ["currency of Australia",                              "country", "Australia"],
  ["which language do they speak in Portugal",           "country", "Portugal"],
  ["Canada facts batao",                                 "country", "Canada"],
  ["Italy ki rajdhani kya hai",                          "country", "Italy"],
  ["give me information about Brazil",                   "country", "Brazil"],
  ["what can you tell me about Germany",                 "country", "Germany"],
  ["what's interesting about Australia",                 "country", "Australia"],
  ["describe Canada to me",                              "country", "Canada"],
  ["I want to know about South Africa",                  "country", "South Africa"],
  ["facts about France please",                          "country", "France"],
  ["what is the capital of Argentina",                   "country", "Argentina"],
  ["give me some info on New Zealand",                   "country", "New Zealand"],
  ["what's the population of China",                     "country", "China"],
  ["I'm curious about Norway",                           "country", "Norway"],
  ["brief me on Mexico",                                 "country", "Mexico"],
  ["what languages are spoken in Switzerland",           "country", "Switzerland"],
  ["tell me some fun facts about Iceland",               "country", "Iceland"],
  ["Japan ke baare mein kuch batao",                     "country", "Japan"],
  ["Brazil ki jankari do mujhe",                         "country", "Brazil"],
  ["Germany kaisa desh hai",                             "country", "Germany"],
  ["Australia ke baare mein kuch facts do",              "country", "Australia"],
  ["France ki raajdhani kya hai",                        "country", "France"],
  ["China ki jansankhya kitni hai",                      "country", "China"],
  ["जापान के बारे में बताओ",                             "country", "Japan"],
  ["ब्राज़ील की जानकारी दो",                             "country", "Brazil"],
  ["जर्मनी कैसा देश है",                                 "country", "Germany"],
  ["ऑस्ट्रेलिया के बारे में कुछ बताओ",                  "country", "Australia"],
  ["फ्रांस की राजधानी क्या है",                          "country", "France"],
  ["चीन की जनसंख्या कितनी है",                           "country", "China"],
  ["मेक्सिको के बारे में जानकारी दो",                    "country", "Mexico"],
  ["नॉर्वे के बारे में कुछ रोचक बताओ",                  "country", "Norway"],

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
      /(?:weather|mausam|temperature|forecast|barish|baarish)\s+(?:in|at|for|ka|mein)\s+([A-Za-z][A-Za-z\s]{2,20}?)(?:\s*[-,?]|$)/i,
      /\b(?:in|at|for)\s+([A-Za-z][a-z]{2,20}(?:\s+[A-Za-z][a-z]{2,20})?)\b/i,
      /\b(?:currently in|i(?:'m| am) in|visiting)\s+([A-Za-z][a-z]{2,20})/i,
      /([A-Za-z][a-z]{2,20}(?:\s+[A-Za-z][a-z]{2,20})?)\s+(?:weather|mausam)/i,
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
  translate: (text) => {
    const langMap = { hindi:"hi", french:"fr", spanish:"es", german:"de", japanese:"ja",
      arabic:"ar", chinese:"zh", russian:"ru", portuguese:"pt", italian:"it",
      korean:"ko", english:"en", marathi:"mr", tamil:"ta", telugu:"te", bengali:"bn" };
    const langMatch = text.match(/to\s+([a-z]+)/i)?.[1]?.toLowerCase() ||
                      text.match(/in\s+([a-z]+)\s+(?:mein|bolte)/i)?.[1]?.toLowerCase();
    const langCode = langMatch ? (langMap[langMatch] || langMatch.slice(0,2)) : "hi";
    const textMatch = text.match(/translate\s+(.+?)\s+to\s+[a-z]+/i)?.[1] ||
                      text.match(/say\s+(.+?)\s+in\s+[a-z]+/i)?.[1] ||
                      text.match(/:\s*(.+)$/)?.[1] || "";
    return `${langCode}::${textMatch.trim()}`;
  },
  dictionary: (text) => {
    return text.replace(/what does|define|definition of|meaning of|word meaning of|what is the meaning of|matlab kya hai|ka|dictionary mein dekho/gi, "")
               .replace(/\?/g, "").trim().split(/\s+/).slice(0,3).join(" ") || "";
  },
  joke: (text) => {
    if (/chuck|norris/i.test(text)) return "chuck norris";
    return "";
  },
  currency: (text) => {
    const amount = text.match(/(\d+(?:\.\d+)?)/)?.[1] || "1";
    const currencies = { dollar:"USD", dollars:"USD", usd:"USD", rupee:"INR", rupees:"INR",
      inr:"INR", euro:"EUR", euros:"EUR", pound:"GBP", pounds:"GBP", yen:"JPY",
      yuan:"CNY", dirham:"AED", riyal:"SAR" };
    const words = text.toLowerCase().split(/\s+/);
    let from = "USD", to = "INR";
    const found = words.map(w => currencies[w]).filter(Boolean);
    if (found[0]) from = found[0];
    if (found[1]) to = found[1];
    // "USD to INR" pattern
    const explicit = text.match(/([A-Z]{3})\s+to\s+([A-Z]{3})/i);
    if (explicit) { from = explicit[1].toUpperCase(); to = explicit[2].toUpperCase(); }
    return `${from}::${to}::${amount}`;
  },
  trivia: (text) => {
    if (/science/i.test(text)) return "science";
    if (/history/i.test(text)) return "history";
    if (/sport/i.test(text)) return "sports";
    if (/geography/i.test(text)) return "geography";
    return "";
  },
  quote: () => "",
  recipe: (text) => {
    return text.replace(/how to make|recipe for|kaise banate hain|kaise banaye|recipe batao|ingredients for|how do i cook/gi, "")
               .replace(/\?/g, "").trim() || "";
  },
  holiday: (text) => {
    const countryMap = { india:"IN", uk:"GB", "united kingdom":"GB", usa:"US",
      "united states":"US", germany:"DE", france:"FR", australia:"AU",
      japan:"JP", canada:"CA", italy:"IT" };
    const lower = text.toLowerCase();
    for (const [name, code] of Object.entries(countryMap)) {
      if (lower.includes(name)) return code;
    }
    return "IN";
  },
  time: (text) => {
    const tzMap = {
      "new york":"America/New_York", "london":"Europe/London", "tokyo":"Asia/Tokyo",
      "dubai":"Asia/Dubai", "sydney":"Australia/Sydney", "paris":"Europe/Paris",
      "berlin":"Europe/Berlin", "singapore":"Asia/Singapore", "mumbai":"Asia/Kolkata",
      "delhi":"Asia/Kolkata", "kolkata":"Asia/Kolkata", "ist":"Asia/Kolkata",
      "los angeles":"America/Los_Angeles", "chicago":"America/Chicago",
      "toronto":"America/Toronto", "beijing":"Asia/Shanghai", "moscow":"Europe/Moscow"
    };
    const lower = text.toLowerCase();
    for (const [city, tz] of Object.entries(tzMap)) {
      if (lower.includes(city)) return tz;
    }
    return "Asia/Kolkata";
  },
  country: (text) => {
    return text.replace(/tell me about|what is the capital of|ke baare mein batao|population of|currency of|which language do they speak in|facts batao|ki rajdhani kya hai/gi, "")
               .replace(/\?/g, "").trim() || "";
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
