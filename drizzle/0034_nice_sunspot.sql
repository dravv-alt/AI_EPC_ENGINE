CREATE TABLE "copilot_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"storage_object_id" uuid,
	"original_name" varchar(300) NOT NULL,
	"media_type" varchar(120) NOT NULL,
	"byte_size" integer NOT NULL,
	"sha256" varchar(64) NOT NULL,
	"routed_to" varchar(40),
	"routed_entity_id" uuid,
	"routing_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "copilot_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(200) DEFAULT 'New conversation' NOT NULL,
	"last_page_context" jsonb,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "copilot_memories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" varchar(20) NOT NULL,
	"key" varchar(120) NOT NULL,
	"value" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "copilot_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" varchar(12) NOT NULL,
	"content" text,
	"tool_name" varchar(80),
	"tool_args" jsonb,
	"tool_result" jsonb,
	"tool_status" varchar(20),
	"citations" jsonb,
	"response" jsonb,
	"model_provider" varchar(20),
	"model_version" varchar(80),
	"model_input_tokens" integer,
	"model_output_tokens" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "copilot_attachments" ADD CONSTRAINT "copilot_attachments_conversation_id_copilot_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."copilot_conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copilot_attachments" ADD CONSTRAINT "copilot_attachments_storage_object_id_storage_objects_id_fk" FOREIGN KEY ("storage_object_id") REFERENCES "public"."storage_objects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copilot_conversations" ADD CONSTRAINT "copilot_conversations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copilot_conversations" ADD CONSTRAINT "copilot_conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copilot_memories" ADD CONSTRAINT "copilot_memories_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copilot_memories" ADD CONSTRAINT "copilot_memories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copilot_messages" ADD CONSTRAINT "copilot_messages_conversation_id_copilot_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."copilot_conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "copilot_conversations_user_project_idx" ON "copilot_conversations" USING btree ("user_id","project_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "copilot_memories_scope_key_unique" ON "copilot_memories" USING btree ("project_id","user_id","kind","key");--> statement-breakpoint
CREATE INDEX "copilot_messages_conversation_idx" ON "copilot_messages" USING btree ("conversation_id","created_at");