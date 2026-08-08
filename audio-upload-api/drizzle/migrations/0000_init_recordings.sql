CREATE TYPE "public"."review_status" AS ENUM('processing', 'ready', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."upload_status" AS ENUM('pending', 'uploading', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "contributors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_user_id" uuid,
	"email" varchar(255),
	"display_name" varchar(100),
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "contributors_auth_user_id_unique" UNIQUE("auth_user_id"),
	CONSTRAINT "contributors_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "hymns" (
	"slug" varchar(200) PRIMARY KEY NOT NULL,
	"label" varchar(300) NOT NULL,
	"rhythm" varchar(30)
);
--> statement-breakpoint
CREATE TABLE "languages" (
	"slug" varchar(50) PRIMARY KEY NOT NULL,
	"label" varchar(100) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ml_feature_artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recording_id" uuid,
	"feature_type" varchar(50) NOT NULL,
	"r2_feature_key" varchar(512) NOT NULL,
	"window_start_sec" numeric(8, 2) NOT NULL,
	"window_end_sec" numeric(8, 2) NOT NULL,
	"tensor_shape" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "ml_feature_artifacts_r2_feature_key_unique" UNIQUE("r2_feature_key")
);
--> statement-breakpoint
CREATE TABLE "recordings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"r2_key" varchar(512) NOT NULL,
	"content_type" varchar(100) NOT NULL,
	"original_filename" varchar(512),
	"file_size_bytes" bigint,
	"etag" varchar(255),
	"content_hash" varchar(64),
	"duration_seconds" numeric(8, 2),
	"sample_rate_hz" integer,
	"channels" smallint,
	"codec" varchar(50),
	"service_slug" varchar(100) NOT NULL,
	"season_slug" varchar(100) NOT NULL,
	"hymn_slug" varchar(200) NOT NULL,
	"hymn_label" varchar(300) NOT NULL,
	"languages" jsonb NOT NULL,
	"upload_status" "upload_status" DEFAULT 'pending' NOT NULL,
	"review_status" "review_status" DEFAULT 'processing' NOT NULL,
	"error_message" text,
	"contributor_id" uuid,
	"submitter_email" varchar(255),
	"wants_updates" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recordings_r2_key_unique" UNIQUE("r2_key")
);
--> statement-breakpoint
CREATE TABLE "seasons" (
	"slug" varchar(100) PRIMARY KEY NOT NULL,
	"label" varchar(200) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "services" (
	"slug" varchar(100) PRIMARY KEY NOT NULL,
	"label" varchar(200) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ml_feature_artifacts" ADD CONSTRAINT "ml_feature_artifacts_recording_id_recordings_id_fk" FOREIGN KEY ("recording_id") REFERENCES "public"."recordings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recordings" ADD CONSTRAINT "recordings_service_slug_services_slug_fk" FOREIGN KEY ("service_slug") REFERENCES "public"."services"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recordings" ADD CONSTRAINT "recordings_season_slug_seasons_slug_fk" FOREIGN KEY ("season_slug") REFERENCES "public"."seasons"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recordings" ADD CONSTRAINT "recordings_hymn_slug_hymns_slug_fk" FOREIGN KEY ("hymn_slug") REFERENCES "public"."hymns"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recordings" ADD CONSTRAINT "recordings_contributor_id_contributors_id_fk" FOREIGN KEY ("contributor_id") REFERENCES "public"."contributors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recordings_content_hash_idx" ON "recordings" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX "recordings_upload_status_idx" ON "recordings" USING btree ("upload_status");--> statement-breakpoint
CREATE INDEX "recordings_review_status_idx" ON "recordings" USING btree ("review_status");--> statement-breakpoint
CREATE INDEX "recordings_contributor_id_idx" ON "recordings" USING btree ("contributor_id");