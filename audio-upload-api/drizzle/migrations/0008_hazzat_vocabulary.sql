CREATE TABLE "hymn_placements" (
	"hymn_slug" varchar(200) NOT NULL,
	"season_slug" varchar(100) NOT NULL,
	"service_slug" varchar(100) NOT NULL,
	"sort_order" integer NOT NULL,
	CONSTRAINT "hymn_placements_hymn_slug_season_slug_service_slug_pk" PRIMARY KEY("hymn_slug","season_slug","service_slug")
);
--> statement-breakpoint
CREATE TABLE "hymn_tunes" (
	"hymn_slug" varchar(200) NOT NULL,
	"tune_slug" varchar(100) NOT NULL,
	CONSTRAINT "hymn_tunes_hymn_slug_tune_slug_pk" PRIMARY KEY("hymn_slug","tune_slug")
);
--> statement-breakpoint
CREATE TABLE "hymn_type_links" (
	"hymn_slug" varchar(200) NOT NULL,
	"type_slug" varchar(100) NOT NULL,
	CONSTRAINT "hymn_type_links_hymn_slug_type_slug_pk" PRIMARY KEY("hymn_slug","type_slug")
);
--> statement-breakpoint
CREATE TABLE "hymn_types" (
	"slug" varchar(100) PRIMARY KEY NOT NULL,
	"label" varchar(200) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tunes" (
	"slug" varchar(100) PRIMARY KEY NOT NULL,
	"label" varchar(200) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "hymns" ADD COLUMN "label_ar" varchar(300);--> statement-breakpoint
ALTER TABLE "hymns" ADD COLUMN "hazzat_id" varchar(200);--> statement-breakpoint
ALTER TABLE "hymns" ADD COLUMN "source_url" varchar(500);--> statement-breakpoint
ALTER TABLE "hymns" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "seasons" ADD COLUMN "label_ar" varchar(200);--> statement-breakpoint
ALTER TABLE "seasons" ADD COLUMN "sort_order" integer;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "sort_order" integer;--> statement-breakpoint
ALTER TABLE "hymn_placements" ADD CONSTRAINT "hymn_placements_hymn_slug_hymns_slug_fk" FOREIGN KEY ("hymn_slug") REFERENCES "public"."hymns"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hymn_placements" ADD CONSTRAINT "hymn_placements_season_slug_seasons_slug_fk" FOREIGN KEY ("season_slug") REFERENCES "public"."seasons"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hymn_placements" ADD CONSTRAINT "hymn_placements_service_slug_services_slug_fk" FOREIGN KEY ("service_slug") REFERENCES "public"."services"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hymn_tunes" ADD CONSTRAINT "hymn_tunes_hymn_slug_hymns_slug_fk" FOREIGN KEY ("hymn_slug") REFERENCES "public"."hymns"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hymn_tunes" ADD CONSTRAINT "hymn_tunes_tune_slug_tunes_slug_fk" FOREIGN KEY ("tune_slug") REFERENCES "public"."tunes"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hymn_type_links" ADD CONSTRAINT "hymn_type_links_hymn_slug_hymns_slug_fk" FOREIGN KEY ("hymn_slug") REFERENCES "public"."hymns"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hymn_type_links" ADD CONSTRAINT "hymn_type_links_type_slug_hymn_types_slug_fk" FOREIGN KEY ("type_slug") REFERENCES "public"."hymn_types"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hymn_placements_season_service_idx" ON "hymn_placements" USING btree ("season_slug","service_slug");--> statement-breakpoint
-- ---------------------------------------------------------------------------
-- hazzat.com vocabulary: access for the new reference tables.
--
-- Same treatment as the original vocabulary (0001 grants, 0003 RLS): public,
-- read-only for the browser roles, written only by the seed (service_role /
-- migration role, which bypass RLS). The service_role grant is restated in
-- case default privileges were not in force for the migrating role.
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.hymn_types, public.tunes, public.hymn_type_links, public.hymn_tunes, public.hymn_placements
  TO service_role;--> statement-breakpoint
GRANT SELECT
  ON public.hymn_types, public.tunes, public.hymn_type_links, public.hymn_tunes, public.hymn_placements
  TO anon, authenticated;--> statement-breakpoint
ALTER TABLE public.hymn_types ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.tunes ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.hymn_type_links ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.hymn_tunes ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.hymn_placements ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY hymn_types_read_all ON public.hymn_types
  FOR SELECT TO anon, authenticated USING (true);--> statement-breakpoint
CREATE POLICY tunes_read_all ON public.tunes
  FOR SELECT TO anon, authenticated USING (true);--> statement-breakpoint
CREATE POLICY hymn_type_links_read_all ON public.hymn_type_links
  FOR SELECT TO anon, authenticated USING (true);--> statement-breakpoint
CREATE POLICY hymn_tunes_read_all ON public.hymn_tunes
  FOR SELECT TO anon, authenticated USING (true);--> statement-breakpoint
CREATE POLICY hymn_placements_read_all ON public.hymn_placements
  FOR SELECT TO anon, authenticated USING (true);
