-- CreateTable
CREATE TABLE "CompanyModule" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deactivatedAt" TIMESTAMP(3),
    "settings" JSONB DEFAULT '{}',

    CONSTRAINT "CompanyModule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: unique constraint on (companyId, moduleId)
CREATE UNIQUE INDEX "CompanyModule_companyId_moduleId_key" ON "CompanyModule"("companyId", "moduleId");

-- CreateIndex: index on companyId
CREATE INDEX "CompanyModule_companyId_idx" ON "CompanyModule"("companyId");

-- CreateIndex: index on moduleId
CREATE INDEX "CompanyModule_moduleId_idx" ON "CompanyModule"("moduleId");

-- AddForeignKey
ALTER TABLE "CompanyModule" ADD CONSTRAINT "CompanyModule_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
