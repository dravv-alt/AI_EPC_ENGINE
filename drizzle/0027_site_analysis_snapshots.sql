CREATE TABLE "site_analysis_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL,
  "site_analysis_id" uuid NOT NULL,
  "version" integer NOT NULL,
  "inputs_hash" varchar(64) NOT NULL,
  "metrics" jsonb NOT NULL,
  "warnings" jsonb NOT NULL,
  "recommendations" jsonb NOT NULL,
  "ai_summary" jsonb,
  "generated_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "site_analysis_snapshots_analysis_version_unique" UNIQUE("site_analysis_id", "version")
);
--> statement-breakpoint
ALTER TABLE "site_analysis_snapshots" ADD CONSTRAINT "site_analysis_snapshots_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "site_analysis_snapshots" ADD CONSTRAINT "site_analysis_snapshots_site_analysis_id_site_analyses_id_fk" FOREIGN KEY ("site_analysis_id") REFERENCES "public"."site_analyses"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "site_analysis_snapshots" ADD CONSTRAINT "site_analysis_snapshots_generated_by_users_id_fk" FOREIGN KEY ("generated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "site_analysis_snapshots_project_idx" ON "site_analysis_snapshots" USING btree ("project_id","created_at");
