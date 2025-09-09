/*
  Warnings:

  - You are about to drop the column `base_fare_amount` on the `coin_transactions` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."coin_transactions" DROP COLUMN "base_fare_amount",
ADD COLUMN     "distance_fare_amount" BIGINT;
