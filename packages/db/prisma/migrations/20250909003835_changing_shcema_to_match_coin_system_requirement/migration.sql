/*
  Warnings:

  - A unique constraint covering the columns `[request_number]` on the table `coin_top_up_requests` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `request_number` to the `coin_top_up_requests` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "public"."CoinTransactionStatus" ADD VALUE 'PROCESSING';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."CoinTransactionType" ADD VALUE 'OPERATIONAL_FEE';
ALTER TYPE "public"."CoinTransactionType" ADD VALUE 'COMMISSION';

-- DropIndex
DROP INDEX "public"."coin_top_up_requests_created_at_idx";

-- AlterTable
ALTER TABLE "public"."coin_top_up_requests" ADD COLUMN     "approved_at" TIMESTAMP(3),
ADD COLUMN     "bank_transfer_details" JSONB,
ADD COLUMN     "contact_preference" TEXT,
ADD COLUMN     "customer_notes" TEXT,
ADD COLUMN     "request_number" TEXT NOT NULL,
ADD COLUMN     "reviewed_at" TIMESTAMP(3),
ADD COLUMN     "urgency_level" TEXT NOT NULL DEFAULT 'NORMAL';

-- AlterTable
ALTER TABLE "public"."coin_transactions" ADD COLUMN     "base_fare_amount" BIGINT,
ADD COLUMN     "fee_percentage" DOUBLE PRECISION,
ADD COLUMN     "ip_address" TEXT,
ADD COLUMN     "operational_fee_config" JSONB,
ADD COLUMN     "transaction_hash" TEXT,
ADD COLUMN     "user_agent" TEXT;

-- AlterTable
ALTER TABLE "public"."coin_wallets" ADD COLUMN     "daily_spend_limit" BIGINT,
ADD COLUMN     "last_transaction_at" TIMESTAMP(3),
ADD COLUMN     "monthly_spend_limit" BIGINT,
ADD COLUMN     "total_operational_fees" BIGINT NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "public"."orders" ADD COLUMN     "operational_fee_charged_at" TIMESTAMP(3),
ADD COLUMN     "operational_fee_coins" BIGINT DEFAULT 0,
ADD COLUMN     "operational_fee_config" JSONB,
ADD COLUMN     "operational_fee_percent" DOUBLE PRECISION,
ADD COLUMN     "operational_fee_status" TEXT DEFAULT 'PENDING',
ADD COLUMN     "operational_fee_transaction_id" TEXT;

-- CreateTable
CREATE TABLE "public"."coin_spending_limits" (
    "id" VARCHAR NOT NULL DEFAULT gen_random_uuid(),
    "user_id" VARCHAR NOT NULL,
    "daily_limit" BIGINT NOT NULL,
    "monthly_limit" BIGINT NOT NULL,
    "daily_spent" BIGINT NOT NULL DEFAULT 0,
    "monthly_spent" BIGINT NOT NULL DEFAULT 0,
    "last_daily_reset" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_monthly_reset" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coin_spending_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."operational_fee_configs" (
    "id" VARCHAR NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "percentage_of_base_fare" DOUBLE PRECISION NOT NULL DEFAULT 0.10,
    "minimum_fee_coins" BIGINT,
    "maximum_fee_coins" BIGINT,
    "flat_fee_coins" BIGINT,
    "vehicle_types" "public"."VehicleType"[],
    "userRoles" "public"."Role"[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "valid_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_to" TIMESTAMP(3),
    "applicable_areas" JSONB,
    "minimum_order_value" BIGINT,
    "maximum_order_value" BIGINT,
    "description" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,

    CONSTRAINT "operational_fee_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "coin_spending_limits_user_id_is_active_idx" ON "public"."coin_spending_limits"("user_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "coin_spending_limits_user_id_key" ON "public"."coin_spending_limits"("user_id");

-- CreateIndex
CREATE INDEX "operational_fee_configs_is_active_valid_from_valid_to_idx" ON "public"."operational_fee_configs"("is_active", "valid_from", "valid_to");

-- CreateIndex
CREATE INDEX "operational_fee_configs_vehicle_types_idx" ON "public"."operational_fee_configs"("vehicle_types");

-- CreateIndex
CREATE UNIQUE INDEX "coin_top_up_requests_request_number_key" ON "public"."coin_top_up_requests"("request_number");

-- CreateIndex
CREATE INDEX "coin_top_up_requests_urgency_level_status_idx" ON "public"."coin_top_up_requests"("urgency_level", "status");

-- CreateIndex
CREATE INDEX "coin_top_up_requests_request_number_idx" ON "public"."coin_top_up_requests"("request_number");

-- CreateIndex
CREATE INDEX "coin_transactions_status_processed_at_idx" ON "public"."coin_transactions"("status", "processed_at");

-- CreateIndex
CREATE INDEX "coin_wallets_last_transaction_at_idx" ON "public"."coin_wallets"("last_transaction_at");

-- CreateIndex
CREATE INDEX "orders_operational_fee_status_idx" ON "public"."orders"("operational_fee_status");

-- AddForeignKey
ALTER TABLE "public"."coin_spending_limits" ADD CONSTRAINT "coin_spending_limits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
