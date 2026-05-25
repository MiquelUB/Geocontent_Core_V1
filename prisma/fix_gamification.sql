-- Add gamification columns to user_unlocks
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_unlocks' AND column_name = 'earned_xp') THEN
        ALTER TABLE "public"."user_unlocks" ADD COLUMN "earned_xp" INTEGER NOT NULL DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_unlocks' AND column_name = 'quiz_solved') THEN
        ALTER TABLE "public"."user_unlocks" ADD COLUMN "quiz_solved" BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;

-- user_route_progress table
CREATE TABLE IF NOT EXISTS "public"."user_route_progress" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "route_id" UUID NOT NULL,
    "final_quiz_passed" BOOLEAN NOT NULL DEFAULT false,
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_route_progress_pkey" PRIMARY KEY ("id")
);

-- Indices and constraints
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'user_route_progress_user_id_route_id_key') THEN
        CREATE UNIQUE INDEX "user_route_progress_user_id_route_id_key" ON "public"."user_route_progress"("user_id", "route_id");
    END IF;
END $$;

-- ForeignKey check for user_route_progress (user)
DO $$
BEGIN
    -- Check if fk exists referencing public.users
    -- Note: Prisma schema says User maps to public.users
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'user_route_progress_user_id_fkey') THEN
        ALTER TABLE "public"."user_route_progress" ADD CONSTRAINT "user_route_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- ForeignKey check for user_route_progress (route)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'user_route_progress_route_id_fkey') THEN
        ALTER TABLE "public"."user_route_progress" ADD CONSTRAINT "user_route_progress_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
