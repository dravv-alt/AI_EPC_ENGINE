ALTER TABLE "rack_models" ADD COLUMN "source_type" varchar(24) DEFAULT 'generated' NOT NULL;--> statement-breakpoint
ALTER TABLE "rack_models" ADD COLUMN "source_object_id" uuid;--> statement-breakpoint
ALTER TABLE "rack_models" ADD COLUMN "source_format" varchar(16);--> statement-breakpoint
ALTER TABLE "rack_models" ADD COLUMN "original_file_name" varchar(260);--> statement-breakpoint
ALTER TABLE "rack_models" ADD CONSTRAINT "rack_models_source_object_id_storage_objects_id_fk" FOREIGN KEY ("source_object_id") REFERENCES "public"."storage_objects"("id") ON DELETE no action ON UPDATE no action;