-- CreateEnum
CREATE TYPE "public"."CoinTransactionType" AS ENUM ('TOP_UP', 'DEDUCTION', 'REFUND', 'BONUS', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "public"."CoinTransactionStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED', 'EXPIRED');

-- AlterEnum
ALTER TYPE "public"."PaymentMethod" ADD VALUE 'COINS';

-- AlterTable
ALTER TABLE "public"."orders" ADD COLUMN     "additional_fare_coins" BIGINT DEFAULT 0,
ADD COLUMN     "airport_fare_coins" BIGINT DEFAULT 0,
ADD COLUMN     "base_fare_coins" BIGINT,
ADD COLUMN     "cancellation_fee_coins" BIGINT DEFAULT 0,
ADD COLUMN     "discount_coins" BIGINT DEFAULT 0,
ADD COLUMN     "distance_fare_coins" BIGINT DEFAULT 0,
ADD COLUMN     "surge_fare_coins" BIGINT DEFAULT 0,
ADD COLUMN     "time_fare_coins" BIGINT DEFAULT 0,
ADD COLUMN     "total_fare_coins" BIGINT;

-- AlterTable
ALTER TABLE "public"."payments" ADD COLUMN     "coin_amount" BIGINT,
ADD COLUMN     "coin_transaction_id" TEXT;

-- AlterTable
ALTER TABLE "public"."pricing_rules" ADD COLUMN     "base_fare_coins" BIGINT,
ADD COLUMN     "minimum_fare_coins" BIGINT,
ADD COLUMN     "per_km_rate_coins" BIGINT,
ADD COLUMN     "per_minute_rate_coins" BIGINT;

-- CreateTable
CREATE TABLE "public"."coin_wallets" (
    "id" VARCHAR NOT NULL DEFAULT gen_random_uuid(),
    "user_id" VARCHAR NOT NULL,
    "balance" BIGINT NOT NULL DEFAULT 0,
    "total_top_up" BIGINT NOT NULL DEFAULT 0,
    "total_spent" BIGINT NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_frozen" BOOLEAN NOT NULL DEFAULT false,
    "frozen_reason" TEXT,
    "frozen_at" TIMESTAMP(3),
    "frozen_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coin_wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."coin_transactions" (
    "id" VARCHAR NOT NULL DEFAULT gen_random_uuid(),
    "user_id" VARCHAR NOT NULL,
    "type" "public"."CoinTransactionType" NOT NULL,
    "status" "public"."CoinTransactionStatus" NOT NULL DEFAULT 'PENDING',
    "amount" BIGINT NOT NULL,
    "description" TEXT NOT NULL,
    "balance_before" BIGINT NOT NULL,
    "balance_after" BIGINT NOT NULL,
    "reference_type" TEXT,
    "reference_id" TEXT,
    "order_id" VARCHAR,
    "top_up_request_id" VARCHAR,
    "processed_by" TEXT,
    "processed_at" TIMESTAMP(3),
    "metadata" JSONB,
    "notes" TEXT,
    "idempotency_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coin_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."coin_top_up_requests" (
    "id" VARCHAR NOT NULL DEFAULT gen_random_uuid(),
    "customer_id" VARCHAR NOT NULL,
    "processed_by_id" VARCHAR,
    "requested_amount" BIGINT NOT NULL,
    "approved_amount" BIGINT,
    "reason" TEXT NOT NULL,
    "payment_proof" TEXT,
    "payment_method" TEXT,
    "payment_details" JSONB,
    "status" "public"."CoinTransactionStatus" NOT NULL DEFAULT 'PENDING',
    "admin_notes" TEXT,
    "rejection_reason" TEXT,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coin_top_up_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "coin_wallets_user_id_key" ON "public"."coin_wallets"("user_id");

-- CreateIndex
CREATE INDEX "coin_wallets_user_id_idx" ON "public"."coin_wallets"("user_id");

-- CreateIndex
CREATE INDEX "coin_wallets_is_active_is_frozen_idx" ON "public"."coin_wallets"("is_active", "is_frozen");

-- CreateIndex
CREATE UNIQUE INDEX "coin_transactions_idempotency_key_key" ON "public"."coin_transactions"("idempotency_key");

-- CreateIndex
CREATE INDEX "coin_transactions_user_id_created_at_idx" ON "public"."coin_transactions"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "coin_transactions_type_status_idx" ON "public"."coin_transactions"("type", "status");

-- CreateIndex
CREATE INDEX "coin_transactions_reference_type_reference_id_idx" ON "public"."coin_transactions"("reference_type", "reference_id");

-- CreateIndex
CREATE INDEX "coin_transactions_order_id_idx" ON "public"."coin_transactions"("order_id");

-- CreateIndex
CREATE INDEX "coin_transactions_top_up_request_id_idx" ON "public"."coin_transactions"("top_up_request_id");

-- CreateIndex
CREATE INDEX "coin_transactions_created_at_idx" ON "public"."coin_transactions"("created_at");

-- CreateIndex
CREATE INDEX "coin_top_up_requests_customer_id_status_idx" ON "public"."coin_top_up_requests"("customer_id", "status");

-- CreateIndex
CREATE INDEX "coin_top_up_requests_processed_by_id_status_idx" ON "public"."coin_top_up_requests"("processed_by_id", "status");

-- CreateIndex
CREATE INDEX "coin_top_up_requests_status_requested_at_idx" ON "public"."coin_top_up_requests"("status", "requested_at");

-- CreateIndex
CREATE INDEX "coin_top_up_requests_created_at_idx" ON "public"."coin_top_up_requests"("created_at");

-- CreateIndex
CREATE INDEX "orders_payment_method_payment_status_idx" ON "public"."orders"("payment_method", "payment_status");

-- CreateIndex
CREATE INDEX "payments_payment_method_idx" ON "public"."payments"("payment_method");

-- AddForeignKey
ALTER TABLE "public"."coin_wallets" ADD CONSTRAINT "coin_wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."coin_transactions" ADD CONSTRAINT "coin_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."coin_transactions" ADD CONSTRAINT "coin_transactions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."coin_transactions" ADD CONSTRAINT "coin_transactions_top_up_request_id_fkey" FOREIGN KEY ("top_up_request_id") REFERENCES "public"."coin_top_up_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."coin_top_up_requests" ADD CONSTRAINT "coin_top_up_requests_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."coin_top_up_requests" ADD CONSTRAINT "coin_top_up_requests_processed_by_id_fkey" FOREIGN KEY ("processed_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
