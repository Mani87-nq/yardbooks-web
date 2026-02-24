-- Add WIPAY to PaymentMethod enum
ALTER TYPE "PaymentMethod" ADD VALUE 'WIPAY';

-- Create WebhookEvent table for idempotent webhook/callback processing
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- Index for cleanup queries (delete old events by source + date)
CREATE INDEX "WebhookEvent_source_processedAt_idx" ON "WebhookEvent"("source", "processedAt");
