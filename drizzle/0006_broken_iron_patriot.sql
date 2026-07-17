ALTER TABLE "schedule_events" ADD COLUMN "processing_status" varchar(30) DEFAULT 'queued' NOT NULL;--> statement-breakpoint
ALTER TABLE "schedule_events" ADD COLUMN "durable_job_id" uuid;--> statement-breakpoint
ALTER TABLE "schedule_events" ADD COLUMN "result_version_id" uuid;--> statement-breakpoint
ALTER TABLE "schedule_events" ADD COLUMN "processing_error" text;--> statement-breakpoint
ALTER TABLE "schedule_resources" ADD COLUMN "confidence" numeric(5, 4);--> statement-breakpoint
ALTER TABLE "schedule_resources" ADD COLUMN "validation_issues" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "schedule_resources" ADD COLUMN "review_note" text;--> statement-breakpoint
ALTER TABLE "schedule_tasks" ADD COLUMN "deadline_type" varchar(20);--> statement-breakpoint
ALTER TABLE "schedule_tasks" ADD COLUMN "confidence" numeric(5, 4);--> statement-breakpoint
ALTER TABLE "schedule_tasks" ADD COLUMN "validation_issues" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "schedule_tasks" ADD COLUMN "review_note" text;--> statement-breakpoint
ALTER TABLE "schedule_versions" ADD COLUMN "trigger_event_id" uuid;--> statement-breakpoint
ALTER TABLE "schedule_versions" ADD COLUMN "solver_version" varchar(80) DEFAULT 'ortools-cp-sat-v1' NOT NULL;--> statement-breakpoint
ALTER TABLE "schedule_versions" ADD COLUMN "bottlenecks" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "schedule_versions" ADD COLUMN "overrun_hours" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "schedule_versions" ADD COLUMN "explanation_model_version" varchar(100);--> statement-breakpoint
ALTER TABLE "schedule_versions" ADD COLUMN "explanation_generated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "schedule_events" ADD CONSTRAINT "schedule_events_durable_job_id_durable_jobs_id_fk" FOREIGN KEY ("durable_job_id") REFERENCES "public"."durable_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_versions" ADD CONSTRAINT "schedule_versions_trigger_event_id_schedule_events_id_fk" FOREIGN KEY ("trigger_event_id") REFERENCES "public"."schedule_events"("id") ON DELETE no action ON UPDATE no action;