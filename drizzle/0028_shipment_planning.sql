CREATE TABLE "shipment_plans" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL,
  "site_analysis_id" uuid,
  "source_key" varchar(100) NOT NULL,
  "category" varchar(40) NOT NULL,
  "name" varchar(200) NOT NULL,
  "requirement_level" varchar(20) NOT NULL,
  "rationale" text NOT NULL,
  "source_answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "transport_mode" varchar(10) DEFAULT 'land' NOT NULL,
  "status" varchar(24) DEFAULT 'proposed' NOT NULL,
  "approved_by" uuid,
  "approved_at" timestamp with time zone,
  "materialized_shipment_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "shipment_plans_project_source_unique" UNIQUE("project_id","source_key")
);
--> statement-breakpoint
ALTER TABLE "shipment_plans" ADD CONSTRAINT "shipment_plans_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "shipment_plans" ADD CONSTRAINT "shipment_plans_site_analysis_id_site_analyses_id_fk" FOREIGN KEY ("site_analysis_id") REFERENCES "public"."site_analyses"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "shipment_plans" ADD CONSTRAINT "shipment_plans_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "shipment_plans" ADD CONSTRAINT "shipment_plans_materialized_shipment_id_shipments_id_fk" FOREIGN KEY ("materialized_shipment_id") REFERENCES "public"."shipments"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "shipment_plans_project_status_idx" ON "shipment_plans" USING btree ("project_id","status");
