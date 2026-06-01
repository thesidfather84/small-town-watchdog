import { Router } from "express";
import { db } from "@workspace/db";
import { electionsTable, ballotItemsTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { asyncHandler } from "../lib/asyncHandler";

const router = Router();

async function getBallotItemCount(electionId: number): Promise<number> {
  const items = await db
    .select({ id: ballotItemsTable.id })
    .from(ballotItemsTable)
    .where(eq(ballotItemsTable.electionId, electionId));
  return items.length;
}

function formatElection(election: typeof electionsTable.$inferSelect, ballotItemCount = 0) {
  return {
    ...election,
    electionDate: election.electionDate,
    earlyVotingStart: election.earlyVotingStart ?? null,
    earlyVotingEnd: election.earlyVotingEnd ?? null,
    createdAt: election.createdAt.toISOString(),
    ballotItemCount,
  };
}

function formatBallotItem(item: typeof ballotItemsTable.$inferSelect) {
  return {
    ...item,
    createdAt: item.createdAt.toISOString(),
  };
}

router.get("/", asyncHandler(async (req, res): Promise<void> => {
  const { state } = req.query as { state?: string };

  const elections = await db
    .select()
    .from(electionsTable)
    .orderBy(desc(electionsTable.electionDate));

  const filtered = state
    ? elections.filter((e) => e.electionState === state)
    : elections;

  const results = await Promise.all(
    filtered.map(async (e) => formatElection(e, await getBallotItemCount(e.id)))
  );

  res.json(results);
}));

router.post("/", asyncHandler(async (req, res): Promise<void> => {
  const body = req.body as Record<string, unknown>;
  if (!body.title || !body.electionDate || !body.electionType) {
    res.status(400).json({ error: "title, electionDate, and electionType are required" });
    return;
  }

  const [election] = await db
    .insert(electionsTable)
    .values({
      title: String(body.title),
      electionDate: String(body.electionDate),
      earlyVotingStart: body.earlyVotingStart ? String(body.earlyVotingStart) : undefined,
      earlyVotingEnd: body.earlyVotingEnd ? String(body.earlyVotingEnd) : undefined,
      description: body.description ? String(body.description) : undefined,
      entityId: body.entityId ? Number(body.entityId) : undefined,
      electionType: String(body.electionType),
      electionState: body.electionState ? String(body.electionState) : "upcoming",
    })
    .returning();

  res.status(201).json(formatElection(election, 0));
}));

router.get("/:id", asyncHandler(async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [election] = await db
    .select()
    .from(electionsTable)
    .where(eq(electionsTable.id, id));

  if (!election) { res.status(404).json({ error: "Election not found" }); return; }

  const count = await getBallotItemCount(id);
  res.json(formatElection(election, count));
}));

router.patch("/:id", asyncHandler(async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const body = req.body as Record<string, unknown>;
  const updates: Record<string, unknown> = {};

  if (body.title !== undefined) updates.title = String(body.title);
  if (body.electionDate !== undefined) updates.electionDate = String(body.electionDate);
  if (body.earlyVotingStart !== undefined) updates.earlyVotingStart = body.earlyVotingStart ? String(body.earlyVotingStart) : null;
  if (body.earlyVotingEnd !== undefined) updates.earlyVotingEnd = body.earlyVotingEnd ? String(body.earlyVotingEnd) : null;
  if (body.description !== undefined) updates.description = body.description ? String(body.description) : null;
  if (body.entityId !== undefined) updates.entityId = body.entityId ? Number(body.entityId) : null;
  if (body.electionType !== undefined) updates.electionType = String(body.electionType);
  if (body.electionState !== undefined) updates.electionState = String(body.electionState);

  const [election] = await db
    .update(electionsTable)
    .set(updates)
    .where(eq(electionsTable.id, id))
    .returning();

  if (!election) { res.status(404).json({ error: "Election not found" }); return; }

  const count = await getBallotItemCount(id);
  res.json(formatElection(election, count));
}));

router.delete("/:id", asyncHandler(async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  await db.delete(ballotItemsTable).where(eq(ballotItemsTable.electionId, id));
  const [deleted] = await db
    .delete(electionsTable)
    .where(eq(electionsTable.id, id))
    .returning();

  if (!deleted) { res.status(404).json({ error: "Election not found" }); return; }
  res.status(204).send();
}));

router.get("/:id/ballot-items", asyncHandler(async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const items = await db
    .select()
    .from(ballotItemsTable)
    .where(eq(ballotItemsTable.electionId, id))
    .orderBy(ballotItemsTable.id);

  res.json(items.map(formatBallotItem));
}));

router.post("/:id/ballot-items", asyncHandler(async (req, res): Promise<void> => {
  const electionId = parseInt(String(req.params.id));
  if (isNaN(electionId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const body = req.body as Record<string, unknown>;
  if (!body.title || !body.itemType) {
    res.status(400).json({ error: "title and itemType are required" });
    return;
  }

  const [item] = await db
    .insert(ballotItemsTable)
    .values({
      electionId,
      title: String(body.title),
      itemType: String(body.itemType),
      description: body.description ? String(body.description) : undefined,
      officialText: body.officialText ? String(body.officialText) : undefined,
      yesMeans: body.yesMeans ? String(body.yesMeans) : undefined,
      noMeans: body.noMeans ? String(body.noMeans) : undefined,
      whoPays: body.whoPays ? String(body.whoPays) : undefined,
      amountInvolved: body.amountInvolved ? String(body.amountInvolved) : undefined,
      duration: body.duration ? String(body.duration) : undefined,
      receivingBody: body.receivingBody ? String(body.receivingBody) : undefined,
      changeType: body.changeType ? String(body.changeType) : undefined,
      sourceUrl: body.sourceUrl ? String(body.sourceUrl) : undefined,
    })
    .returning();

  res.status(201).json(formatBallotItem(item));
}));

export { router as electionsRouter };
