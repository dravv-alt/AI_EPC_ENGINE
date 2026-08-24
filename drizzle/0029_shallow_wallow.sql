ALTER TABLE "technology_plugin_drafts" ADD COLUMN "vendor_details" jsonb DEFAULT '{}'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "technology_plugin_drafts" ADD COLUMN "procurement_details" jsonb DEFAULT '{}'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "technology_plugin_drafts" ADD COLUMN "project_context" jsonb DEFAULT '{}'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "technology_plugin_drafts" ADD COLUMN "draft_message" text;
--> statement-breakpoint
ALTER TABLE "technology_plugin_drafts" ADD COLUMN "generation_provider" varchar(30);
--> statement-breakpoint
ALTER TABLE "technology_plugin_drafts" ADD COLUMN "generation_model" varchar(100);
--> statement-breakpoint
ALTER TABLE "technology_plugin_drafts" ADD COLUMN "artifact_object_id" uuid;
--> statement-breakpoint
ALTER TABLE "technology_plugin_drafts" ADD COLUMN "document_version_id" uuid;
