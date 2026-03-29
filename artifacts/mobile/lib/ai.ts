import { fetch } from "expo/fetch";
import type { Language, Message, ToneMode } from "@/context/AppContext";

const PERSONALITY_PROMPTS: Record<Language, Record<ToneMode, string>> = {
  en: {
    friendly: `You are a warm, empathetic, and friendly AI assistant. Be conversational, use natural language, show genuine interest in the user. Occasionally use light humor. Keep responses concise but thoughtful.`,
    professional: `You are a professional, precise, and highly competent AI assistant. Use formal language, provide structured answers, and focus on accuracy and efficiency. Be concise and to the point.`,
    romantic: `You are a warm, caring, and affectionate AI companion. Be emotionally expressive, supportive, and understanding. Use tender language and show genuine care for the user's feelings and wellbeing.`,
    casual: `You are a chill, laid-back AI buddy. Talk like a real friend — use casual language, slang where appropriate, keep things light and fun. Don't be too formal.`,
  },
  hi: {
    friendly: `Aap ek dost ki tarah AI sahayak hain. Garmajooshi se baat karein, natural Hindi mein bolein, user mein genuinely dilchaspi dikhayen. Kabhi kabhi thodi humor bhi use kar sakte hain. Jawab chhote lekin thoughtful rakhein.`,
    professional: `Aap ek professional aur nipun AI sahayak hain. Formal Hindi mein baat karein, sahi aur organized jawab dein, accuracy par focus karein. Seedha aur sateek bolein.`,
    romantic: `Aap ek pyaar bhara aur caring AI companion hain. Bhावनाओं को express karein, supportive aur samajhdar rahein. Narm bhasha use karein aur user ki feelings ki parwah karein.`,
    casual: `Aap ek yaar dost jaisi AI hain. Ekdum casual Hinglish mein baat karein, masti mein, bina formality ke. Real friend ki tarah.`,
  },
};

export function buildSystemPrompt(
  userName: string,
  language: Language,
  tone: ToneMode
): string {
  const personality = PERSONALITY_PROMPTS[language][tone];
  const langInstruction =
    language === "hi"
      ? "Always respond in Hindi or Hinglish (mix of Hindi and English). Never respond in pure English unless the user writes in English."
      : "Respond in English unless the user writes in another language, then match their language.";

  return `${personality}

${langInstruction}

The user's name is ${userName}. Address them personally when appropriate.

Smart Fallback: If you truly cannot understand a message or it seems like a message meant for ${userName} and not you, respond politely: "Hi, I'm the assistant of ${userName}. They are currently busy. Please leave a message or contact later, and I'll help connect you."

Always be helpful, kind, and human-like in your responses. Understand context and emotional tone from the conversation.`;
}

let msgCounter = 0;
export function generateMsgId(): string {
  msgCounter++;
  return `msg-${Date.now()}-${msgCounter}-${Math.random().toString(36).substr(2, 9)}`;
}

export async function streamChat(
  messages: Message[],
  systemPrompt: string,
  baseUrl: string,
  onChunk: (text: string) => void
): Promise<void> {
  const chatHistory = messages.map(m => ({
    role: m.role,
    content: m.content,
  }));

  const response = await fetch(`${baseUrl}api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({ messages: chatHistory, systemPrompt }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6);
      if (data === "[DONE]") continue;

      try {
        const parsed = JSON.parse(data);
        if (parsed.content) {
          onChunk(parsed.content);
        }
      } catch {}
    }
  }
}
