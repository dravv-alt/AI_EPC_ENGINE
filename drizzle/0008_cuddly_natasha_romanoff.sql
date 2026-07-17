CREATE TABLE "compliance_precedents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"requirement_id" uuid NOT NULL,
	"target_source_region_id" uuid NOT NULL,
	"target_content_hash" varchar(64) NOT NULL,
	"source_check_id" uuid NOT NULL,
	"title" varchar(250) NOT NULL,
	"rationale" text NOT NULL,
	"review_state" "review_state" DEFAULT 'proposed' NOT NULL,
	"created_by" uuid NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"review_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "compliance_checks" ADD COLUMN "comparison_type" varchar(30) DEFAULT 'qualitative' NOT NULL;--> statement-breakpoint
ALTER TABLE "compliance_checks" ADD COLUMN "requirement_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "compliance_checks" ADD COLUMN "target_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "compliance_checks" ADD COLUMN "precedent_id" uuid;--> statement-breakpoint
ALTER TABLE "compliance_checks" ADD COLUMN "finding_disposition" varchar(30) DEFAULT 'not_applicable' NOT NULL;--> statement-breakpoint
ALTER TABLE "compliance_checks" ADD COLUMN "reviewed_by" uuid;--> statement-breakpoint
ALTER TABLE "compliance_checks" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "compliance_checks" ADD COLUMN "review_note" text;--> statement-breakpoint
ALTER TABLE "compliance_checks" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "compliance_precedents" ADD CONSTRAINT "compliance_precedents_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_precedents" ADD CONSTRAINT "compliance_precedents_requirement_id_requirements_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "public"."requirements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_precedents" ADD CONSTRAINT "compliance_precedents_target_source_region_id_source_regions_id_fk" FOREIGN KEY ("target_source_region_id") REFERENCES "public"."source_regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_precedents" ADD CONSTRAINT "compliance_precedents_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_precedents" ADD CONSTRAINT "compliance_precedents_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "compliance_precedents_project_review_idx" ON "compliance_precedents" USING btree ("project_id","review_state");--> statement-breakpoint
CREATE INDEX "compliance_precedents_match_idx" ON "compliance_precedents" USING btree ("project_id","requirement_id","target_content_hash");--> statement-breakpoint
ALTER TABLE "compliance_checks" ADD CONSTRAINT "compliance_checks_precedent_id_compliance_precedents_id_fk" FOREIGN KEY ("precedent_id") REFERENCES "public"."compliance_precedents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_checks" ADD CONSTRAINT "compliance_checks_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "compliance_checks_project_review_idx" ON "compliance_checks" USING btree ("project_id","review_state","created_at");