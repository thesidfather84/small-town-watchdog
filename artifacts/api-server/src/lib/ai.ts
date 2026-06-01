import { logger } from "./logger";

export async function generateSummary(
  title: string,
  content: string,
  entityName: string,
  docType: string,
  year: number
): Promise<{
  plainSummary: string;
  eli12Summary: string;
  redFlagLevel: string;
  alertCategory: string | null;
}> {
  const snippet = content.slice(0, 3000);

  try {
    const baseUrl = process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"];
    const apiKey = process.env["AI_INTEGRATIONS_OPENAI_API_KEY"];

    if (!baseUrl || !apiKey) {
      throw new Error("AI integration not configured");
    }

    const { default: OpenAI } = await import("openai");
    const openai = new OpenAI({ baseURL: baseUrl, apiKey });

    const prompt = `You are a local government transparency assistant. Summarize this public record in plain English at a 6th grade reading level.

Document:
- Title: ${title}
- Entity: ${entityName}
- Type: ${docType}
- Year: ${year}
- Content: ${snippet || "(no content provided — summarize based on title and type)"}

Respond ONLY with valid JSON in this exact format:
{
  "plainSummary": "A 2-4 sentence plain English summary answering: What happened? Why does it matter? How much money is involved? Does this affect taxpayers?",
  "eli12Summary": "Explain this to a 12-year-old in 2-3 simple sentences. No jargon at all.",
  "redFlagLevel": "green" | "yellow" | "red",
  "alertCategory": "new-agenda" | "budget-increase" | "tax-proposal" | "public-hearing" | "big-contract" | "audit-issue" | "spending-increase" | "zoning-change" | "meeting-tonight" | null
}

Rules for redFlagLevel: red = large increase (>25%) or contract doubles or audit issue found. yellow = notable increase (>10%) or important notice. green = normal change.`;

    const response = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    const cleaned = raw.replace(/^```json\n?/, "").replace(/\n?```$/, "").trim();
    const parsed = JSON.parse(cleaned);

    return {
      plainSummary: parsed.plainSummary ?? "Summary could not be generated.",
      eli12Summary: parsed.eli12Summary ?? "This document could not be summarized simply.",
      redFlagLevel: ["green", "yellow", "red"].includes(parsed.redFlagLevel) ? parsed.redFlagLevel : "green",
      alertCategory: parsed.alertCategory ?? null,
    };
  } catch (err) {
    logger.warn({ err }, "AI summary generation failed, using fallback");
    return {
      plainSummary: `${entityName} released a ${docType} document titled "${title}" for ${year}. Review the original source for full details.`,
      eli12Summary: `${entityName} put out a ${docType} paper about "${title}" for ${year}. It's about how the government does its job.`,
      redFlagLevel: "green",
      alertCategory: null,
    };
  }
}
