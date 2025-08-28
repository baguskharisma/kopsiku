-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'DRIVER', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "public"."FleetType" AS ENUM ('TAXI', 'TRAVEL', 'MOTORCYCLE', 'CAR_SMALL', 'CAR_LARGE', 'CAR_PREMIUM');

-- CreateEnum
CREATE TYPE "public"."FleetStatus" AS ENUM ('ACTIVE', 'MAINTENANCE', 'OUT_OF_SERVICE', 'RETIRED');

-- CreateEnum
CREATE TYPE "public"."PaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'QRIS', 'EWALLET', 'CREDIT_CARD', 'DEBIT_CARD');

-- CreateEnum
CREATE TYPE "public"."OrderStatus" AS ENUM ('PENDING', 'DRIVER_ASSIGNED', 'DRIVER_ACCEPTED', 'DRIVER_ARRIVING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED_BY_CUSTOMER', 'CANCELLED_BY_DRIVER', 'CANCELLED_BY_SYSTEM', 'EXPIRED', 'NO_DRIVER_AVAILABLE');

-- CreateEnum
CREATE TYPE "public"."DriverStatus" AS ENUM ('PENDING_VERIFICATION', 'ACTIVE', 'OFFLINE', 'BUSY', 'SUSPENDED', 'INACTIVE', 'MAINTENANCE_MODE');

-- CreateEnum
CREATE TYPE "public"."VehicleType" AS ENUM ('MOTORCYCLE', 'ECONOMY', 'PREMIUM', 'LUXURY');

-- CreateEnum
CREATE TYPE "public"."LocationCategory" AS ENUM ('POPULAR', 'RECENT', 'FAVORITE', 'HOME', 'WORK', 'CUSTOM');

-- CreateEnum
CREATE TYPE "public"."TripType" AS ENUM ('INSTANT', 'SCHEDULED', 'RECURRING');

-- CreateEnum
CREATE TYPE "public"."PaymentStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED', 'CANCELLED');

-- CreateTable
CREATE TABLE "public"."users" (
    "id" VARCHAR NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "username" TEXT,
    "email" TEXT,
    "phone" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "public"."Role" NOT NULL DEFAULT 'CUSTOMER',
    "avatar_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."driver_profiles" (
    "id" VARCHAR NOT NULL DEFAULT gen_random_uuid(),
    "user_id" VARCHAR NOT NULL,
    "license_number" TEXT NOT NULL,
    "license_expiry" TIMESTAMP(3) NOT NULL,
    "id_card_number" TEXT,
    "address" TEXT NOT NULL,
    "emergency_contact" TEXT NOT NULL,
    "bank_account" TEXT,
    "bank_name" TEXT,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "verified_at" TIMESTAMP(3),
    "verified_by" TEXT,
    "verification_notes" TEXT,
    "rating" REAL NOT NULL DEFAULT 0,
    "total_trips" INTEGER NOT NULL DEFAULT 0,
    "completed_trips" INTEGER NOT NULL DEFAULT 0,
    "cancelled_trips" INTEGER NOT NULL DEFAULT 0,
    "total_earnings" BIGINT NOT NULL DEFAULT 0,
    "current_lat" REAL,
    "current_lng" REAL,
    "last_location_update" TIMESTAMP(3),
    "driver_status" "public"."DriverStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "status_changed_at" TIMESTAMP(3),
    "max_radius" REAL NOT NULL DEFAULT 10,
    "preferred_vehicle_types" "public"."VehicleType"[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "driver_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."fleets" (
    "id" VARCHAR NOT NULL DEFAULT gen_random_uuid(),
    "type" "public"."FleetType" NOT NULL,
    "plate_number" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "color" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 4,
    "status" "public"."FleetStatus" NOT NULL DEFAULT 'ACTIVE',
    "vehicle_type" "public"."VehicleType" NOT NULL,
    "engine_number" TEXT,
    "chassis_number" TEXT,
    "registration_expiry" TIMESTAMP(3),
    "insurance_expiry" TIMESTAMP(3),
    "last_maintenance_at" TIMESTAMP(3),
    "next_maintenance_at" TIMESTAMP(3),
    "base_price_multiplier" REAL NOT NULL DEFAULT 1.0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "fleets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."fleet_assignments" (
    "id" VARCHAR NOT NULL DEFAULT gen_random_uuid(),
    "fleet_id" VARCHAR NOT NULL,
    "driver_id" VARCHAR NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fleet_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."pricing_rules" (
    "id" VARCHAR NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "vehicle_type" "public"."VehicleType" NOT NULL,
    "base_fare" BIGINT NOT NULL,
    "per_km_rate" BIGINT NOT NULL,
    "per_minute_rate" BIGINT NOT NULL,
    "minimum_fare" BIGINT NOT NULL,
    "surge_multiplier" REAL NOT NULL DEFAULT 1.0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "valid_from" TIMESTAMP(3) NOT NULL,
    "valid_to" TIMESTAMP(3),
    "applicable_areas" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pricing_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."orders" (
    "id" VARCHAR NOT NULL DEFAULT gen_random_uuid(),
    "fleet_id" VARCHAR NOT NULL,
    "driver_id" VARCHAR NOT NULL,
    "customer_id" VARCHAR,
    "order_number" TEXT NOT NULL,
    "trip_type" "public"."TripType" NOT NULL DEFAULT 'INSTANT',
    "scheduled_at" TIMESTAMP(3),
    "passenger_name" TEXT NOT NULL,
    "passenger_phone" TEXT NOT NULL,
    "special_requests" TEXT,
    "pickup_address" TEXT NOT NULL,
    "pickup_lat" REAL NOT NULL,
    "pickup_lng" REAL NOT NULL,
    "dropoff_address" TEXT NOT NULL,
    "dropoff_lat" REAL NOT NULL,
    "dropoff_lng" REAL NOT NULL,
    "requested_vehicle_type" "public"."VehicleType" NOT NULL,
    "distance_meters" INTEGER,
    "estimated_duration_minutes" INTEGER,
    "actual_duration_minutes" INTEGER,
    "base_fare" BIGINT NOT NULL,
    "distance_fare" BIGINT NOT NULL DEFAULT 0,
    "time_fare" BIGINT NOT NULL DEFAULT 0,
    "airport_fare" BIGINT NOT NULL DEFAULT 0,
    "surge_fare" BIGINT NOT NULL DEFAULT 0,
    "additional_fare" BIGINT NOT NULL DEFAULT 0,
    "discount" BIGINT NOT NULL DEFAULT 0,
    "total_fare" BIGINT NOT NULL,
    "payment_method" "public"."PaymentMethod" NOT NULL,
    "payment_status" "public"."PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "status" "public"."OrderStatus" NOT NULL DEFAULT 'PENDING',
    "driver_assigned_at" TIMESTAMP(3),
    "driver_accepted_at" TIMESTAMP(3),
    "driver_arrived_at" TIMESTAMP(3),
    "trip_started_at" TIMESTAMP(3),
    "trip_completed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "cancelled_reason" TEXT,
    "cancellation_fee" BIGINT NOT NULL DEFAULT 0,
    "idempotency_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."locations" (
    "id" VARCHAR NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "lat" REAL NOT NULL,
    "lng" REAL NOT NULL,
    "category" "public"."LocationCategory" NOT NULL DEFAULT 'POPULAR',
    "icon" TEXT,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "search_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_locations" (
    "id" VARCHAR NOT NULL DEFAULT gen_random_uuid(),
    "user_id" VARCHAR NOT NULL,
    "location_id" VARCHAR NOT NULL,
    "category" "public"."LocationCategory" NOT NULL DEFAULT 'RECENT',
    "alias" TEXT,
    "access_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ratings" (
    "id" VARCHAR NOT NULL DEFAULT gen_random_uuid(),
    "order_id" VARCHAR NOT NULL,
    "rated_by_id" VARCHAR NOT NULL,
    "rated_user_id" VARCHAR NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "tags" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."order_status_histories" (
    "id" VARCHAR NOT NULL DEFAULT gen_random_uuid(),
    "order_id" VARCHAR NOT NULL,
    "from_status" "public"."OrderStatus" NOT NULL,
    "to_status" "public"."OrderStatus" NOT NULL,
    "reason" TEXT,
    "metadata" JSONB,
    "changed_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_status_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."payments" (
    "id" VARCHAR NOT NULL DEFAULT gen_random_uuid(),
    "order_id" VARCHAR NOT NULL,
    "payment_method" "public"."PaymentMethod" NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_id" TEXT,
    "provider_order_id" TEXT,
    "amount" BIGINT NOT NULL,
    "platform_fee" BIGINT NOT NULL DEFAULT 0,
    "driver_earning" BIGINT NOT NULL DEFAULT 0,
    "status" "public"."PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paid_at" TIMESTAMP(3),
    "raw_response" JSONB,
    "failure_reason" TEXT,
    "refund_amount" BIGINT NOT NULL DEFAULT 0,
    "refunded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."otps" (
    "id" VARCHAR NOT NULL DEFAULT gen_random_uuid(),
    "phone" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "is_used" BOOLEAN NOT NULL DEFAULT false,
    "user_id" VARCHAR,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."refresh_tokens" (
    "id" VARCHAR NOT NULL DEFAULT gen_random_uuid(),
    "user_id" VARCHAR NOT NULL,
    "token_hash" TEXT NOT NULL,
    "device_id" TEXT,
    "user_agent" TEXT,
    "ip_address" TEXT,
    "is_revoked" BOOLEAN NOT NULL DEFAULT false,
    "revoked_at" TIMESTAMP(3),
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."driver_status_histories" (
    "id" VARCHAR NOT NULL DEFAULT gen_random_uuid(),
    "driver_id" VARCHAR NOT NULL,
    "from_status" "public"."DriverStatus" NOT NULL,
    "to_status" "public"."DriverStatus" NOT NULL,
    "reason" TEXT,
    "metadata" JSONB,
    "changed_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "driver_status_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."audit_logs" (
    "id" VARCHAR NOT NULL DEFAULT gen_random_uuid(),
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resource_id" TEXT,
    "old_values" JSONB,
    "new_values" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "user_id" VARCHAR,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."app_configs" (
    "id" VARCHAR NOT NULL DEFAULT gen_random_uuid(),
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'string',
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "public"."users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "public"."users"("phone");

-- CreateIndex
CREATE INDEX "users_phone_idx" ON "public"."users"("phone");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "public"."users"("email");

-- CreateIndex
CREATE INDEX "users_role_is_active_idx" ON "public"."users"("role", "is_active");

-- CreateIndex
CREATE INDEX "users_created_at_idx" ON "public"."users"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "driver_profiles_user_id_key" ON "public"."driver_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "driver_profiles_license_number_key" ON "public"."driver_profiles"("license_number");

-- CreateIndex
CREATE UNIQUE INDEX "driver_profiles_id_card_number_key" ON "public"."driver_profiles"("id_card_number");

-- CreateIndex
CREATE INDEX "driver_profiles_driver_status_idx" ON "public"."driver_profiles"("driver_status");

-- CreateIndex
CREATE INDEX "driver_profiles_rating_idx" ON "public"."driver_profiles"("rating");

-- CreateIndex
CREATE INDEX "driver_profiles_is_verified_idx" ON "public"."driver_profiles"("is_verified");

-- CreateIndex
CREATE INDEX "driver_profiles_current_lat_current_lng_idx" ON "public"."driver_profiles"("current_lat", "current_lng");

-- CreateIndex
CREATE UNIQUE INDEX "fleets_plate_number_key" ON "public"."fleets"("plate_number");

-- CreateIndex
CREATE INDEX "fleets_status_vehicle_type_idx" ON "public"."fleets"("status", "vehicle_type");

-- CreateIndex
CREATE INDEX "fleets_type_idx" ON "public"."fleets"("type");

-- CreateIndex
CREATE INDEX "fleets_plate_number_idx" ON "public"."fleets"("plate_number");

-- CreateIndex
CREATE INDEX "fleet_assignments_fleet_id_is_active_idx" ON "public"."fleet_assignments"("fleet_id", "is_active");

-- CreateIndex
CREATE INDEX "fleet_assignments_driver_id_is_active_idx" ON "public"."fleet_assignments"("driver_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "fleet_assignments_fleet_id_driver_id_is_active_key" ON "public"."fleet_assignments"("fleet_id", "driver_id", "is_active");

-- CreateIndex
CREATE INDEX "pricing_rules_vehicle_type_is_active_idx" ON "public"."pricing_rules"("vehicle_type", "is_active");

-- CreateIndex
CREATE INDEX "pricing_rules_valid_from_valid_to_idx" ON "public"."pricing_rules"("valid_from", "valid_to");

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_number_key" ON "public"."orders"("order_number");

-- CreateIndex
CREATE UNIQUE INDEX "orders_idempotency_key_key" ON "public"."orders"("idempotency_key");

-- CreateIndex
CREATE INDEX "orders_customer_id_status_created_at_idx" ON "public"."orders"("customer_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "orders_driver_id_status_created_at_idx" ON "public"."orders"("driver_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "orders_status_scheduled_at_idx" ON "public"."orders"("status", "scheduled_at");

-- CreateIndex
CREATE INDEX "orders_order_number_idx" ON "public"."orders"("order_number");

-- CreateIndex
CREATE INDEX "orders_pickup_lat_pickup_lng_idx" ON "public"."orders"("pickup_lat", "pickup_lng");

-- CreateIndex
CREATE INDEX "locations_category_is_active_idx" ON "public"."locations"("category", "is_active");

-- CreateIndex
CREATE INDEX "locations_lat_lng_idx" ON "public"."locations"("lat", "lng");

-- CreateIndex
CREATE INDEX "locations_search_count_idx" ON "public"."locations"("search_count");

-- CreateIndex
CREATE INDEX "user_locations_user_id_category_idx" ON "public"."user_locations"("user_id", "category");

-- CreateIndex
CREATE UNIQUE INDEX "user_locations_user_id_location_id_key" ON "public"."user_locations"("user_id", "location_id");

-- CreateIndex
CREATE UNIQUE INDEX "ratings_order_id_key" ON "public"."ratings"("order_id");

-- CreateIndex
CREATE INDEX "ratings_rated_user_id_idx" ON "public"."ratings"("rated_user_id");

-- CreateIndex
CREATE INDEX "ratings_rating_idx" ON "public"."ratings"("rating");

-- CreateIndex
CREATE INDEX "order_status_histories_order_id_created_at_idx" ON "public"."order_status_histories"("order_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "payments_order_id_key" ON "public"."payments"("order_id");

-- CreateIndex
CREATE INDEX "payments_status_created_at_idx" ON "public"."payments"("status", "created_at");

-- CreateIndex
CREATE INDEX "payments_provider_provider_id_idx" ON "public"."payments"("provider", "provider_id");

-- CreateIndex
CREATE INDEX "otps_phone_purpose_is_used_idx" ON "public"."otps"("phone", "purpose", "is_used");

-- CreateIndex
CREATE INDEX "otps_expires_at_idx" ON "public"."otps"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "public"."refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_is_revoked_idx" ON "public"."refresh_tokens"("user_id", "is_revoked");

-- CreateIndex
CREATE INDEX "refresh_tokens_token_hash_idx" ON "public"."refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "driver_status_histories_driver_id_created_at_idx" ON "public"."driver_status_histories"("driver_id", "created_at");

-- CreateIndex
CREATE INDEX "driver_status_histories_to_status_created_at_idx" ON "public"."driver_status_histories"("to_status", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_resource_action_created_at_idx" ON "public"."audit_logs"("resource", "action", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_created_at_idx" ON "public"."audit_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "public"."audit_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "app_configs_key_key" ON "public"."app_configs"("key");

-- CreateIndex
CREATE INDEX "app_configs_key_idx" ON "public"."app_configs"("key");

-- CreateIndex
CREATE INDEX "app_configs_is_public_idx" ON "public"."app_configs"("is_public");

-- AddForeignKey
ALTER TABLE "public"."driver_profiles" ADD CONSTRAINT "driver_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fleet_assignments" ADD CONSTRAINT "fleet_assignments_fleet_id_fkey" FOREIGN KEY ("fleet_id") REFERENCES "public"."fleets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fleet_assignments" ADD CONSTRAINT "fleet_assignments_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_fleet_id_fkey" FOREIGN KEY ("fleet_id") REFERENCES "public"."fleets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_locations" ADD CONSTRAINT "user_locations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_locations" ADD CONSTRAINT "user_locations_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ratings" ADD CONSTRAINT "ratings_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ratings" ADD CONSTRAINT "ratings_rated_by_id_fkey" FOREIGN KEY ("rated_by_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ratings" ADD CONSTRAINT "ratings_rated_user_id_fkey" FOREIGN KEY ("rated_user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_status_histories" ADD CONSTRAINT "order_status_histories_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."otps" ADD CONSTRAINT "otps_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."driver_status_histories" ADD CONSTRAINT "driver_status_histories_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "public"."driver_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
