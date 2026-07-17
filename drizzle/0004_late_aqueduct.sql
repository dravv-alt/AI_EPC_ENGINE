CREATE TABLE "schedule_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"is_critical" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedule_dependencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"predecessor_task_id" uuid NOT NULL,
	"successor_task_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedule_resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"capacity" integer NOT NULL,
	"unit" varchar(60) DEFAULT 'crew' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedule_task_resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"resource_id" uuid NOT NULL,
	"demand" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedule_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"source_region_id" uuid,
	"name" varchar(240) NOT NULL,
	"duration_hours" integer NOT NULL,
	"earliest_start" timestamp with time zone,
	"deadline" timestamp with time zone,
	"fixed_start" timestamp with time zone,
	"vendor" varchar(200),
	"lead_time_days" integer,
	"review_state" "review_state" DEFAULT 'proposed' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedule_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"parent_version_id" uuid,
	"version_number" integer NOT NULL,
	"reason" text NOT NULL,
	"solver_status" varchar(30) NOT NULL,
	"input_hash" varchar(64) NOT NULL,
	"objective_hours" integer,
	"critical_task_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"explanation" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "turnover_packs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"gate_id" uuid NOT NULL,
	"decision_id" uuid NOT NULL,
	"manifest" jsonb NOT NULL,
	"manifest_hash" varchar(64) NOT NULL,
	"object_key" varchar(500) NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "turnover_packs_manifest_hash_unique" UNIQUE("manifest_hash"),
	CONSTRAINT "turnover_packs_object_key_unique" UNIQUE("object_key")
);
--> statement-breakpoint
ALTER TABLE "schedule_assignments" ADD CONSTRAINT "schedule_assignments_version_id_schedule_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."schedule_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_assignments" ADD CONSTRAINT "schedule_assignments_task_id_schedule_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."schedule_tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_dependencies" ADD CONSTRAINT "schedule_dependencies_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_dependencies" ADD CONSTRAINT "schedule_dependencies_predecessor_task_id_schedule_tasks_id_fk" FOREIGN KEY ("predecessor_task_id") REFERENCES "public"."schedule_tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_dependencies" ADD CONSTRAINT "schedule_dependencies_successor_task_id_schedule_tasks_id_fk" FOREIGN KEY ("successor_task_id") REFERENCES "public"."schedule_tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_resources" ADD CONSTRAINT "schedule_resources_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_task_resources" ADD CONSTRAINT "schedule_task_resources_task_id_schedule_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."schedule_tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_task_resources" ADD CONSTRAINT "schedule_task_resources_resource_id_schedule_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."schedule_resources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_tasks" ADD CONSTRAINT "schedule_tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_tasks" ADD CONSTRAINT "schedule_tasks_source_region_id_source_regions_id_fk" FOREIGN KEY ("source_region_id") REFERENCES "public"."source_regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_tasks" ADD CONSTRAINT "schedule_tasks_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_versions" ADD CONSTRAINT "schedule_versions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_versions" ADD CONSTRAINT "schedule_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turnover_packs" ADD CONSTRAINT "turnover_packs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turnover_packs" ADD CONSTRAINT "turnover_packs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turnover_packs" ADD CONSTRAINT "turnover_packs_gate_id_gates_id_fk" FOREIGN KEY ("gate_id") REFERENCES "public"."gates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turnover_packs" ADD CONSTRAINT "turnover_packs_decision_id_decisions_id_fk" FOREIGN KEY ("decision_id") REFERENCES "public"."decisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turnover_packs" ADD CONSTRAINT "turnover_packs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "schedule_assignment_version_task_unique" ON "schedule_assignments" USING btree ("version_id","task_id");--> statement-breakpoint
CREATE UNIQUE INDEX "schedule_dependency_unique" ON "schedule_dependencies" USING btree ("predecessor_task_id","successor_task_id");--> statement-breakpoint
CREATE UNIQUE INDEX "schedule_resources_project_name_unique" ON "schedule_resources" USING btree ("project_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "schedule_task_resource_unique" ON "schedule_task_resources" USING btree ("task_id","resource_id");--> statement-breakpoint
CREATE INDEX "schedule_tasks_project_review_idx" ON "schedule_tasks" USING btree ("project_id","review_state");--> statement-breakpoint
CREATE UNIQUE INDEX "schedule_versions_project_number_unique" ON "schedule_versions" USING btree ("project_id","version_number");--> statement-breakpoint
CREATE INDEX "turnover_packs_project_gate_idx" ON "turnover_packs" USING btree ("project_id","gate_id");