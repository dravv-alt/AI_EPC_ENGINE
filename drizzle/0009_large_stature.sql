ALTER TABLE "risk_signals" ADD COLUMN "task_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "risk_signals" ADD COLUMN "poll_cycle_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "risk_signals" ADD COLUMN "data_available" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "schedule_risks" ADD COLUMN "schedule_event_id" uuid;--> statement-breakpoint
ALTER TABLE "schedule_risks" ADD COLUMN "review_state" "review_state" DEFAULT 'proposed' NOT NULL;--> statement-breakpoint
ALTER TABLE "schedule_risks" ADD COLUMN "reviewed_by" uuid;--> statement-breakpoint
ALTER TABLE "schedule_risks" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "schedule_risks" ADD COLUMN "review_note" text;--> statement-breakpoint
ALTER TABLE "schedule_risks" ADD COLUMN "mitigation_disposition" varchar(30) DEFAULT 'unreviewed' NOT NULL;--> statement-breakpoint
ALTER TABLE "schedule_risks" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "risk_signals" ADD CONSTRAINT "risk_signals_task_id_schedule_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."schedule_tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_risks" ADD CONSTRAINT "schedule_risks_schedule_event_id_schedule_events_id_fk" FOREIGN KEY ("schedule_event_id") REFERENCES "public"."schedule_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_risks" ADD CONSTRAINT "schedule_risks_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "risk_signals_poll_task_idx" ON "risk_signals" USING btree ("poll_cycle_id","task_id");