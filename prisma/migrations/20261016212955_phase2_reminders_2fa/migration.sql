-- CreateEnum
CREATE TYPE "CallOutcome" AS ENUM ('REACHED', 'NO_ANSWER', 'WILL_COME', 'OTHER');

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "verified" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "totpSecret" TEXT,
ADD COLUMN     "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ReminderLog" (
    "id" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "calledById" TEXT NOT NULL,
    "calledByName" TEXT NOT NULL,
    "outcome" "CallOutcome" NOT NULL,
    "note" TEXT,
    "snoozedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReminderLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReminderLog_customerId_createdAt_idx" ON "ReminderLog"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "ReminderLog_salonId_createdAt_idx" ON "ReminderLog"("salonId", "createdAt");

-- AddForeignKey
ALTER TABLE "ReminderLog" ADD CONSTRAINT "ReminderLog_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
