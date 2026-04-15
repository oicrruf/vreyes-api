-- CreateEnum
CREATE TYPE "DteType" AS ENUM ('purchase', 'sale');

-- CreateTable
CREATE TABLE "dte" (
    "generation_code" TEXT NOT NULL,
    "type" "DteType" NOT NULL,
    "issue_date" TEXT NOT NULL,
    "receiver_nrc" TEXT NOT NULL,
    "issuer_nrc" TEXT NOT NULL,
    "issuer_name" TEXT NOT NULL,
    "exempt_total" DOUBLE PRECISION NOT NULL,
    "taxable_total" DOUBLE PRECISION NOT NULL,
    "amount_due" DOUBLE PRECISION NOT NULL,
    "tax_value" DOUBLE PRECISION NOT NULL,
    "pdf_url" TEXT,
    "raw_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dte_pkey" PRIMARY KEY ("generation_code")
);
