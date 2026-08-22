CREATE TABLE "evidence_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"claim_type" varchar(50) NOT NULL,
	"metric_key" varchar(120) NOT NULL,
	"value" numeric(20, 6),
	"unit" varchar(40),
	"statement" text NOT NULL,
	"status" varchar(20) DEFAULT 'proposed' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence_claim_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"claim_id" uuid NOT NULL,
	"evidence_id" uuid NOT NULL,
	"relationship" varchar(30) DEFAULT 'supports' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "evidence_claims" ADD CONSTRAINT "evidence_claims_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_claims" ADD CONSTRAINT "evidence_claims_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_claim_links" ADD CONSTRAINT "evidence_claim_links_claim_id_evidence_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."evidence_claims"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_claim_links" ADD CONSTRAINT "evidence_claim_links_evidence_id_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."evidence"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "evidence_claims_project_created_idx" ON "evidence_claims" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "evidence_claim_links_unique" ON "evidence_claim_links" USING btree ("claim_id","evidence_id");
