-- AlterTable
ALTER TABLE "Document" DROP COLUMN "storageKey",
ADD COLUMN     "data" BYTEA NOT NULL;

