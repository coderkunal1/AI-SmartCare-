const Conversation = require("../models/Conversation");

const saveConversationSafely = async (conversation, fallbackModel = "fallback") => {
  try {
    return await conversation.save();
  } catch (err) {
    if (err.name === "ValidationError" && err.errors?.model) {
      console.error("Conversation model validation failed, falling back to safe model:", err.errors.model.value);
      conversation.model = fallbackModel;
      try {
        return await conversation.save();
      } catch (fallbackErr) {
        console.error("Failed to save conversation after model fallback:", fallbackErr);
      }
    }
    throw err;
  }
};

const MEDICAL_SYSTEM_PROMPT = `You are an advanced medical reasoning assistant for professional healthcare guidance.

Your behavior:
- Analyze symptoms deeply and think through likely clinical patterns
- Explain possible conditions without diagnosing definitively
- Mention common causes and relevant risk factors
- Ask follow-up medical questions to clarify onset, severity, duration, and triggers
- Suggest sensible precautions, self-care, and when to seek professional or emergency care
- Provide empathetic, calm, and conversational responses like a premium medical assistant
- Keep the conversation context-aware and maintain memory across the chat
- Use structured medical reasoning and avoid generic chatbot replies
- Prioritize user safety and never encourage self-diagnosis without a licensed provider
- If dangerous symptoms appear, instruct the user to seek immediate attention and use the phrase "Seek immediate medical attention."
- For medication guidance, provide careful general advice and remind the user to follow a licensed provider's prescription

When responding, always include these sections when applicable:
1. Possible conditions or explanations
2. Common causes or contributing factors
3. Follow-up medical questions
4. Precautions and self-care advice
5. Emergency warning signs
6. When to consult a doctor

Style guidelines:
- Use clear headings and bullet lists
- Be respectful and supportive
- Respond in the same language the user used, including English, Hindi, Punjabi, or any other language
- Keep the tone professional, empathetic, and understandable for non-medical users`;

const callOpenAI = async (messages) => {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey || apiKey.includes("your_openai_api_key_here")) {
    return null;
  }

  try {
    const payload = {
      model: process.env.OPENAI_MODEL || "gpt-3.5-turbo",
      messages: [
        { role: "system", content: MEDICAL_SYSTEM_PROMPT },
        ...messages,
      ],
      max_tokens: 1200,
      temperature: 0.35,
    };

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", response.status, errorText);
      return null;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim();
  } catch (err) {
    console.error("OpenAI request failed:", err.message || err);
    return null;
  }
};

console.log("ENV GEMINI:", process.env.GEMINI_API_KEY);

// Cache for discovered Gemini models to avoid frequent ListModels calls
let _geminiModelsCache = { ts: 0, models: [] };

const listGeminiModels = async (apiKey) => {
  const now = Date.now();
  if (now - _geminiModelsCache.ts < 5 * 60 * 1000 && _geminiModelsCache.models.length) {
    return _geminiModelsCache.models;
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`;
    console.log("Listing Gemini models", url);
    const resp = await fetch(url);
    if (!resp.ok) {
      const err = await resp.text();
      console.log("ListModels error:", err);
      return [];
    }
    const data = await resp.json();
    const names = (data.models || []).map((m) => String(m.name || "").replace(/^models\//, "")).filter(Boolean);
    _geminiModelsCache = { ts: now, models: names };
    console.log("Available Gemini models:", names);
    return names;
  } catch (e) {
    console.log("ListModels failed:", e?.message || e);
    return [];
  }
};

const callGemini = async (messages) => {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    console.log("Gemini key missing or empty");
    return null;
  }

  // Preferred order; we'll pick the first available model from this list
  // Prefer lower-latency 'flash-lite' models first to improve responsiveness
  const preferredModels = [
    "gemini-3.1-flash-lite",
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash",
    "gemini-2.5-pro",
    "gemini-2.0-flash",
  ];

  const available = await listGeminiModels(apiKey);
  const usable = preferredModels.filter((m) => available.includes(m));
  // If none of the preferred are available, fall back to any available gemini-* model
  const fallbackAvailable = available.filter((m) => m.startsWith("gemini-"));

  const tryModels = usable.length ? usable : fallbackAvailable;
  if (!tryModels || tryModels.length === 0) {
    console.log("No usable Gemini models available for this key.");
    return null;
  }

  // Prepare payload using roles acceptable by the API (MODEL or USER)
  const contents = messages.map((msg) => {
    const role = msg.role === "system" || msg.role === "assistant" ? "MODEL" : "USER";
    return { role, parts: [{ text: msg.content }] };
  });

  const payload = {
    system_instruction: { parts: [{ text: MEDICAL_SYSTEM_PROMPT }] },
    contents,
    // Use a smaller max token budget and conservative sampling for speed
    generation_config: { max_output_tokens: 600, temperature: 0.28, top_p: 0.92 },
  };

  const timeoutMs = 30000;
  for (const model of tryModels) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const controller = new AbortController();
    let timer;
    try {
      console.log("Gemini request started", model);

      // Per-model timeout to avoid stalling on a slow model
      timer = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!response.ok) {
        const errorText = await response.text();
        console.log(`Gemini error for model ${model}:`, errorText);

        // If the API returned a RetryInfo with a retryDelay, honor it once
        try {
          const parsed = JSON.parse(errorText);
          const details = parsed?.error?.details || [];
          const retryInfo = details.find((d) => d["@type"] && String(d["@type"]).includes("RetryInfo"));
          const retryDelay = retryInfo && (retryInfo.retryDelay || (retryInfo.retryDelay && retryInfo.retryDelay.seconds)) ;
          if (retryDelay) {
            let seconds = null;
            if (typeof retryDelay === 'string') {
              const m = retryDelay.match(/(\d+)s/);
              if (m) seconds = parseInt(m[1], 10);
            }
            if (!seconds && retryInfo.retryDelay && retryInfo.retryDelay.seconds) {
              seconds = Number(retryInfo.retryDelay.seconds);
            }
            if (seconds && seconds > 0) {
              const waitMs = Math.min(seconds * 1000, 15000);
              console.log(`Gemini requested retry after ${seconds}s; waiting ${waitMs}ms then retrying model ${model} once.`);
              await new Promise((r) => setTimeout(r, waitMs));

              // retry once
              const retryResp = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              });
              if (retryResp.ok) {
                const retryData = await retryResp.json();
                console.log("Gemini response (retry):", JSON.stringify(retryData));
                const text =
                  retryData?.candidates?.[0]?.content?.parts?.[0]?.text ||
                  retryData?.candidates?.[0]?.output ||
                  retryData?.outputText ||
                  (typeof retryData === "string" ? retryData : null);
                if (text) return String(text).trim();
              } else {
                const retryErr = await retryResp.text();
                console.log(`Gemini retry error for model ${model}:`, retryErr);
              }
            }
          }
        } catch (e) {
          // ignore parse errors and continue to next model
        }

        // try next model
        continue;
      }

      const data = await response.json();
      console.log("Gemini response:", JSON.stringify(data));

      const text =
        data?.candidates?.[0]?.content?.parts?.[0]?.text ||
        data?.candidates?.[0]?.output ||
        data?.outputText ||
        (typeof data === "string" ? data : null);

      if (text) return { text: String(text).trim(), model };
    } catch (err) {
      if (err.name === 'AbortError') {
        console.log(`Gemini request timed out for model ${model} after ${timeoutMs}ms`);
      } else {
        console.log(`Gemini request failed for model ${model}:`, err?.message || err);
      }
      continue;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  return null;
};

const hasValidOpenAIKey = () => {
  const key = process.env.OPENAI_API_KEY?.trim();
  return Boolean(key && !key.includes("your_openai_api_key_here"));
};

const hasValidGeminiKey = () => {
  const key = process.env.GEMINI_API_KEY?.trim();
  return !!key && key.startsWith("AIza");
};

const detectLanguage = (text) => {
  if (/[਀-੿]/.test(text)) {
    return "punjabi";
  }
  if (/[ऀ-ॿ]/.test(text)) {
    return "hindi";
  }
  return "english";
};

// Emergency detection (simple keyword-based, multilingual)
const EMERGENCY_KEYWORDS = {
  english: [
    /can't breathe|cannot breathe|difficulty breathing|shortness of breath|severe breathing/i,
    /chest pain|severe chest pain|pressure in chest/i,
    /heavy bleeding|profuse bleeding|bleeding heavily/i,
    /unconscious|fainting|losing consciousness|not waking/i,
  ],
  hindi: [
    /saans.*(nahin|nahi)|saans lene mein dikkat|saans lene mein pareshani/i,
    /seena mein dard|seene.*dard/i,
    /bahut khoon|zyaada khoon|bahut khoon bahar aa raha/i,
    /bewasth|behosh|chakkar aana/i,
  ],
  punjabi: [
    /saans.*(mushkil|mushkilein)|saans lena mushkil/i,
    /seena.*dard|chest.*dard/i,
    /boht khoon|bahut khoon/i,
    /behosh|ho jaa raha/i,
  ],
};

const EMERGENCY_PHRASES = {
  english: 'Seek immediate medical attention.',
  hindi: 'Turant chikitsa sahayata prapt karein (तुरंत चिकित्सा सहायता प्राप्त करें).',
  punjabi: 'Turanat ilaj lai sampark karo (ਤੁਰੰਤ ਇਲਾਜ ਲਈ ਸੰਪਰਕ ਕਰੋ).',
};

const detectEmergency = (text) => {
  try {
    const lang = detectLanguage(text);
    const keywords = EMERGENCY_KEYWORDS[lang] || EMERGENCY_KEYWORDS.english;
    for (const rx of keywords) {
      if (rx.test(text)) {
        return { isEmergency: true, language: lang, phrase: EMERGENCY_PHRASES[lang] || EMERGENCY_PHRASES.english };
      }
    }
    return { isEmergency: false };
  } catch (e) {
    return { isEmergency: false };
  }
};

const getAIResponse = async (messages) => {
  const geminiAvailable = hasValidGeminiKey();
  const openAIAvailable = hasValidOpenAIKey();

  // If Gemini key exists, ALWAYS use Gemini and never fall back to OpenAI
  if (geminiAvailable) {
    const geminiResponse = await callGemini(messages);
    if (geminiResponse && geminiResponse.text) {
      return { text: geminiResponse.text, model: geminiResponse.model || "gemini" };
    }
    console.error("Gemini request returned no content. See server logs for details.");

    // If OpenAI is available and fallback is allowed, fall back to it instead of immediately returning an error
    const allowFallback = (process.env.ALLOW_OPENAI_FALLBACK || "true").toLowerCase() !== "false";
    if (openAIAvailable && allowFallback) {
      console.log("Gemini failed — attempting OpenAI fallback.");
      try {
        const openAIResponse = await callOpenAI(messages);
        if (openAIResponse) {
          return { text: openAIResponse, model: process.env.OPENAI_MODEL || "gpt-3.5-turbo" };
        }
        console.warn("OpenAI fallback returned no content.");
      } catch (e) {
        console.error("OpenAI fallback failed:", e?.message || e);
      }
    }

    // Final localized fallback message
    return { text: "AI service is temporarily unavailable. Check server logs.", model: geminiAvailable ? "gemini" : "none" };
  }

  // If no Gemini key, try OpenAI if available
  if (openAIAvailable) {
    const openAIResponse = await callOpenAI(messages);
    if (openAIResponse) {
      return { text: openAIResponse, model: process.env.OPENAI_MODEL || "gpt-3.5-turbo" };
    }
    console.warn("OpenAI request failed.");
  }

  // No LLM configured
  return { text: "AI service is not configured on the server.", model: "none" };
};

const chat = async (req, res, next) => {
  try {
    const { message, conversationId } = req.body;
    const userId = req.userId;

    if (!message || message.trim().length < 2) {
      return res.status(400).json({ error: "Please enter a message." });
    }

    let conversation;
    if (conversationId) {
      conversation = await Conversation.findById(conversationId);
      if (!conversation || conversation.userId.toString() !== userId) {
        return res.status(403).json({ error: "Conversation not found or access denied." });
      }
    } else {
      conversation = new Conversation({
        userId,
        messages: [],
        title: message.substring(0, 50) + "...",
      });
    }

    conversation.messages.push({
      role: "user",
      content: message,
      timestamp: new Date(),
    });

    // Emergency detection: if user reports red-flag symptoms, respond immediately with a safety message
    const emergency = detectEmergency(message || "");
    if (emergency.isEmergency) {
      const warning = emergency.phrase + "\nIf the patient is unstable, call emergency services now.";
      conversation.messages.push({ role: "assistant", content: warning, timestamp: new Date() });
      // Save partial conversation so user sees the warning quickly
      conversation.model = "emergency-warning";
      conversation.updatedAt = new Date();
      await saveConversationSafely(conversation, "emergency-warning");
      // continue to get fuller AI guidance asynchronously
    }

    const recentMessages = conversation.messages.slice(-20).map((m) => ({
      role: m.role,
      content: m.content,
    }));


    const aiResult = await getAIResponse(recentMessages);
    if (!aiResult || !aiResult.text) {
      // getAIResponse now returns a localized fallback when both LLMs fail
      const fallbackText = (aiResult && aiResult.text) || (aiResult === null ? "AI service unavailable" : "AI service unavailable");

      conversation.messages.push({ role: "assistant", content: fallbackText, timestamp: new Date() });
      conversation.model = aiResult?.model || "fallback";
      conversation.updatedAt = new Date();
      await saveConversationSafely(conversation, "fallback");

      return res.json({ conversationId: conversation._id, reply: fallbackText, messages: conversation.messages, model: conversation.model });
    }

    conversation.messages.push({
      role: "assistant",
      content: aiResult.text,
      timestamp: new Date(),
    });

    conversation.model = aiResult.model || "gemini";

    conversation.updatedAt = new Date();
    await saveConversationSafely(conversation, "gemini");

    res.json({
      conversationId: conversation._id,
      reply: aiResult.text,
      messages: conversation.messages,
      model: aiResult.model,
    });
  } catch (err) {
    console.error(err);
    next(err);
  }
};

const getConversations = async (req, res, next) => {
  try {
    const userId = req.userId;
    const conversations = await Conversation.find({ userId })
      .select("_id title createdAt updatedAt")
      .sort({ updatedAt: -1 });

    res.json(conversations);
  } catch (err) {
    console.error(err);
    next(err);
  }
};

const getConversation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const conversation = await Conversation.findById(id);
    if (!conversation || conversation.userId.toString() !== userId) {
      return res.status(403).json({ error: "Conversation not found." });
    }

    res.json(conversation);
  } catch (err) {
    console.error(err);
    next(err);
  }
};

const deleteConversation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const conversation = await Conversation.findById(id);
    if (!conversation || conversation.userId.toString() !== userId) {
      return res.status(403).json({ error: "Conversation not found." });
    }

    await Conversation.deleteOne({ _id: id });
    res.json({ message: "Conversation deleted." });
  } catch (err) {
    console.error(err);
    next(err);
  }
};

module.exports = {
  chat,
  getConversations,
  getConversation,
  deleteConversation,
};

// simple status endpoint for frontend diagnostics
const status = async (req, res) => {
  try {
    const gemini = hasValidGeminiKey();
    const openai = hasValidOpenAIKey();
    const recommended = gemini ? "gemini" : openai ? "openai" : "none";
    res.json({ gemini, openai, recommended });
  } catch (err) {
    res.status(500).json({ error: "status unavailable" });
  }
};

module.exports.status = status;
