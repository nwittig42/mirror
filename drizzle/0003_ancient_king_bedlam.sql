CREATE TYPE "public"."activity_visibility" AS ENUM('internal', 'client');--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "visibility" "activity_visibility" DEFAULT 'internal' NOT NULL;--> statement-breakpoint
ALTER TABLE "checks" ADD COLUMN "named_order" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "competitors" ADD COLUMN "source" text DEFAULT 'operator' NOT NULL;--> statement-breakpoint
ALTER TABLE "competitors" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "competitors" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_hash" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "must_change_password" boolean DEFAULT false NOT NULL;