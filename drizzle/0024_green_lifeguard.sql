CREATE TABLE "technology_plugin_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"template_id" varchar(120) NOT NULL,
	"category" varchar(80) NOT NULL,
	"solution_name" varchar(200) NOT NULL,
	"summary" text NOT NULL,
	"evidence_checklist" jsonb NOT NULL,
	"claims" jsonb NOT NULL,
	"parameters" jsonb NOT NULL,
	"commercial_checklist" jsonb NOT NULL,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "technology_plugin_drafts" ADD CONSTRAINT "technology_plugin_drafts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "technology_plugin_drafts_project_idx" ON "technology_plugin_drafts" USING btree ("project_id","created_at");