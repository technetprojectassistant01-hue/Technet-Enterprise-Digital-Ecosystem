-- Lets a deduped replay of a multi-step submission recover the id of the row the original
-- request created. An intervention report is filed as a create followed by one upload per
-- photo; if the create's response is lost and the replay only gets "already handled", it has
-- no report id to attach the photos to. Storing it here closes that gap.

ALTER TABLE "ProcessedRequest" ADD COLUMN "resultId" TEXT;
