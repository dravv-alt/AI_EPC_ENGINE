CREATE TABLE "site_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"answers" jsonb NOT NULL,
	"source_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"completed_sections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_saved_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "site_analyses_project_id_unique" UNIQUE("project_id")
);
--> statement-breakpoint
ALTER TABLE "site_analyses" ADD CONSTRAINT "site_analyses_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_analyses" ADD CONSTRAINT "site_analyses_last_saved_by_users_id_fk" FOREIGN KEY ("last_saved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
