CREATE TYPE "public"."alert_status" AS ENUM('active', 'cleared');--> statement-breakpoint
CREATE TYPE "public"."checklist_status" AS ENUM('draft', 'accepted', 'rejected', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."cx_verdict" AS ENUM('proposed_pass', 'proposed_fail', 'needs_human_review');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('draft', 'approved');--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"event_type" varchar(40) NOT NULL,
	"dedup_key" varchar(300) NOT NULL,
	"status" "alert_status" DEFAULT 'active' NOT NULL,
	"title" varchar(300) NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compliance_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"requirement_id" uuid NOT NULL,
	"target_source_region_id" uuid NOT NULL,
	"verdict" varchar(40) NOT NULL,
	"review_state" "review_state" DEFAULT 'proposed' NOT NULL,
	"confidence" numeric(5, 4) NOT NULL,
	"reason" text NOT NULL,
	"proposed_finding_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cx_checklist_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"checklist_id" uuid NOT NULL,
	"sequence_number" numeric(8, 0) NOT NULL,
	"instruction" text NOT NULL,
	"modality" varchar(20) NOT NULL,
	"parameter" varchar(200),
	"nominal_value" numeric(20, 8),
	"unit" varchar(40),
	"tolerance" numeric(20, 8),
	"expected_boolean" boolean,
	"narrative_criterion" text,
	"required" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cx_checklists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"system_id" uuid NOT NULL,
	"gate_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"title" varchar(250) NOT NULL,
	"status" "checklist_status" DEFAULT 'draft' NOT NULL,
	"generation_model_version" varchar(80) DEFAULT 'deterministic-demo-v1' NOT NULL,
	"created_by" uuid NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cx_clause_citations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"checklist_id" uuid NOT NULL,
	"step_id" uuid,
	"clause_reference" varchar(200) NOT NULL,
	"source_region_id" uuid,
	"verification_status" varchar(20) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cx_step_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"test_record_id" uuid NOT NULL,
	"step_id" uuid NOT NULL,
	"reading_value" numeric(20, 8),
	"reading_boolean" boolean,
	"reading_text" text,
	"entered_by" uuid NOT NULL,
	"entered_at" timestamp with time zone NOT NULL,
	"verdict" "cx_verdict" NOT NULL,
	"finding_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cx_test_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"checklist_id" uuid NOT NULL,
	"gate_id" uuid NOT NULL,
	"executed_by" uuid NOT NULL,
	"overall_status" "cx_verdict" DEFAULT 'needs_human_review' NOT NULL,
	"report_status" "report_status" DEFAULT 'draft' NOT NULL,
	"report_content_hash" varchar(64),
	"evidence_id" uuid,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"source_region_id" uuid NOT NULL,
	"document_type" varchar(40) NOT NULL,
	"content" text NOT NULL,
	"content_hash" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"planned_eta" timestamp with time zone NOT NULL,
	"weather_adjusted_eta" timestamp with time zone,
	"required_on_site" timestamp with time zone NOT NULL,
	"port_congestion" boolean DEFAULT false NOT NULL,
	"status" varchar(10) DEFAULT 'green' NOT NULL,
	"last_notified_status" varchar(10),
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_checks" ADD CONSTRAINT "compliance_checks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_checks" ADD CONSTRAINT "compliance_checks_requirement_id_requirements_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "public"."requirements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_checks" ADD CONSTRAINT "compliance_checks_target_source_region_id_source_regions_id_fk" FOREIGN KEY ("target_source_region_id") REFERENCES "public"."source_regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_checks" ADD CONSTRAINT "compliance_checks_proposed_finding_id_findings_id_fk" FOREIGN KEY ("proposed_finding_id") REFERENCES "public"."findings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cx_checklist_steps" ADD CONSTRAINT "cx_checklist_steps_checklist_id_cx_checklists_id_fk" FOREIGN KEY ("checklist_id") REFERENCES "public"."cx_checklists"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cx_checklists" ADD CONSTRAINT "cx_checklists_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cx_checklists" ADD CONSTRAINT "cx_checklists_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cx_checklists" ADD CONSTRAINT "cx_checklists_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cx_checklists" ADD CONSTRAINT "cx_checklists_gate_id_gates_id_fk" FOREIGN KEY ("gate_id") REFERENCES "public"."gates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cx_checklists" ADD CONSTRAINT "cx_checklists_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cx_checklists" ADD CONSTRAINT "cx_checklists_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cx_checklists" ADD CONSTRAINT "cx_checklists_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cx_clause_citations" ADD CONSTRAINT "cx_clause_citations_checklist_id_cx_checklists_id_fk" FOREIGN KEY ("checklist_id") REFERENCES "public"."cx_checklists"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cx_clause_citations" ADD CONSTRAINT "cx_clause_citations_step_id_cx_checklist_steps_id_fk" FOREIGN KEY ("step_id") REFERENCES "public"."cx_checklist_steps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cx_clause_citations" ADD CONSTRAINT "cx_clause_citations_source_region_id_source_regions_id_fk" FOREIGN KEY ("source_region_id") REFERENCES "public"."source_regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cx_step_results" ADD CONSTRAINT "cx_step_results_test_record_id_cx_test_records_id_fk" FOREIGN KEY ("test_record_id") REFERENCES "public"."cx_test_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cx_step_results" ADD CONSTRAINT "cx_step_results_step_id_cx_checklist_steps_id_fk" FOREIGN KEY ("step_id") REFERENCES "public"."cx_checklist_steps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cx_step_results" ADD CONSTRAINT "cx_step_results_entered_by_users_id_fk" FOREIGN KEY ("entered_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cx_step_results" ADD CONSTRAINT "cx_step_results_finding_id_findings_id_fk" FOREIGN KEY ("finding_id") REFERENCES "public"."findings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cx_test_records" ADD CONSTRAINT "cx_test_records_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cx_test_records" ADD CONSTRAINT "cx_test_records_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cx_test_records" ADD CONSTRAINT "cx_test_records_checklist_id_cx_checklists_id_fk" FOREIGN KEY ("checklist_id") REFERENCES "public"."cx_checklists"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cx_test_records" ADD CONSTRAINT "cx_test_records_gate_id_gates_id_fk" FOREIGN KEY ("gate_id") REFERENCES "public"."gates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cx_test_records" ADD CONSTRAINT "cx_test_records_executed_by_users_id_fk" FOREIGN KEY ("executed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cx_test_records" ADD CONSTRAINT "cx_test_records_evidence_id_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."evidence"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cx_test_records" ADD CONSTRAINT "cx_test_records_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_source_region_id_source_regions_id_fk" FOREIGN KEY ("source_region_id") REFERENCES "public"."source_regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alerts_project_status_idx" ON "alerts" USING btree ("project_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "cx_steps_checklist_sequence_unique" ON "cx_checklist_steps" USING btree ("checklist_id","sequence_number");--> statement-breakpoint
CREATE INDEX "cx_checklists_project_gate_idx" ON "cx_checklists" USING btree ("project_id","gate_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "cx_results_record_step_unique" ON "cx_step_results" USING btree ("test_record_id","step_id");--> statement-breakpoint
CREATE INDEX "knowledge_chunks_scope_idx" ON "knowledge_chunks" USING btree ("tenant_id","project_id","document_type");--> statement-breakpoint
CREATE INDEX "shipments_project_status_idx" ON "shipments" USING btree ("project_id","status");