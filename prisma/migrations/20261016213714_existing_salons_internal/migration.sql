-- Salons created before subscriptions existed belong to the platform owner.
UPDATE "Salon" SET "plan" = 'INTERNAL' WHERE "trialEndsAt" IS NULL AND "paidUntil" IS NULL;
