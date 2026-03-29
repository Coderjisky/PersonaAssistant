import { Router, type IRouter } from "express";
import OpenAI from "openai";
import { Buffer } from "node:buffer";

const router: IRouter = Router();

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

router.post("/voice", async (req, res) => {
  const { audio, format = "wav", systemPrompt } = req.body;

  if (!audio) {
    res.status(400).json({ error: "audio base64 is required" });
    return;
  }

  try {
    const audioBuffer = Buffer.from(audio, "base64");
    const audioBase64 = audioBuffer.toString("base64");

    const messages: OpenAI.ChatCompletionMessageParam[] = [];
    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }
    messages.push({
      role: "user",
      content: [
        {
          type: "input_audio",
          input_audio: {
            data: audioBase64,
            format: (format === "m4a" || format === "mp4") ? "mp4" : format === "webm" ? "webm" : "wav",
          },
        },
      ] as any,
    });

    const response = await openai.chat.completions.create({
      model: "gpt-audio",
      modalities: ["text", "audio"],
      audio: { voice: "alloy", format: "mp3" },
      messages,
    } as any);

    const message = (response.choices[0]?.message as any);
    const transcript = message?.audio?.transcript || message?.content || "";
    const audioData = message?.audio?.data ?? "";

    res.json({ transcript, audio: audioData, format: "mp3" });
  } catch (error) {
    req.log.error({ error }, "Voice chat error");
    res.status(500).json({ error: "Voice processing failed" });
  }
});

router.post("/auto-reply", async (req, res) => {
  const { message, platform, systemPrompt } = req.body;

  if (!message) {
    res.status(400).json({ error: "message is required" });
    return;
  }

  try {
    const basePrompt = systemPrompt || "You are a helpful AI assistant.";
    const response = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 4096,
      messages: [
        {
          role: "system",
          content: `${basePrompt}\n\nYou are handling an auto-reply for a ${platform || "social media"} message. Generate a natural, human-like reply on the user's behalf. Keep it concise and conversational.`,
        },
        { role: "user", content: `Someone sent: "${message}"` },
      ],
    });

    const reply = response.choices[0]?.message?.content || "";
    res.json({ reply });
  } catch (error) {
    req.log.error({ error }, "Auto-reply error");
    res.status(500).json({ error: "Auto-reply generation failed" });
  }
});

export default router;
