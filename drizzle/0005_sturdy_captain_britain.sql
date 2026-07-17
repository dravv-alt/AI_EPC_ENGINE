CREATE TABLE "risk_signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"signal_type" varchar(60) NOT NULL,
	"status" varchar(20) NOT NULL,
	"source" varchar(120) NOT NULL,
	"value" jsonb,
	"unavailable_reason" text,
	"observed_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedule_risks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"source_signal_id" uuid,
	"risk_type" varchar(80) NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"probability" numeric(5, 4) NOT NULL,
	"estimated_delay_hours" integer NOT NULL,
	"mitigation_options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"materiality_hash" varchar(64) NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"cleared_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cx_test_records" ADD COLUMN "report_content" jsonb;--> statement-breakpoint
ALTER TABLE "cx_test_records" ADD COLUMN "report_artifact_object_id" uuid;--> statement-breakpoint
ALTER TABLE "evidence" ADD COLUMN "storage_object_id" uuid;--> statement-breakpoint
ALTER TABLE "evidence" ADD COLUMN "client_capture_id" varchar(120);--> statement-breakpoint
ALTER TABLE "evidence" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "evidence" ADD COLUMN "captured_by" uuid;--> statement-breakpoint
ALTER TABLE "findings" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "findings" ADD COLUMN "resolution_note" text;--> statement-breakpoint
ALTER TABLE "findings" ADD COLUMN "resolved_by" uuid;--> statement-breakpoint
ALTER TABLE "findings" ADD COLUMN "resolved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "findings" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "retention_days" integer DEFAULT 365 NOT NULL;--> statement-breakpoint
ALTER TABLE "schedule_resources" ADD COLUMN "source_region_id" uuid;--> statement-breakpoint
ALTER TABLE "schedule_resources" ADD COLUMN "review_state" "review_state" DEFAULT 'proposed' NOT NULL;--> statement-breakpoint
ALTER TABLE "schedule_resources" ADD COLUMN "reviewed_by" uuid;--> statement-breakpoint
ALTER TABLE "schedule_resources" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN "equipment_id" uuid;--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN "origin_name" varchar(200);--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN "origin_lat" numeric(9, 6);--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN "origin_lng" numeric(9, 6);--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN "destination_name" varchar(200);--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN "destination_lat" numeric(9, 6);--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN "destination_lng" numeric(9, 6);--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN "current_lat" numeric(9, 6);--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN "current_lng" numeric(9, 6);--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN "position_source" varchar(20) DEFAULT 'simulated' NOT NULL;--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN "mmsi" varchar(20);--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN "weather_delay_factor" numeric(8, 5) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN "telemetry_reason" text;--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN "last_polled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "risk_signals" ADD CONSTRAINT "risk_signals_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_risks" ADD CONSTRAINT "schedule_risks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_risks" ADD CONSTRAINT "schedule_risks_task_id_schedule_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."schedule_tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_risks" ADD CONSTRAINT "schedule_risks_source_signal_id_risk_signals_id_fk" FOREIGN KEY ("source_signal_id") REFERENCES "public"."risk_signals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "risk_signals_project_observed_idx" ON "risk_signals" USING btree ("project_id","observed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "schedule_risks_project_task_type_unique" ON "schedule_risks" USING btree ("project_id","task_id","risk_type");--> statement-breakpoint
ALTER TABLE "cx_test_records" ADD CONSTRAINT "cx_test_records_report_artifact_object_id_storage_objects_id_fk" FOREIGN KEY ("report_artifact_object_id") REFERENCES "public"."storage_objects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_storage_object_id_storage_objects_id_fk" FOREIGN KEY ("storage_object_id") REFERENCES "public"."storage_objects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_captured_by_users_id_fk" FOREIGN KEY ("captured_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_resources" ADD CONSTRAINT "schedule_resources_source_region_id_source_regions_id_fk" FOREIGN KEY ("source_region_id") REFERENCES "public"."source_regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_resources" ADD CONSTRAINT "schedule_resources_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_equipment_id_assets_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "evidence_project_client_capture_unique" ON "evidence" USING btree ("project_id","client_capture_id");