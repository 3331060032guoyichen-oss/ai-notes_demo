CREATE TABLE "agent_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"token_hash" text NOT NULL,
	"scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" text NOT NULL,
	"operation" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text,
	"proposal_id" text,
	"idempotency_key" text,
	"result" text NOT NULL,
	"detail" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
	"key" text NOT NULL,
	"user_id" text NOT NULL,
	"operation" text NOT NULL,
	"request_hash" text NOT NULL,
	"response_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "idempotency_keys_user_id_key_pk" PRIMARY KEY("user_id","key")
);
--> statement-breakpoint
CREATE TABLE "links" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"source_note_id" text NOT NULL,
	"target_note_id" text NOT NULL,
	"type" text DEFAULT 'related' NOT NULL,
	"reason" text NOT NULL,
	"origin" text DEFAULT 'user' NOT NULL,
	"proposal_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "note_ai_metadata" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"note_id" text NOT NULL,
	"ai_summary" text,
	"candidate_concepts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"candidate_keywords" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"classification" text,
	"extracted_entities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"model_name" text,
	"source_version" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "note_revisions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"note_id" text NOT NULL,
	"version" integer NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"content" text NOT NULL,
	"key_points" jsonb NOT NULL,
	"concepts" jsonb NOT NULL,
	"keywords" jsonb NOT NULL,
	"author_type" text NOT NULL,
	"author_id" text NOT NULL,
	"proposal_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "note_tags" (
	"note_id" text NOT NULL,
	"tag_id" text NOT NULL,
	"origin" text DEFAULT 'user' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "note_tags_note_id_tag_id_pk" PRIMARY KEY("note_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"raw_id" text NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"content" text NOT NULL,
	"key_points" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"concepts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"keywords" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"origin" text DEFAULT 'user' NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposals" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"target_note_id" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"diff" jsonb,
	"reason" text,
	"impact" jsonb,
	"risk_level" text DEFAULT 'medium' NOT NULL,
	"base_version" integer,
	"origin" text DEFAULT 'ai' NOT NULL,
	"agent_id" text,
	"result" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"applied_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "raw_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"text" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "links" ADD CONSTRAINT "links_source_note_id_notes_id_fk" FOREIGN KEY ("source_note_id") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "links" ADD CONSTRAINT "links_target_note_id_notes_id_fk" FOREIGN KEY ("target_note_id") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_ai_metadata" ADD CONSTRAINT "note_ai_metadata_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_revisions" ADD CONSTRAINT "note_revisions_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_tags" ADD CONSTRAINT "note_tags_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_tags" ADD CONSTRAINT "note_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_raw_id_raw_notes_id_fk" FOREIGN KEY ("raw_id") REFERENCES "public"."raw_notes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_target_note_id_notes_id_fk" FOREIGN KEY ("target_note_id") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agent_tokens_hash_idx" ON "agent_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "agent_tokens_user_id_idx" ON "agent_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_log_user_id_idx" ON "audit_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_log_target_idx" ON "audit_log" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "links_user_id_idx" ON "links" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "links_source_idx" ON "links" USING btree ("source_note_id");--> statement-breakpoint
CREATE INDEX "links_target_idx" ON "links" USING btree ("target_note_id");--> statement-breakpoint
CREATE UNIQUE INDEX "links_pair_idx" ON "links" USING btree ("user_id","source_note_id","target_note_id","type");--> statement-breakpoint
CREATE UNIQUE INDEX "note_ai_metadata_note_idx" ON "note_ai_metadata" USING btree ("note_id");--> statement-breakpoint
CREATE INDEX "note_ai_metadata_user_idx" ON "note_ai_metadata" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "note_revisions_note_version_idx" ON "note_revisions" USING btree ("note_id","version");--> statement-breakpoint
CREATE INDEX "note_tags_tag_idx" ON "note_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "notes_user_id_idx" ON "notes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notes_raw_id_idx" ON "notes" USING btree ("raw_id");--> statement-breakpoint
CREATE INDEX "proposals_user_id_idx" ON "proposals" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "proposals_status_idx" ON "proposals" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "raw_notes_user_id_idx" ON "raw_notes" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_user_normalized_idx" ON "tags" USING btree ("user_id","normalized_name");