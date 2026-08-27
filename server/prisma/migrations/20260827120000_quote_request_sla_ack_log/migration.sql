-- Quote Request: logged-by accountability, status note, and acknowledgement-email draft/sent tracking.
-- No stored deadline - the 24h SLA overdue flag is computed at read time from createdAt.

ALTER TABLE "QuotationRequest"
  ADD COLUMN "loggedById" TEXT,
  ADD COLUMN "statusNote" TEXT,
  ADD COLUMN "ackEmailBody" TEXT,
  ADD COLUMN "ackDraftSavedAt" TIMESTAMP(3),
  ADD COLUMN "acknowledgedAt" TIMESTAMP(3);

ALTER TABLE "QuotationRequest"
  ADD CONSTRAINT "QuotationRequest_loggedById_fkey"
  FOREIGN KEY ("loggedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
