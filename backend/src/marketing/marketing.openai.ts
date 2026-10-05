import { parseMarketingJson, type MarketingKitJson, type StreamMarketingContext, buildMarketingSystemPrompt, buildMarketingUserPrompt } from "./marketing.prompts";

export function openaiModel() {
    return String(process.env.OPENAI_MODEL || "gpt-4o-mini").trim() || "gpt-4o-mini";
}

export async function generateMarketingKitJson(ctx: StreamMarketingContext): Promise<{ kit: MarketingKitJson; model: string }> {
    const key = String(process.env.OPENAI_API_KEY || "").trim();
    if (!key) {
        throw new Error("OPENAI_API_KEY nincs beállítva. Add hozzá a backend/.env fájlhoz.");
    }
    const model = openaiModel();
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 90_000);
    try {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            signal: ac.signal,
            headers: {
                Authorization: `Bearer ${key}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model,
                temperature: 0.7,
                response_format: { type: "json_object" },
                messages: [
                    { role: "system", content: buildMarketingSystemPrompt(ctx) },
                    { role: "user", content: buildMarketingUserPrompt(ctx) },
                ],
            }),
        });
        const data = (await res.json().catch(() => ({}))) as {
            error?: { message?: string };
            choices?: { message?: { content?: string } }[];
        };
        if (!res.ok) {
            throw new Error(data.error?.message || `OpenAI hiba (${res.status})`);
        }
        const content = data.choices?.[0]?.message?.content || "";
        return { kit: parseMarketingJson(content), model };
    } finally {
        clearTimeout(timer);
    }
}
