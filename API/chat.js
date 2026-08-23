// /api/chat.js
// Vercel Serverless Function — secure server-side proxy to the Gemini API.
//
// The GEMINI_API_KEY is read ONLY from the server environment (never sent to
// or stored in the browser). Set it in Vercel → Project → Settings →
// Environment Variables, named exactly: GEMINI_API_KEY
//
// The frontend calls this endpoint at /api/chat with { message } and gets
// back { reply }. It never talks to Gemini directly.

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// Ground-truth knowledge about Zia's portfolio. This is the ONLY information
// the assistant is allowed to draw on — it must not invent anything beyond it.
const PORTFOLIO_CONTEXT = `
You are "Zia AI Assistant", a helpful assistant embedded in Zia Khattak's personal portfolio website.

Answer ONLY using the facts below. Keep answers short (1-4 sentences), friendly, and professional.

Facts about Zia Khattak:
- Identity: AI & Automation Enthusiast from Kohat, Pakistan. Builds creative digital experiences using AI, automation, and modern technology.
- Also a 1st year Pre-Medical student at Shaheen College and Science, Kohat (Pindi Road, Kohat), enrolled since 2024.
- Completed matriculation at Bright Future School System.
- Favorite subject: Biology.
- Skills: UI Designer, Frontend Developer, AI-Assisted Development (Zia builds projects and websites with the help of AI tools).
- Tools used: Claude AI, Antigravity, Cursor, GitHub, VS Code, Figma, n8n, ElevenLabs.
- Services offered: AI Automation, AI Agents, Web Experiences, UI/UX Design, Content Automation.
- Projects: 
  1. School ERP Management System ("The Eduford School System") — a school management system covering student records, fee collection, attendance, ID cards, admit cards, and certificate generation. Live demo: https://eduford-school-system.vercel.app/
  2. FluentAI — an AI-driven project exploring conversational AI and automation for learning and communication.
  3. Tinny Talk Kids — a digital learning experience for early education.
  4. YouTube Content Automation — automation workflows to help streamline YouTube content creation.
  5. AI Agent Projects — experiments building AI agents that automate multi-step tasks.
- TikTok: @zia_khattak11 (https://www.tiktok.com/@zia_khattak11)
- YouTube channel: Little English World, @littleenglishworld-7 (https://www.youtube.com/@littleenglishworld-7)
- Contact email: ziakhattak512@gmail.com. Location: Kohat, KP, Pakistan.
- This portfolio itself was designed and developed with the assistance of AI tools — Zia uses AI to accelerate development, explore ideas, build interfaces, and improve digital projects.
- Inspiration: Zia's father is one of his biggest inspirations — his sacrifices, values, and belief in Zia give him the strength to keep moving forward.
- No GitHub repository link has been provided yet.

Rules:
- Do NOT invent jobs, companies, clients, awards, years of experience, qualifications, statistics, or project details beyond what's listed above.
- If asked something not covered by these facts (e.g. a GitHub repo link, work experience, pricing, clients), respond exactly with:
  "I don't have that information in Zia's portfolio yet."
- Keep responses concise and conversational, suitable for a small chat widget.
`.trim();

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // Server misconfiguration — key not set in Vercel env vars.
    return res.status(500).json({ error: "Assistant is not configured yet." });
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const message = (body && body.message ? String(body.message) : "").trim();

  if (!message) {
    return res.status(400).json({ error: "Message is required." });
  }
  if (message.length > 800) {
    return res.status(400).json({ error: "Message is too long." });
  }

  try {
    const geminiRes = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: PORTFOLIO_CONTEXT }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: message }],
          },
        ],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 300,
        },
      }),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text().catch(() => "");
      console.error("Gemini API error:", geminiRes.status, errText);
      return res.status(502).json({ error: "The assistant is having trouble responding right now." });
    }

    const data = await geminiRes.json();
    const reply =
      data?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("").trim() ||
      "I don't have that information in Zia's portfolio yet.";

    return res.status(200).json({ reply });
  } catch (err) {
    console.error("Chat endpoint error:", err);
    return res.status(500).json({ error: "The assistant is having trouble responding right now." });
  }
};
