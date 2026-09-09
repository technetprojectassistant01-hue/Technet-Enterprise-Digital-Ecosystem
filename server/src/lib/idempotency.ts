import { prisma } from "./prisma";
import { isUniqueConstraintError } from "./prismaErrors";

/**
 * Deduplicates a retried write coming from the offline outbox (client/src/lib/outbox.ts).
 *
 * A queued submission whose response was lost — it succeeded on the server, then the
 * technician's signal dropped before the 200 came back — gets replayed when the device
 * reconnects. Without this the replay would create a second row. The client sends a stable
 * `clientRequestId` (a UUID minted once, when the item is enqueued) with every such
 * submission; the first request through claims it and any replay short-circuits.
 *
 * The marker is written up front, before the work, so two genuinely concurrent replays can't
 * both proceed. If the work then fails, the caller MUST call `releaseRequest` so a legitimate
 * later retry isn't wrongly treated as a duplicate.
 *
 * A request with no `clientRequestId` (anything not coming through the outbox) always
 * proceeds — this is transparent to every existing caller.
 */
export async function claimRequest(clientRequestId: unknown, kind: string): Promise<boolean> {
  if (typeof clientRequestId !== "string" || !clientRequestId.trim()) return true;
  try {
    await prisma.processedRequest.create({ data: { id: clientRequestId.trim(), kind } });
    return true;
  } catch (err) {
    if (isUniqueConstraintError(err)) return false;
    throw err;
  }
}

/** Undoes a `claimRequest` when the work it guarded did not complete. Best-effort. */
export async function releaseRequest(clientRequestId: unknown): Promise<void> {
  if (typeof clientRequestId !== "string" || !clientRequestId.trim()) return;
  await prisma.processedRequest.delete({ where: { id: clientRequestId.trim() } }).catch(() => {});
}

/**
 * Records the id of the row a claimed request created. Only needed for a multi-step submission
 * (an intervention report followed by its photos), where a replay that gets deduped still needs
 * the report id to carry on uploading. Best-effort — a missed write just means the replay finds
 * no prior result and the client re-sends, which the create's own dedup still catches.
 */
export async function recordRequestResult(clientRequestId: unknown, resultId: string): Promise<void> {
  if (typeof clientRequestId !== "string" || !clientRequestId.trim()) return;
  await prisma.processedRequest
    .update({ where: { id: clientRequestId.trim() }, data: { resultId } })
    .catch(() => {});
}

/** The row id a previously-processed request created, if it recorded one. */
export async function priorRequestResult(clientRequestId: unknown): Promise<string | null> {
  if (typeof clientRequestId !== "string" || !clientRequestId.trim()) return null;
  const row = await prisma.processedRequest.findUnique({ where: { id: clientRequestId.trim() } });
  return row?.resultId ?? null;
}
