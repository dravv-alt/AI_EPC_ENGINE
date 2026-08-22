CREATE TABLE "financial_models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"contracted_power_mw" numeric(12, 3) NOT NULL,
	"utilization_pct" numeric(7, 4) NOT NULL,
	"lease_rate_usd_mw_month" numeric(16, 2) NOT NULL,
	"power_cost_usd_kwh" numeric(12, 6) NOT NULL,
	"planning_budget_usd_mw" numeric(16, 2) NOT NULL,
	"pue" numeric(7, 4) NOT NULL,
	"discount_rate_pct" numeric(7, 4) NOT NULL,
	"analysis_period_years" integer NOT NULL,
	"usd_inr_rate" numeric(12, 4) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "financial_models_project_id_unique" UNIQUE("project_id")
);
--> statement-breakpoint
ALTER TABLE "financial_models" ADD CONSTRAINT "financial_models_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;