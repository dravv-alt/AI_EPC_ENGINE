ALTER TABLE "shipments" ADD COLUMN "transport_mode" varchar(10) DEFAULT 'sea' NOT NULL;--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN "assessed_threats" jsonb DEFAULT '[]'::jsonb;