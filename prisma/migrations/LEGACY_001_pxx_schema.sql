-- ============================================
-- PXX — Database Schema Migration
-- PostgreSQL 16 + PostGIS
-- Generated from Prisma schema
-- ============================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ============================================
-- ENUMS
-- ============================================

DO $$ BEGIN
  CREATE TYPE "UserRole" AS ENUM ('tourist', 'municipal_admin', 'super_admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "RouteAvailability" AS ENUM ('permanent', 'temporal', 'event');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ThemeId" AS ENUM ('mountain', 'coast', 'city', 'interior', 'bloom');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "VideoType" AS ENUM ('snack', 'dinner');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- 1. MUNICIPALITIES
-- ============================================

CREATE TABLE IF NOT EXISTS "municipalities" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name_translations" JSONB NOT NULL DEFAULT '{}',
  "logo_url" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "municipalities_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "municipalities_slug_key" UNIQUE ("slug")
);

-- ============================================
-- 2. USERS
-- ============================================

CREATE TABLE IF NOT EXISTS "users" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "email" TEXT NOT NULL,
  "display_name" TEXT NOT NULL,
  "avatar_url" TEXT,
  "xp_points" INTEGER NOT NULL DEFAULT 0,
  "role" "UserRole" NOT NULL DEFAULT 'tourist',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "municipality_id" UUID,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "users_email_key" UNIQUE ("email"),
  CONSTRAINT "users_municipality_fk" FOREIGN KEY ("municipality_id") REFERENCES "municipalities"("id")
);

-- ============================================
-- 3. ROUTES (Chameleon Engine + Temporal)
-- ============================================

CREATE TABLE IF NOT EXISTS "routes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "municipality_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "title_translations" JSONB NOT NULL DEFAULT '{}',
  "description_translations" JSONB NOT NULL DEFAULT '{}',
  "theme_id" "ThemeId" NOT NULL DEFAULT 'mountain',
  "availability_type" "RouteAvailability" NOT NULL DEFAULT 'permanent',
  "start_date" TIMESTAMPTZ,
  "end_date" TIMESTAMPTZ,
  "is_premium" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "routes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "routes_slug_key" UNIQUE ("slug"),
  CONSTRAINT "routes_municipality_fk" FOREIGN KEY ("municipality_id") REFERENCES "municipalities"("id")
);

CREATE INDEX IF NOT EXISTS "idx_routes_dates" ON "routes" ("start_date", "end_date");
CREATE INDEX IF NOT EXISTS "idx_routes_municipality" ON "routes" ("municipality_id");

-- ============================================
-- 4. POIs (Points of Interest)
-- ============================================

CREATE TABLE IF NOT EXISTS "pois" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "route_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "title_translations" JSONB NOT NULL DEFAULT '{}',
  "description_translations" JSONB NOT NULL DEFAULT '{}',
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "audio_url" TEXT,
  "video_url" TEXT,
  "image_before_url" TEXT,
  "image_after_url" TEXT,
  "video_type" "VideoType",
  "quiz_question" TEXT,
  "quiz_options" JSONB,
  "quiz_correct_index" INTEGER,
  "quiz_xp_reward" INTEGER NOT NULL DEFAULT 100,
  "quiz_question_translations" JSONB NOT NULL DEFAULT '{}',
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "pois_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pois_route_fk" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_pois_route" ON "pois" ("route_id");

-- ============================================
-- 5. USER UNLOCKS (Passport)
-- ============================================

CREATE TABLE IF NOT EXISTS "user_unlocks" (
  "user_id" UUID NOT NULL,
  "poi_id" UUID NOT NULL,
  "unlocked_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "earned_xp" INTEGER NOT NULL,
  CONSTRAINT "user_unlocks_pkey" PRIMARY KEY ("user_id", "poi_id"),
  CONSTRAINT "user_unlocks_user_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "user_unlocks_poi_fk" FOREIGN KEY ("poi_id") REFERENCES "pois"("id") ON DELETE CASCADE
);

-- ============================================
-- RLS Policies (básicas)
-- ============================================

ALTER TABLE "municipalities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "routes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pois" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_unlocks" ENABLE ROW LEVEL SECURITY;

-- Public read for municipalities, routes, pois
CREATE POLICY "municipalities_public_read" ON "municipalities" FOR SELECT USING (true);
CREATE POLICY "routes_public_read" ON "routes" FOR SELECT USING (true);
CREATE POLICY "pois_public_read" ON "pois" FOR SELECT USING (true);

-- Users can read their own profile
CREATE POLICY "users_self_read" ON "users" FOR SELECT USING (auth.uid()::text = id::text);
CREATE POLICY "users_self_update" ON "users" FOR UPDATE USING (auth.uid()::text = id::text);

-- Users can read/write their own unlocks
CREATE POLICY "unlocks_self_read" ON "user_unlocks" FOR SELECT USING (auth.uid()::text = user_id::text);
CREATE POLICY "unlocks_self_insert" ON "user_unlocks" FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

-- Service role bypass (for admin API)
CREATE POLICY "service_role_all_municipalities" ON "municipalities" FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all_users" ON "users" FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all_routes" ON "routes" FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all_pois" ON "pois" FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all_unlocks" ON "user_unlocks" FOR ALL USING (auth.role() = 'service_role');
