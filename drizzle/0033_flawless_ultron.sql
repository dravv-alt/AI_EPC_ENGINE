CREATE TABLE "rack_model_clusters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rack_model_id" uuid NOT NULL,
	"name" varchar(160) NOT NULL,
	"workload" varchar(120),
	"topology" varchar(80) DEFAULT 'leaf_spine' NOT NULL,
	"network_fabric" varchar(100),
	"color" varchar(16) DEFAULT '#65c7b7' NOT NULL,
	"status" varchar(24) DEFAULT 'planning' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rack_model_gpu_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rack_model_id" uuid NOT NULL,
	"cluster_id" uuid NOT NULL,
	"profile_key" varchar(80) NOT NULL,
	"vendor" varchar(120) NOT NULL,
	"model" varchar(160) NOT NULL,
	"architecture" varchar(120),
	"gpus_per_node" integer NOT NULL,
	"nodes_per_rack" integer NOT NULL,
	"node_unit_height" integer NOT NULL,
	"node_power_kw" numeric(12, 3) NOT NULL,
	"node_heat_kw" numeric(12, 3) NOT NULL,
	"cooling_class" varchar(80),
	"fabric_type" varchar(100),
	"fabric_ports_per_node" integer DEFAULT 1 NOT NULL,
	"port_speed_gbps" integer DEFAULT 400 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rack_model_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rack_model_id" uuid NOT NULL,
	"cluster_id" uuid,
	"source_port_id" uuid NOT NULL,
	"target_port_id" uuid NOT NULL,
	"name" varchar(180) NOT NULL,
	"link_type" varchar(60) NOT NULL,
	"cable_type" varchar(100),
	"length_m" numeric(12, 3),
	"redundancy_group" varchar(40),
	"color" varchar(16) DEFAULT '#65c7b7' NOT NULL,
	"status" varchar(24) DEFAULT 'planned' NOT NULL,
	"path" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rack_model_ports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rack_model_id" uuid NOT NULL,
	"equipment_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"port_type" varchar(60) NOT NULL,
	"protocol" varchar(80),
	"connector" varchar(80),
	"speed_gbps" integer,
	"position_index" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rack_model_equipment" ADD COLUMN "cluster_id" uuid;--> statement-breakpoint
ALTER TABLE "rack_model_equipment" ADD COLUMN "gpu_profile_id" uuid;--> statement-breakpoint
ALTER TABLE "rack_model_equipment" ADD COLUMN "node_count" integer;--> statement-breakpoint
ALTER TABLE "rack_model_equipment" ADD COLUMN "accelerator_count" integer;--> statement-breakpoint
ALTER TABLE "rack_model_clusters" ADD CONSTRAINT "rack_model_clusters_rack_model_id_rack_models_id_fk" FOREIGN KEY ("rack_model_id") REFERENCES "public"."rack_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rack_model_gpu_profiles" ADD CONSTRAINT "rack_model_gpu_profiles_rack_model_id_rack_models_id_fk" FOREIGN KEY ("rack_model_id") REFERENCES "public"."rack_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rack_model_gpu_profiles" ADD CONSTRAINT "rack_model_gpu_profiles_cluster_id_rack_model_clusters_id_fk" FOREIGN KEY ("cluster_id") REFERENCES "public"."rack_model_clusters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rack_model_links" ADD CONSTRAINT "rack_model_links_rack_model_id_rack_models_id_fk" FOREIGN KEY ("rack_model_id") REFERENCES "public"."rack_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rack_model_links" ADD CONSTRAINT "rack_model_links_cluster_id_rack_model_clusters_id_fk" FOREIGN KEY ("cluster_id") REFERENCES "public"."rack_model_clusters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rack_model_links" ADD CONSTRAINT "rack_model_links_source_port_id_rack_model_ports_id_fk" FOREIGN KEY ("source_port_id") REFERENCES "public"."rack_model_ports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rack_model_links" ADD CONSTRAINT "rack_model_links_target_port_id_rack_model_ports_id_fk" FOREIGN KEY ("target_port_id") REFERENCES "public"."rack_model_ports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rack_model_ports" ADD CONSTRAINT "rack_model_ports_rack_model_id_rack_models_id_fk" FOREIGN KEY ("rack_model_id") REFERENCES "public"."rack_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rack_model_ports" ADD CONSTRAINT "rack_model_ports_equipment_id_rack_model_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."rack_model_equipment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "rack_model_clusters_model_name_unique" ON "rack_model_clusters" USING btree ("rack_model_id","name");--> statement-breakpoint
CREATE INDEX "rack_model_clusters_model_idx" ON "rack_model_clusters" USING btree ("rack_model_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rack_model_gpu_profiles_model_key_unique" ON "rack_model_gpu_profiles" USING btree ("rack_model_id","profile_key");--> statement-breakpoint
CREATE INDEX "rack_model_gpu_profiles_cluster_idx" ON "rack_model_gpu_profiles" USING btree ("cluster_id");--> statement-breakpoint
CREATE INDEX "rack_model_links_model_idx" ON "rack_model_links" USING btree ("rack_model_id");--> statement-breakpoint
CREATE INDEX "rack_model_links_cluster_idx" ON "rack_model_links" USING btree ("cluster_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rack_model_ports_equipment_name_unique" ON "rack_model_ports" USING btree ("equipment_id","name");--> statement-breakpoint
CREATE INDEX "rack_model_ports_model_idx" ON "rack_model_ports" USING btree ("rack_model_id");--> statement-breakpoint
ALTER TABLE "rack_model_equipment" ADD CONSTRAINT "rack_model_equipment_cluster_id_rack_model_clusters_id_fk" FOREIGN KEY ("cluster_id") REFERENCES "public"."rack_model_clusters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rack_model_equipment" ADD CONSTRAINT "rack_model_equipment_gpu_profile_id_rack_model_gpu_profiles_id_fk" FOREIGN KEY ("gpu_profile_id") REFERENCES "public"."rack_model_gpu_profiles"("id") ON DELETE no action ON UPDATE no action;