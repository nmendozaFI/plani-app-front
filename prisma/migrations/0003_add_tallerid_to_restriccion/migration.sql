-- AlterTable
ALTER TABLE "restriccion" ADD COLUMN "tallerId" INTEGER;

-- CreateIndex
CREATE INDEX "restriccion_tallerId_idx" ON "restriccion"("tallerId");

-- AddForeignKey
ALTER TABLE "restriccion" ADD CONSTRAINT "restriccion_tallerId_fkey" FOREIGN KEY ("tallerId") REFERENCES "taller"("id") ON DELETE SET NULL ON UPDATE CASCADE;
