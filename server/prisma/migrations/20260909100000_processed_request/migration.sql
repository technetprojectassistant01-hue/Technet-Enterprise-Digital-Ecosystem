-- Dedup marker for retried offline submissions (see client/src/lib/outbox.ts). A queued
-- check-in or field report whose 200 response was lost to a signal drop is replayed when the
-- device reconnects; the first request through records its client-generated id here and every
-- replay short-circuits instead of writing a second row.

CREATE TABLE "ProcessedRequest" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedRequest_pkey" PRIMARY KEY ("id")
);
