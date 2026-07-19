ALTER TABLE "compliance_checks" ADD COLUMN "suggestion_source" varchar(20);--> statement-breakpoint
ALTER TABLE "compliance_checks" ADD COLUMN "suggestion_model_version" varchar(80);