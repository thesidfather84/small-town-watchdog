import { Router } from "express";
import { db } from "@workspace/db";
import { ballotItemsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { asyncHandler } from "../lib/asyncHandler";

const router = Router();

function formatBallotItem(item: typeof ballotItemsTable.$inferSelect) {
  return { ...item, createdAt: item.createdAt.toISOString() };
}

router.patch("/:id", asyncHandler(async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const body = req.body as Record<string, unknown>;
  const updates: Record<string, unknown> = {};

  if (body.title !== undefined) updates.title = String(body.title);
  if (body.itemType !== undefined) updates.itemType = String(body.itemType);
  if (body.description !== undefined) updates.description = body.description ? String(body.description) : null;
  if (body.officialText !== undefined) updates.officialText = body.officialText ? String(body.officialText) : null;
  if (body.yesMeans !== undefined) updates.yesMeans = body.yesMeans ? String(body.yesMeans) : null;
  if (body.noMeans !== undefined) updates.noMeans = body.noMeans ? String(body.noMeans) : null;
  if (body.whoPays !== undefined) updates.whoPays = body.whoPays ? String(body.whoPays) : null;
  if (body.amountInvolved !== undefined) updates.amountInvolved = body.amountInvolved ? String(body.amountInvolved) : null;
  if (body.duration !== undefined) updates.duration = body.duration ? String(body.duration) : null;
  if (body.receivingBody !== undefined) updates.receivingBody = body.receivingBody ? String(body.receivingBody) : null;
  if (body.changeType !== undefined) updates.changeType = body.changeType ? String(body.changeType) : null;
  if (body.sourceUrl !== undefined) updates.sourceUrl = body.sourceUrl ? String(body.sourceUrl) : null;

  const [item] = await db
    .update(ballotItemsTable)
    .set(updates)
    .where(eq(ballotItemsTable.id, id))
    .returning();

  if (!item) { res.status(404).json({ error: "Ballot item not found" }); return; }
  res.json(formatBallotItem(item));
}));

router.delete("/:id", asyncHandler(async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [deleted] = await db
    .delete(ballotItemsTable)
    .where(eq(ballotItemsTable.id, id))
    .returning();

  if (!deleted) { res.status(404).json({ error: "Ballot item not found" }); return; }
  res.status(204).send();
}));

router.post("/:id/explain", asyncHandler(async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [item] = await db
    .select()
    .from(ballotItemsTable)
    .where(eq(ballotItemsTable.id, id));

  if (!item) { res.status(404).json({ error: "Ballot item not found" }); return; }

  try {
    const { OpenAI } = await import("openai");
    const client = new OpenAI({ baseURL: process.env.OPENAI_API_BASE, apiKey: process.env.OPENAI_API_KEY });

    const prompt = `You are a neutral civic education assistant. Never tell people how to vote. Never endorse any position.

Ballot item: "${item.title}"
Type: ${item.itemType}
${item.officialText ? `Official text: ${item.officialText}` : ""}
${item.description ? `Existing description: ${item.description}` : ""}

Generate a neutral, plain-English ballot explainer. Return a JSON object with these exact fields:
- description: plain English explanation of what this measure does (2-3 sentences, completely neutral)
- yesMeans: what a YES vote means (factual statement, no opinion, no recommendation)
- noMeans: what a NO vote means (factual statement, no opinion, no recommendation)
- whoPays: who would pay for this if it passes
- amountInvolved: the dollar amount involved (e.g. "$2.5 million per year" or "Not specified")
- duration: how long this would last (e.g. "10 years", "Permanent", "Not specified")
- receivingBody: which government body or purpose receives the funds
- changeType: one of: new, renewed, increased, continued

Rules:
- Stay completely neutral. Never use persuasive language.
- If you don't know something, write "Not specified".
- Keep each field to 1-2 sentences maximum.

Return only valid JSON, no markdown.`;

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("No response from AI");

    const parsed = JSON.parse(content) as Record<string, string>;

    const [updated] = await db
      .update(ballotItemsTable)
      .set({
        description: parsed.description || item.description,
        yesMeans: parsed.yesMeans || item.yesMeans,
        noMeans: parsed.noMeans || item.noMeans,
        whoPays: parsed.whoPays || item.whoPays,
        amountInvolved: parsed.amountInvolved || item.amountInvolved,
        duration: parsed.duration || item.duration,
        receivingBody: parsed.receivingBody || item.receivingBody,
        changeType: parsed.changeType || item.changeType,
        isAiGenerated: true,
      })
      .where(eq(ballotItemsTable.id, id))
      .returning();

    res.json(formatBallotItem(updated));
  } catch (err) {
    req.log.error({ err }, "AI ballot explanation failed");
    res.status(502).json({ error: "AI explanation failed. Please try again." });
  }
}));

export { router as ballotItemsRouter };
