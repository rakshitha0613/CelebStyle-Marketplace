-- AlterTable: add passwordChangedAt to User
ALTER TABLE "User" ADD COLUMN "passwordChangedAt" TIMESTAMP(3);

-- AlterTable: add revokedAt to PasswordReset
ALTER TABLE "PasswordReset" ADD COLUMN "revokedAt" TIMESTAMP(3);
