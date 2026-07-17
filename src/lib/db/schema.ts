import {
  boolean,
  integer,
  index,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
};

export const memberRole = pgEnum("member_role", ["admin", "commissioning_manager", "reviewer", "field_engineer", "approver", "viewer", "scheduler"]);
export const gateStatus = pgEnum("gate_status", ["not_started", "in_review", "ready", "blocked", "approved"]);
export const reviewState = pgEnum("review_state", ["proposed", "accepted", "edited", "rejected"]);
export const evidenceState = pgEnum("evidence_state", ["pending", "accepted", "stale", "failed", "rejected"]);
export const documentStatus = pgEnum("document_status", ["draft", "approved", "superseded", "rejected"]);
export const extractionState = pgEnum("extraction_state", ["pending", "processing", "completed", "failed"]);
export const checklistStatus = pgEnum("checklist_status", ["draft", "accepted", "rejected", "superseded"]);
export const cxVerdict = pgEnum("cx_verdict", ["proposed_pass", "proposed_fail", "needs_human_review"]);
export const reportStatus = pgEnum("report_status", ["draft", "approved"]);
export const alertStatus = pgEnum("alert_status", ["active", "cleared"]);
export const jobStatus = pgEnum("job_status", ["queued", "running", "completed", "failed", "cancelled"]);

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 200 }).notNull(),
  retentionDays: numeric("retention_days", { precision: 8, scale: 0 }).notNull().default("365"),
  ...timestamps
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  externalAuthId: varchar("external_auth_id", { length: 255 }).unique(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  displayName: varchar("display_name", { length: 200 }).notNull(),
  passwordHash: varchar("password_hash", { length: 255 }),
  totpEnabled: boolean("totp_enabled").notNull().default(false),
  totpSecretCiphertext: text("totp_secret_ciphertext"),
  totpPendingSecretCiphertext: text("totp_pending_secret_ciphertext"),
  ...timestamps
});

export const authSessions = pgTable("auth_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  mfaVerifiedAt: timestamp("mfa_verified_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  userAgent: varchar("user_agent", { length: 500 }),
  ipAddress: varchar("ip_address", { length: 100 }),
  ...timestamps
}, (table) => [index("auth_sessions_user_expires_idx").on(table.userId, table.expiresAt)]);

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  name: varchar("name", { length: 200 }).notNull(),
  code: varchar("code", { length: 80 }).notNull(),
  timezone: varchar("timezone", { length: 64 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  ...timestamps
}, (table) => [uniqueIndex("projects_tenant_code_unique").on(table.tenantId, table.code)]);

export const projectMembers = pgTable("project_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id),
  userId: uuid("user_id").notNull().references(() => users.id),
  role: memberRole("role").notNull(),
  ...timestamps
}, (table) => [uniqueIndex("project_members_project_user_unique").on(table.projectId, table.userId)]);

export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id),
  documentType: varchar("document_type", { length: 40 }).notNull(),
  title: varchar("title", { length: 300 }).notNull(),
  ...timestamps
}, (table) => [index("documents_project_idx").on(table.projectId)]);

export const documentVersions = pgTable("document_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("document_id").notNull().references(() => documents.id),
  revision: varchar("revision", { length: 80 }).notNull(),
  status: documentStatus("status").notNull().default("draft"),
  sha256: varchar("sha256", { length: 64 }).notNull().unique(),
  objectKey: varchar("object_key", { length: 500 }).notNull().unique(),
  mediaType: varchar("media_type", { length: 120 }).notNull(),
  extractionStatus: extractionState("extraction_status").notNull().default("pending"),
  extractionError: text("extraction_error"),
  ...timestamps
});

export const sourceRegions = pgTable("source_regions", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentVersionId: uuid("document_version_id").notNull().references(() => documentVersions.id),
  pageNumber: numeric("page_number", { precision: 8, scale: 0 }).notNull(),
  bbox: jsonb("bbox"),
  extractedText: text("extracted_text").notNull(),
  contentHash: varchar("content_hash", { length: 64 }).notNull(),
  ...timestamps
});

export const systems = pgTable("systems", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id),
  name: varchar("name", { length: 200 }).notNull(),
  systemType: varchar("system_type", { length: 40 }).notNull(),
  ...timestamps
});

export const assets = pgTable("assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id),
  systemId: uuid("system_id").notNull().references(() => systems.id),
  tag: varchar("tag", { length: 120 }).notNull(),
  assetType: varchar("asset_type", { length: 100 }).notNull(),
  vendor: varchar("vendor", { length: 200 }),
  ...timestamps
}, (table) => [uniqueIndex("assets_project_tag_unique").on(table.projectId, table.tag)]);

export const gates = pgTable("gates", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id),
  systemId: uuid("system_id").notNull().references(() => systems.id),
  name: varchar("name", { length: 120 }).notNull(),
  sequenceNumber: numeric("sequence_number", { precision: 8, scale: 0 }).notNull(),
  approvalRole: memberRole("approval_role").notNull().default("approver"),
  status: gateStatus("status").notNull().default("not_started"),
  ...timestamps
});

export const requirements = pgTable("requirements", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id),
  sourceRegionId: uuid("source_region_id").notNull().references(() => sourceRegions.id),
  statement: text("statement").notNull(),
  modality: varchar("modality", { length: 20 }).notNull(),
  numericValue: numeric("numeric_value", { precision: 20, scale: 8 }),
  unit: varchar("unit", { length: 40 }),
  tolerance: numeric("tolerance", { precision: 20, scale: 8 }),
  reviewState: reviewState("review_state").notNull().default("proposed"),
  reviewedBy: uuid("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewNote: text("review_note"),
  confidence: numeric("confidence", { precision: 5, scale: 4 }),
  ...timestamps
});

export const evidence = pgTable("evidence", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id),
  systemId: uuid("system_id").notNull().references(() => systems.id),
  assetId: uuid("asset_id").references(() => assets.id),
  sourceRegionId: uuid("source_region_id").references(() => sourceRegions.id),
  evidenceType: varchar("evidence_type", { length: 40 }).notNull(),
  validityState: evidenceState("validity_state").notNull().default("pending"),
  contentHash: varchar("content_hash", { length: 64 }),
  capturedAt: timestamp("captured_at", { withTimezone: true }).notNull(),
  ...timestamps
});

export const findings = pgTable("findings", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id),
  gateId: uuid("gate_id").references(() => gates.id),
  title: varchar("title", { length: 250 }).notNull(),
  severity: varchar("severity", { length: 20 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("open"),
  ownerId: uuid("owner_id").references(() => users.id),
  dueAt: timestamp("due_at", { withTimezone: true }),
  ...timestamps
});

export const decisions = pgTable("decisions", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id),
  gateId: uuid("gate_id").notNull().references(() => gates.id),
  decidedBy: uuid("decided_by").notNull().references(() => users.id),
  decision: varchar("decision", { length: 20 }).notNull(),
  reason: text("reason").notNull(),
  evidenceBaselineHash: varchar("evidence_baseline_hash", { length: 64 }).notNull(),
  decidedAt: timestamp("decided_at", { withTimezone: true }).notNull(),
  ...timestamps
});

export const edges = pgTable("edges", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id),
  fromType: varchar("from_type", { length: 40 }).notNull(),
  fromId: uuid("from_id").notNull(),
  relationshipType: varchar("relationship_type", { length: 40 }).notNull(),
  toType: varchar("to_type", { length: 40 }).notNull(),
  toId: uuid("to_id").notNull(),
  ...timestamps
}, (table) => [index("edges_project_from_idx").on(table.projectId, table.fromType, table.fromId)]);

export const auditEvents = pgTable("audit_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  projectId: uuid("project_id").notNull().references(() => projects.id),
  actorId: uuid("actor_id").references(() => users.id),
  action: varchar("action", { length: 120 }).notNull(),
  entityType: varchar("entity_type", { length: 40 }).notNull(),
  entityId: uuid("entity_id").notNull(),
  beforeHash: varchar("before_hash", { length: 64 }),
  afterHash: varchar("after_hash", { length: 64 }),
  previousEventHash: varchar("previous_event_hash", { length: 64 }),
  eventHash: varchar("event_hash", { length: 64 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const cxChecklists = pgTable("cx_checklists", {
  id: uuid("id").primaryKey().defaultRandom(), tenantId: uuid("tenant_id").notNull().references(() => tenants.id), projectId: uuid("project_id").notNull().references(() => projects.id), systemId: uuid("system_id").notNull().references(() => systems.id), gateId: uuid("gate_id").notNull().references(() => gates.id), assetId: uuid("asset_id").notNull().references(() => assets.id), title: varchar("title", { length: 250 }).notNull(), status: checklistStatus("status").notNull().default("draft"), generationModelVersion: varchar("generation_model_version", { length: 80 }).notNull().default("deterministic-demo-v1"), createdBy: uuid("created_by").notNull().references(() => users.id), reviewedBy: uuid("reviewed_by").references(() => users.id), reviewedAt: timestamp("reviewed_at", { withTimezone: true }), ...timestamps
}, (table) => [index("cx_checklists_project_gate_idx").on(table.projectId, table.gateId, table.status)]);

export const cxChecklistSteps = pgTable("cx_checklist_steps", {
  id: uuid("id").primaryKey().defaultRandom(), checklistId: uuid("checklist_id").notNull().references(() => cxChecklists.id), sequenceNumber: numeric("sequence_number", { precision: 8, scale: 0 }).notNull(), instruction: text("instruction").notNull(), modality: varchar("modality", { length: 20 }).notNull(), parameter: varchar("parameter", { length: 200 }), nominalValue: numeric("nominal_value", { precision: 20, scale: 8 }), unit: varchar("unit", { length: 40 }), tolerance: numeric("tolerance", { precision: 20, scale: 8 }), expectedBoolean: boolean("expected_boolean"), narrativeCriterion: text("narrative_criterion"), required: boolean("required").notNull().default(true), ...timestamps
}, (table) => [uniqueIndex("cx_steps_checklist_sequence_unique").on(table.checklistId, table.sequenceNumber)]);

export const cxClauseCitations = pgTable("cx_clause_citations", {
  id: uuid("id").primaryKey().defaultRandom(), checklistId: uuid("checklist_id").notNull().references(() => cxChecklists.id), stepId: uuid("step_id").references(() => cxChecklistSteps.id), clauseReference: varchar("clause_reference", { length: 200 }).notNull(), sourceRegionId: uuid("source_region_id").references(() => sourceRegions.id), verificationStatus: varchar("verification_status", { length: 20 }).notNull().default("pending"), ...timestamps
});

export const cxTestRecords = pgTable("cx_test_records", {
  id: uuid("id").primaryKey().defaultRandom(), tenantId: uuid("tenant_id").notNull().references(() => tenants.id), projectId: uuid("project_id").notNull().references(() => projects.id), checklistId: uuid("checklist_id").notNull().references(() => cxChecklists.id), gateId: uuid("gate_id").notNull().references(() => gates.id), executedBy: uuid("executed_by").notNull().references(() => users.id), overallStatus: cxVerdict("overall_status").notNull().default("needs_human_review"), reportStatus: reportStatus("report_status").notNull().default("draft"), reportContentHash: varchar("report_content_hash", { length: 64 }), evidenceId: uuid("evidence_id").references(() => evidence.id), approvedBy: uuid("approved_by").references(() => users.id), approvedAt: timestamp("approved_at", { withTimezone: true }), ...timestamps
});

export const cxStepResults = pgTable("cx_step_results", {
  id: uuid("id").primaryKey().defaultRandom(), testRecordId: uuid("test_record_id").notNull().references(() => cxTestRecords.id), stepId: uuid("step_id").notNull().references(() => cxChecklistSteps.id), readingValue: numeric("reading_value", { precision: 20, scale: 8 }), readingBoolean: boolean("reading_boolean"), readingText: text("reading_text"), enteredBy: uuid("entered_by").notNull().references(() => users.id), enteredAt: timestamp("entered_at", { withTimezone: true }).notNull(), verdict: cxVerdict("verdict").notNull(), findingId: uuid("finding_id").references(() => findings.id), ...timestamps
}, (table) => [uniqueIndex("cx_results_record_step_unique").on(table.testRecordId, table.stepId)]);

export const complianceChecks = pgTable("compliance_checks", {
  id: uuid("id").primaryKey().defaultRandom(), projectId: uuid("project_id").notNull().references(() => projects.id), requirementId: uuid("requirement_id").notNull().references(() => requirements.id), targetSourceRegionId: uuid("target_source_region_id").notNull().references(() => sourceRegions.id), verdict: varchar("verdict", { length: 40 }).notNull(), reviewState: reviewState("review_state").notNull().default("proposed"), confidence: numeric("confidence", { precision: 5, scale: 4 }).notNull(), reason: text("reason").notNull(), proposedFindingId: uuid("proposed_finding_id").references(() => findings.id), ...timestamps
});

export const knowledgeChunks = pgTable("knowledge_chunks", {
  id: uuid("id").primaryKey().defaultRandom(), tenantId: uuid("tenant_id").notNull().references(() => tenants.id), projectId: uuid("project_id").notNull().references(() => projects.id), sourceRegionId: uuid("source_region_id").notNull().references(() => sourceRegions.id), documentType: varchar("document_type", { length: 40 }).notNull(), content: text("content").notNull(), contentHash: varchar("content_hash", { length: 64 }).notNull(), ...timestamps
}, (table) => [index("knowledge_chunks_scope_idx").on(table.tenantId, table.projectId, table.documentType)]);

export const shipments = pgTable("shipments", {
  id: uuid("id").primaryKey().defaultRandom(), tenantId: uuid("tenant_id").notNull().references(() => tenants.id), projectId: uuid("project_id").notNull().references(() => projects.id), name: varchar("name", { length: 200 }).notNull(), plannedEta: timestamp("planned_eta", { withTimezone: true }).notNull(), weatherAdjustedEta: timestamp("weather_adjusted_eta", { withTimezone: true }), requiredOnSite: timestamp("required_on_site", { withTimezone: true }).notNull(), portCongestion: boolean("port_congestion").notNull().default(false), status: varchar("status", { length: 10 }).notNull().default("green"), lastNotifiedStatus: varchar("last_notified_status", { length: 10 }), createdBy: uuid("created_by").notNull().references(() => users.id), ...timestamps
}, (table) => [index("shipments_project_status_idx").on(table.projectId, table.status)]);

export const alerts = pgTable("alerts", {
  id: uuid("id").primaryKey().defaultRandom(), projectId: uuid("project_id").notNull().references(() => projects.id), eventType: varchar("event_type", { length: 40 }).notNull(), dedupKey: varchar("dedup_key", { length: 300 }).notNull(), status: alertStatus("status").notNull().default("active"), title: varchar("title", { length: 300 }).notNull(), payload: jsonb("payload").notNull(), ...timestamps
}, (table) => [index("alerts_project_status_idx").on(table.projectId, table.status)]);

export const storageObjects = pgTable("storage_objects", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  projectId: uuid("project_id").notNull().references(() => projects.id),
  objectKey: varchar("object_key", { length: 500 }).notNull().unique(),
  mediaType: varchar("media_type", { length: 120 }).notNull(),
  byteSize: integer("byte_size").notNull(),
  sha256: varchar("sha256", { length: 64 }).notNull(),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  ...timestamps
}, (table) => [index("storage_objects_project_idx").on(table.projectId, table.createdAt)]);

export const durableJobs = pgTable("durable_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id),
  projectId: uuid("project_id").references(() => projects.id),
  queue: varchar("queue", { length: 80 }).notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  status: jobStatus("status").notNull().default("queued"),
  idempotencyKey: varchar("idempotency_key", { length: 300 }).notNull().unique(),
  payload: jsonb("payload").notNull(),
  result: jsonb("result"),
  error: text("error"),
  attempts: integer("attempts").notNull().default(0),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  ...timestamps
}, (table) => [index("durable_jobs_project_status_idx").on(table.projectId, table.status)]);

export const idempotencyRecords = pgTable("idempotency_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  scope: varchar("scope", { length: 120 }).notNull(),
  key: varchar("key", { length: 300 }).notNull(),
  requestHash: varchar("request_hash", { length: 64 }).notNull(),
  responseStatus: integer("response_status"),
  responseBody: jsonb("response_body"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ...timestamps
}, (table) => [uniqueIndex("idempotency_scope_key_unique").on(table.scope, table.key)]);

export const scheduleEvents = pgTable("schedule_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id),
  eventId: varchar("event_id", { length: 200 }).notNull(),
  eventType: varchar("event_type", { length: 40 }).notNull(),
  dedupKey: varchar("dedup_key", { length: 300 }).notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  payload: jsonb("payload").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  ...timestamps
}, (table) => [
  uniqueIndex("schedule_events_project_event_unique").on(table.projectId, table.eventId),
  uniqueIndex("schedule_events_project_dedup_unique").on(table.projectId, table.dedupKey)
]);

export const turnoverPacks = pgTable("turnover_packs", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  projectId: uuid("project_id").notNull().references(() => projects.id),
  gateId: uuid("gate_id").notNull().references(() => gates.id),
  decisionId: uuid("decision_id").notNull().references(() => decisions.id),
  manifest: jsonb("manifest").notNull(),
  manifestHash: varchar("manifest_hash", { length: 64 }).notNull().unique(),
  objectKey: varchar("object_key", { length: 500 }).notNull().unique(),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  ...timestamps
}, (table) => [index("turnover_packs_project_gate_idx").on(table.projectId, table.gateId)]);

export const scheduleTasks = pgTable("schedule_tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id),
  sourceRegionId: uuid("source_region_id").references(() => sourceRegions.id),
  name: varchar("name", { length: 240 }).notNull(),
  durationHours: integer("duration_hours").notNull(),
  earliestStart: timestamp("earliest_start", { withTimezone: true }),
  deadline: timestamp("deadline", { withTimezone: true }),
  fixedStart: timestamp("fixed_start", { withTimezone: true }),
  vendor: varchar("vendor", { length: 200 }),
  leadTimeDays: integer("lead_time_days"),
  reviewState: reviewState("review_state").notNull().default("proposed"),
  reviewedBy: uuid("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  ...timestamps
}, (table) => [index("schedule_tasks_project_review_idx").on(table.projectId, table.reviewState)]);

export const scheduleResources = pgTable("schedule_resources", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id),
  name: varchar("name", { length: 200 }).notNull(),
  capacity: integer("capacity").notNull(),
  unit: varchar("unit", { length: 60 }).notNull().default("crew"),
  ...timestamps
}, (table) => [uniqueIndex("schedule_resources_project_name_unique").on(table.projectId, table.name)]);

export const scheduleTaskResources = pgTable("schedule_task_resources", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").notNull().references(() => scheduleTasks.id),
  resourceId: uuid("resource_id").notNull().references(() => scheduleResources.id),
  demand: integer("demand").notNull(),
  ...timestamps
}, (table) => [uniqueIndex("schedule_task_resource_unique").on(table.taskId, table.resourceId)]);

export const scheduleDependencies = pgTable("schedule_dependencies", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id),
  predecessorTaskId: uuid("predecessor_task_id").notNull().references(() => scheduleTasks.id),
  successorTaskId: uuid("successor_task_id").notNull().references(() => scheduleTasks.id),
  ...timestamps
}, (table) => [uniqueIndex("schedule_dependency_unique").on(table.predecessorTaskId, table.successorTaskId)]);

export const scheduleVersions = pgTable("schedule_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id),
  parentVersionId: uuid("parent_version_id"),
  versionNumber: integer("version_number").notNull(),
  reason: text("reason").notNull(),
  solverStatus: varchar("solver_status", { length: 30 }).notNull(),
  inputHash: varchar("input_hash", { length: 64 }).notNull(),
  objectiveHours: integer("objective_hours"),
  criticalTaskIds: jsonb("critical_task_ids").notNull().default([]),
  explanation: text("explanation"),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  ...timestamps
}, (table) => [uniqueIndex("schedule_versions_project_number_unique").on(table.projectId, table.versionNumber)]);

export const scheduleAssignments = pgTable("schedule_assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  versionId: uuid("version_id").notNull().references(() => scheduleVersions.id),
  taskId: uuid("task_id").notNull().references(() => scheduleTasks.id),
  startAt: timestamp("start_at", { withTimezone: true }).notNull(),
  endAt: timestamp("end_at", { withTimezone: true }).notNull(),
  isCritical: boolean("is_critical").notNull().default(false),
  ...timestamps
}, (table) => [uniqueIndex("schedule_assignment_version_task_unique").on(table.versionId, table.taskId)]);
