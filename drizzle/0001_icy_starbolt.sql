ALTER TABLE "links" DROP CONSTRAINT "links_source_note_id_notes_id_fk";
--> statement-breakpoint
ALTER TABLE "links" DROP CONSTRAINT "links_target_note_id_notes_id_fk";
--> statement-breakpoint
ALTER TABLE "note_revisions" DROP CONSTRAINT "note_revisions_note_id_notes_id_fk";
--> statement-breakpoint
ALTER TABLE "proposals" DROP CONSTRAINT "proposals_target_note_id_notes_id_fk";
--> statement-breakpoint
ALTER TABLE "raw_notes" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "links" ADD CONSTRAINT "links_source_note_id_notes_id_fk" FOREIGN KEY ("source_note_id") REFERENCES "public"."notes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "links" ADD CONSTRAINT "links_target_note_id_notes_id_fk" FOREIGN KEY ("target_note_id") REFERENCES "public"."notes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_revisions" ADD CONSTRAINT "note_revisions_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_target_note_id_notes_id_fk" FOREIGN KEY ("target_note_id") REFERENCES "public"."notes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_type_check" CHECK ("actor_type" in ('user', 'agent', 'system'));--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_result_check" CHECK ("result" in ('ok', 'failed', 'partial'));--> statement-breakpoint
ALTER TABLE "links" ADD CONSTRAINT "links_type_check" CHECK ("type" in ('related'));--> statement-breakpoint
ALTER TABLE "links" ADD CONSTRAINT "links_origin_check" CHECK ("origin" in ('user', 'ai'));--> statement-breakpoint
ALTER TABLE "note_revisions" ADD CONSTRAINT "note_revisions_author_type_check" CHECK ("author_type" in ('user', 'agent', 'system'));--> statement-breakpoint
ALTER TABLE "note_tags" ADD CONSTRAINT "note_tags_origin_check" CHECK ("origin" in ('user', 'ai'));--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_origin_check" CHECK ("origin" in ('user', 'ai'));--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_kind_check" CHECK ("kind" in ('note_update', 'link_create', 'link_delete', 'note_merge', 'bulk_organize', 'moc_update'));--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_status_check" CHECK ("status" in ('pending', 'approved', 'rejected', 'applied', 'failed', 'stale', 'cancelled'));--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_risk_level_check" CHECK ("risk_level" in ('low', 'medium', 'high'));--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_origin_check" CHECK ("origin" in ('user', 'ai'));