CREATE TABLE "rack_model_artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rack_model_id" uuid NOT NULL,
	"storage_object_id" uuid NOT NULL,
	"format" varchar(32) NOT NULL,
	"file_name" varchar(260) NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rack_model_equipment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rack_model_id" uuid NOT NULL,
	"rack_id" uuid NOT NULL,
	"source_asset_id" uuid,
	"name" varchar(220) NOT NULL,
	"equipment_type" varchar(80) NOT NULL,
	"model_reference" varchar(180),
	"vendor" varchar(180),
	"start_unit" integer NOT NULL,
	"unit_height" integer NOT NULL,
	"power_kw" numeric(12, 3),
	"heat_kw" numeric(12, 3),
	"weight_kg" numeric(12, 3),
	"cooling_class" varchar(80),
	"provenance" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rack_model_racks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rack_model_id" uuid NOT NULL,
	"source_system_id" uuid,
	"name" varchar(120) NOT NULL,
	"row_label" varchar(40) NOT NULL,
	"position_index" integer NOT NULL,
	"x_mm" integer NOT NULL,
	"y_mm" integer NOT NULL,
	"z_mm" integer DEFAULT 0 NOT NULL,
	"width_mm" integer DEFAULT 600 NOT NULL,
	"depth_mm" integer DEFAULT 1200 NOT NULL,
	"height_mm" integer DEFAULT 2200 NOT NULL,
	"total_units" integer DEFAULT 48 NOT NULL,
	"max_power_kw" numeric(12, 3),
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rack_models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"site_analysis_id" uuid,
	"site_analysis_snapshot_id" uuid,
	"name" varchar(220) NOT NULL,
	"status" varchar(24) DEFAULT 'generated' NOT NULL,
	"revision" integer NOT NULL,
	"source_hash" varchar(64) NOT NULL,
	"rackdb_version" varchar(24) DEFAULT '0.6' NOT NULL,
	"basis" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" uuid,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rack_model_artifacts" ADD CONSTRAINT "rack_model_artifacts_rack_model_id_rack_models_id_fk" FOREIGN KEY ("rack_model_id") REFERENCES "public"."rack_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rack_model_artifacts" ADD CONSTRAINT "rack_model_artifacts_storage_object_id_storage_objects_id_fk" FOREIGN KEY ("storage_object_id") REFERENCES "public"."storage_objects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rack_model_artifacts" ADD CONSTRAINT "rack_model_artifacts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rack_model_equipment" ADD CONSTRAINT "rack_model_equipment_rack_model_id_rack_models_id_fk" FOREIGN KEY ("rack_model_id") REFERENCES "public"."rack_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rack_model_equipment" ADD CONSTRAINT "rack_model_equipment_rack_id_rack_model_racks_id_fk" FOREIGN KEY ("rack_id") REFERENCES "public"."rack_model_racks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rack_model_equipment" ADD CONSTRAINT "rack_model_equipment_source_asset_id_assets_id_fk" FOREIGN KEY ("source_asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rack_model_racks" ADD CONSTRAINT "rack_model_racks_rack_model_id_rack_models_id_fk" FOREIGN KEY ("rack_model_id") REFERENCES "public"."rack_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rack_model_racks" ADD CONSTRAINT "rack_model_racks_source_system_id_systems_id_fk" FOREIGN KEY ("source_system_id") REFERENCES "public"."systems"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rack_models" ADD CONSTRAINT "rack_models_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rack_models" ADD CONSTRAINT "rack_models_site_analysis_id_site_analyses_id_fk" FOREIGN KEY ("site_analysis_id") REFERENCES "public"."site_analyses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rack_models" ADD CONSTRAINT "rack_models_site_analysis_snapshot_id_site_analysis_snapshots_id_fk" FOREIGN KEY ("site_analysis_snapshot_id") REFERENCES "public"."site_analysis_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rack_models" ADD CONSTRAINT "rack_models_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rack_models" ADD CONSTRAINT "rack_models_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rack_model_artifacts_model_idx" ON "rack_model_artifacts" USING btree ("rack_model_id","created_at");--> statement-breakpoint
CREATE INDEX "rack_model_equipment_rack_slot_idx" ON "rack_model_equipment" USING btree ("rack_id","start_unit");--> statement-breakpoint
CREATE INDEX "rack_model_equipment_model_idx" ON "rack_model_equipment" USING btree ("rack_model_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rack_model_racks_model_name_unique" ON "rack_model_racks" USING btree ("rack_model_id","name");--> statement-breakpoint
CREATE INDEX "rack_model_racks_model_row_idx" ON "rack_model_racks" USING btree ("rack_model_id","row_label","position_index");--> statement-breakpoint
CREATE UNIQUE INDEX "rack_models_project_revision_unique" ON "rack_models" USING btree ("project_id","revision");--> statement-breakpoint
CREATE INDEX "rack_models_project_status_idx" ON "rack_models" USING btree ("project_id","status");