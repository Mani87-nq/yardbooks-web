-- AlterTable
ALTER TABLE "Company" ADD COLUMN "terminalCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Company_terminalCode_key" ON "Company"("terminalCode");

-- CreateIndex
CREATE INDEX "Company_terminalCode_idx" ON "Company"("terminalCode");
