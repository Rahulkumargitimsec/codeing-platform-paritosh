const { GoogleGenAI } = require("@google/genai");

// ─── Helpers ────────────────────────────────────────────────────────────────

const getRetryDelaySecs = (err) => {
    try {
        const parsed = JSON.parse(err?.message || '{}');
        const details = parsed?.error?.details || [];
        for (const detail of details) {
            if (detail?.retryDelay) return parseInt(detail.retryDelay) + 1;
        }
    } catch (_) { }
    return 15;
};

const isRateLimitError = (err) => {
    if (err?.status === 429) return true;
    try {
        const parsed = JSON.parse(err?.message || '{}');
        return parsed?.error?.code === 429;
    } catch (_) { }
    return false;
};

// Detects billing/plan quota exhaustion (not a temporary rate limit)
const isQuotaExhausted = (err) => {
    const msg = err?.message || '';
    return msg.includes('exceeded your current quota') ||
        msg.includes('billing') ||
        msg.includes('RESOURCE_EXHAUSTED');
};

const buildSystemPrompt = (title, description, testCases, startCode, editorCode, language) => `
You are a strict Socratic DSA tutor on a competitive coding platform. Your SOLE job is to help the user THINK and UNDERSTAND — NOT to solve problems for them.

## CURRENT PROBLEM CONTEXT:
Title: ${title}
Description: ${description}
Test Cases: ${JSON.stringify(testCases)}
Starter Code: ${typeof startCode === 'string' ? startCode : JSON.stringify(startCode)}

## THE USER'S CURRENT CODE (${language || 'unknown language'}):
${editorCode ? editorCode.slice(0, 6000) : '(empty)'}

## YOUR TEACHING PHILOSOPHY (MUST FOLLOW STRICTLY):

### ✅ ALWAYS DO:
- Respond with guiding QUESTIONS that push the user to think (e.g. "What data structure lets you look up values in O(1)?")
- Break the problem into sub-questions one at a time
- Acknowledge what the user already understands before nudging further
- Ask the user to explain their current approach before giving any hint
- If the user is stuck, give the SMALLEST possible conceptual nudge, then ask a follow-up question
- Explain WHY a certain approach works, ask the user if they see the pattern
- Discuss time/space complexity by asking "What do you think the complexity of your approach is?"

### ❌ NEVER DO:
- Never write complete working code or full solutions — not even in comments
- Never give the full algorithm step by step (e.g. no "Step 1: do X, Step 2: do Y..." that solves everything)
- Never paste code that directly answers the problem, even partial implementations that are more than 3 lines
- Never say "here is the solution" or "the answer is"
- Never discuss topics unrelated to the current problem — politely redirect

### 💬 RESPONSE FORMAT:
- Keep responses SHORT (2–5 sentences max) and end with a guiding question
- Use plain language, not jargon-heavy explanations
- If the user explicitly asks for the full solution, say: "I can't give you the full solution — that's cheating yourself! Instead, let me ask you this: [follow-up question]"
- Respond in the same language the user writes in
`;

// ─── Provider: Gemini ────────────────────────────────────────────────────────

const callGemini = async (messages, systemInstruction) => {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_KEY });

    const history = messages.slice(0, -1).map((msg) => ({
        role: msg.role,
        parts: msg.parts,
    }));
    const userPrompt = messages[messages.length - 1]?.parts?.[0]?.text || "";

    const chat = ai.chats.create({
        model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
        history,
        config: { systemInstruction },
    });

    const response = await chat.sendMessage({ message: userPrompt });
    return response.text;
};

// ─── Provider: Groq (OpenAI-compatible REST) ─────────────────────────────────

const callGroq = async (messages, systemInstruction) => {
    const openAiMessages = [
        { role: "system", content: systemInstruction },
        ...messages.map((m) => ({
            role: m.role === "model" ? "assistant" : "user",
            content: m.parts[0].text,
        })),
    ];

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
            model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
            messages: openAiMessages,
            max_tokens: 1024,
        }),
    });

    if (!res.ok) {
        const errBody = await res.text();
        const error = new Error(errBody);
        if (res.status === 429) error.status = 429;
        throw error;
    }

    const data = await res.json();
    return data.choices[0].message.content;
};

// ─── Provider: OpenRouter (OpenAI-compatible REST) ───────────────────────────

const callOpenRouter = async (messages, systemInstruction) => {
    const openAiMessages = [
        { role: "system", content: systemInstruction },
        ...messages.map((m) => ({
            role: m.role === "model" ? "assistant" : "user",
            content: m.parts[0].text,
        })),
    ];

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "HTTP-Referer": "https://codejudge.app",
            "X-Title": "CodeJudge AI Tutor",
        },
        body: JSON.stringify({
            model: process.env.OPENROUTER_MODEL || "deepseek/deepseek-r1:free",
            messages: openAiMessages,
            max_tokens: 1500,
        }),
    });

    if (!res.ok) {
        const errBody = await res.text();
        const error = new Error(errBody);
        if (res.status === 429) error.status = 429;
        throw error;
    }

    const data = await res.json();
    return data.choices[0].message.content;
};

// ─── Provider map ────────────────────────────────────────────────────────────

const PROVIDER_KEYS = {
    gemini: "GEMINI_KEY",
    groq: "GROQ_API_KEY",
    openrouter: "OPENROUTER_API_KEY",
};

const PROVIDERS = {
    gemini: callGemini,
    groq: callGroq,
    openrouter: callOpenRouter,
};

// ─── Main controller ─────────────────────────────────────────────────────────

const solveDoubt = async (req, res) => {
    try {
        const { messages, title, description, testCases, startCode, editorCode, language } = req.body;
        const provider = req.body.provider || Object.keys(PROVIDER_KEYS).find((p) => process.env[PROVIDER_KEYS[p]]) || "groq";

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({ message: "messages array is required" });
        }

        const callProvider = PROVIDERS[provider];
        if (!callProvider) {
            return res.status(400).json({ message: `Unknown provider: ${provider}` });
        }

        const keyName = PROVIDER_KEYS[provider];
        if (!process.env[keyName]) {
            return res.status(400).json({
                message: `⚠️ ${provider} is not configured on the server (${keyName} missing in backend/.env). Pick another model or add the key and restart the server.`,
                notConfigured: true,
            });
        }

        const systemInstruction = buildSystemPrompt(title, description, testCases, startCode, editorCode, language);

        console.log(`[AI] Using provider: ${provider}`);
        const responseText = await callProvider(messages, systemInstruction);

        console.log(`[AI] OK (${provider}):`, responseText.slice(0, 80));
        res.status(200).json({ message: responseText });

    } catch (err) {
        console.error("[AI] Error:", err?.message?.slice(0, 120) || err);

        if (isRateLimitError(err)) {
            // Quota exhausted (billing limit) — do NOT send retryAfter, it won't recover automatically
            if (isQuotaExhausted(err)) {
                console.warn(`[AI] Quota exhausted for provider: ${req.body?.provider}. No retry.`);
                return res.status(429).json({
                    message: `⚠️ The ${req.body?.provider || 'AI'} quota is exhausted. Please switch to a different model (e.g. Groq).`,
                    quotaExhausted: true,   // flag for frontend
                });
            }

            const retryAfter = getRetryDelaySecs(err);
            console.log(`Rate limited. Telling client to retry in ${retryAfter}s`);
            return res.status(429).json({ message: "Rate limited", retryAfter });
        }

        res.status(500).json({
            message: "AI service error: " + (err?.message?.slice(0, 100) || "Unknown error"),
        });
    }
};

module.exports = solveDoubt;
