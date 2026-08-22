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
  varchar,
  vector,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
};

export const memberRole = pgEnum("member_role", [
  "admin",
  "commissioning_manager",
  "reviewer",
  "field_engineer",
  "approver",
  "viewer",
  "scheduler",
]);
export const gateStatus = pgEnum("gate_status", [
  "not_started",
  "in_review",
  "ready",
  "blocked",
  "approved",
]);
export const reviewState = pgEnum("review_state", [
  "proposed",
  "accepted",
  "edited",
  "rejected",
]);
export const evidenceState = pgEnum("evidence_state", [
  "pending",
  "accepted",
  "stale",
  "failed",
  "rejected",
]);
export const documentStatus = pgEnum("document_status", [
  "draft",
  "approved",
  "superseded",
  "rejected",
]);
export const extractionState = pgEnum("extraction_state", [
  "pending",
  "processing",
  "completed",
  "failed",
]);
export const checklistStatus = pgEnum("checklist_status", [
  "draft",
  "accepted",
  "rejected",
  "superseded",
]);
export const cxVerdict = pgEnum("cx_verdict", [
  "proposed_pass",
  "proposed_fail",
  "needs_human_review",
]);
export const reportStatus = pgEnum("report_status", ["draft", "approved"]);
export const alertStatus = pgEnum("alert_status", ["active", "cleared"]);
export const jobStatus = pgEnum("job_status", [
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
]);

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 200 }).notNull(),
  retentionDays: numeric("retention_days", { precision: 8, scale: 0 })
    .notNull()
    .default("365"),
  ...timestamps,
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
  ...timestamps,
});

export const authSessions = pgTable(
  "auth_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    mfaVerifiedAt: timestamp("mfa_verified_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    userAgent: varchar("user_agent", { length: 500 }),
    ipAddress: varchar("ip_address", { length: 100 }),
    ...timestamps,
  },
  (table) => [
    index("auth_sessions_user_expires_idx").on(table.userId, table.expiresAt),
  ],
);

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    name: varchar("name", { length: 200 }).notNull(),
    code: varchar("code", { length: 80 }).notNull(),
    timezone: varchar("timezone", { length: 64 }).notNull(),
    retentionDays: integer("retention_days").notNull().default(365),
    status: varchar("status", { length: 20 }).notNull().default("active"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("projects_tenant_code_unique").on(table.tenantId, table.code),
  ],
);

export const projectMembers = pgTable(
  "project_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    role: memberRole("role").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("project_members_project_user_unique").on(
      table.projectId,
      table.userId,
    ),
  ],
);

// Financial inputs are stored in USD as the canonical planning currency.
// The INR conversion rate is display-only and never changes the stored USD model.
export const financialModels = pgTable("financial_models", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id)
    .unique(),
  contractedPowerMw: numeric("contracted_power_mw", {
    precision: 12,
    scale: 3,
  }).notNull(),
  utilizationPct: numeric("utilization_pct", {
    precision: 7,
    scale: 4,
  }).notNull(),
  leaseRateUsdMwMonth: numeric("lease_rate_usd_mw_month", {
    precision: 16,
    scale: 2,
  }).notNull(),
  powerCostUsdKwh: numeric("power_cost_usd_kwh", {
    precision: 12,
    scale: 6,
  }).notNull(),
  planningBudgetUsdMw: numeric("planning_budget_usd_mw", {
    precision: 16,
    scale: 2,
  }).notNull(),
  pue: numeric("pue", { precision: 7, scale: 4 }).notNull(),
  discountRatePct: numeric("discount_rate_pct", {
    precision: 7,
    scale: 4,
  }).notNull(),
  analysisPeriodYears: integer("analysis_period_years").notNull(),
  usdInrRate: numeric("usd_inr_rate", { precision: 12, scale: 4 }).notNull(),
  ...timestamps,
});

// Internal vendor/technology intake drafts. A draft is deliberately not a
// selectable or publishable plugin; human review and evidence are required.
export const technologyPluginDrafts = pgTable(
  "technology_plugin_drafts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    templateId: varchar("template_id", { length: 120 }).notNull(),
    category: varchar("category", { length: 80 }).notNull(),
    solutionName: varchar("solution_name", { length: 200 }).notNull(),
    summary: text("summary").notNull(),
    evidenceChecklist: jsonb("evidence_checklist").notNull(),
    claims: jsonb("claims").notNull(),
    parameters: jsonb("parameters").notNull(),
    commercialChecklist: jsonb("commercial_checklist").notNull(),
    status: varchar("status", { length: 20 }).notNull().default("draft"),
    ...timestamps,
  },
  (table) => [
    index("technology_plugin_drafts_project_idx").on(
      table.projectId,
      table.createdAt,
    ),
  ],
);

// A single, project-scoped intake contract for early site feasibility. The
// values are planning inputs, never certified engineering outputs.
export const siteAnalyses = pgTable("site_analyses", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id)
    .unique(),
  status: varchar("status", { length: 20 }).notNull().default("draft"),
  answers: jsonb("answers").notNull(),
  sourceMetadata: jsonb("source_metadata").notNull().default({}),
  completedSections: jsonb("completed_sections").notNull().default([]),
  lastSavedBy: uuid("last_saved_by").references(() => users.id),
  ...timestamps,
});

// Immutable planning interpretations make feasibility assumptions explainable
// over time. They are advisory snapshots, never a substitute for a stamped
// engineering design or vendor approval.
export const siteAnalysisSnapshots = pgTable(
  "site_analysis_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    siteAnalysisId: uuid("site_analysis_id")
      .notNull()
      .references(() => siteAnalyses.id),
    version: integer("version").notNull(),
    inputsHash: varchar("inputs_hash", { length: 64 }).notNull(),
    metrics: jsonb("metrics").notNull(),
    warnings: jsonb("warnings").notNull(),
    recommendations: jsonb("recommendations").notNull(),
    aiSummary: jsonb("ai_summary"),
    generatedBy: uuid("generated_by").references(() => users.id),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("site_analysis_snapshots_analysis_version_unique").on(
      table.siteAnalysisId,
      table.version,
    ),
    index("site_analysis_snapshots_project_idx").on(
      table.projectId,
      table.createdAt,
    ),
  ],
);

export const storageObjects = pgTable(
  "storage_objects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    objectKey: varchar("object_key", { length: 500 }).notNull().unique(),
    mediaType: varchar("media_type", { length: 120 }).notNull(),
    byteSize: integer("byte_size").notNull(),
    sha256: varchar("sha256", { length: 64 }).notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    ...timestamps,
  },
  (table) => [
    index("storage_objects_project_idx").on(table.projectId, table.createdAt),
  ],
);

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    documentType: varchar("document_type", { length: 40 }).notNull(),
    standardSet: varchar("standard_set", { length: 120 }),
    title: varchar("title", { length: 300 }).notNull(),
    // Slice 9: RFI resolution lifecycle — distinct from documentVersions.status
    // (a document-version lifecycle: draft/approved/superseded). Only
    // meaningful when documentType = "rfi"; nullable because it is irrelevant
    // for every other document type. Values: open | resolved | withdrawn.
    resolutionState: varchar("resolution_state", { length: 20 }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [index("documents_project_idx").on(table.projectId)],
);

export const documentVersions = pgTable("document_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("document_id")
    .notNull()
    .references(() => documents.id),
  revision: varchar("revision", { length: 80 }).notNull(),
  status: documentStatus("status").notNull().default("draft"),
  sha256: varchar("sha256", { length: 64 }).notNull().unique(),
  objectKey: varchar("object_key", { length: 500 }).notNull().unique(),
  mediaType: varchar("media_type", { length: 120 }).notNull(),
  extractionStatus: extractionState("extraction_status")
    .notNull()
    .default("pending"),
  extractionError: text("extraction_error"),
  // Provenance of the extraction model call that produced every requirement
  // proposal for this version (proposeDocumentRecords runs one batched
  // generateStructured call per document version, so this is the natural
  // per-batch granularity — not per-requirement). Nullable: unset until that
  // proposal pass runs.
  extractionModel: varchar("extraction_model", { length: 80 }),
  extractionProvider: varchar("extraction_provider", { length: 20 }),
  ...timestamps,
});

export const sourceRegions = pgTable("source_regions", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentVersionId: uuid("document_version_id")
    .notNull()
    .references(() => documentVersions.id),
  pageNumber: numeric("page_number", { precision: 8, scale: 0 }).notNull(),
  bbox: jsonb("bbox"),
  extractedText: text("extracted_text").notNull(),
  contentHash: varchar("content_hash", { length: 64 }).notNull(),
  ...timestamps,
});

export const systems = pgTable(
  "systems",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    name: varchar("name", { length: 200 }).notNull(),
    systemType: varchar("system_type", { length: 40 }).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("systems_project_name_unique").on(table.projectId, table.name),
  ],
);

export const assets = pgTable(
  "assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    systemId: uuid("system_id")
      .notNull()
      .references(() => systems.id),
    tag: varchar("tag", { length: 120 }).notNull(),
    assetType: varchar("asset_type", { length: 100 }).notNull(),
    vendor: varchar("vendor", { length: 200 }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("assets_project_tag_unique").on(table.projectId, table.tag),
  ],
);

export const gates = pgTable(
  "gates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    systemId: uuid("system_id")
      .notNull()
      .references(() => systems.id),
    name: varchar("name", { length: 120 }).notNull(),
    sequenceNumber: numeric("sequence_number", {
      precision: 8,
      scale: 0,
    }).notNull(),
    approvalRole: memberRole("approval_role").notNull().default("approver"),
    status: gateStatus("status").notNull().default("not_started"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("gates_project_system_name_unique").on(
      table.projectId,
      table.systemId,
      table.name,
    ),
  ],
);

export const requirements = pgTable("requirements", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id),
  sourceRegionId: uuid("source_region_id")
    .notNull()
    .references(() => sourceRegions.id),
  statement: text("statement").notNull(),
  // Review-facing presentation fields. The statement remains the complete,
  // controlled corpus; these concise fields make the review queue scannable.
  displayTitle: varchar("display_title", { length: 180 }),
  displaySummary: varchar("display_summary", { length: 280 }),
  presentationProvider: varchar("presentation_provider", { length: 80 }),
  modality: varchar("modality", { length: 20 }).notNull(),
  numericValue: numeric("numeric_value", { precision: 20, scale: 8 }),
  unit: varchar("unit", { length: 40 }),
  tolerance: numeric("tolerance", { precision: 20, scale: 8 }),
  // Data-type tag ("numeric" | "boolean" | "categorical" | "narrative") set
  // once at extraction time, mirroring cxChecklistSteps.modality — distinct
  // from the `modality` column above, which stores deontic strength
  // (shall/must/should/may/informative). Nullable: pre-existing rows and any
  // future direct-insert path fall back to compareCompliance's regex tiering.
  comparisonModality: varchar("comparison_modality", { length: 20 }),
  reviewState: reviewState("review_state").notNull().default("proposed"),
  reviewedBy: uuid("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewNote: text("review_note"),
  confidence: numeric("confidence", { precision: 5, scale: 4 }),
  ...timestamps,
});

export const evidence = pgTable(
  "evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    systemId: uuid("system_id")
      .notNull()
      .references(() => systems.id),
    assetId: uuid("asset_id").references(() => assets.id),
    sourceRegionId: uuid("source_region_id").references(() => sourceRegions.id),
    storageObjectId: uuid("storage_object_id").references(
      () => storageObjects.id,
    ),
    evidenceType: varchar("evidence_type", { length: 40 }).notNull(),
    validityState: evidenceState("validity_state").notNull().default("pending"),
    contentHash: varchar("content_hash", { length: 64 }),
    clientCaptureId: varchar("client_capture_id", { length: 120 }),
    notes: text("notes"),
    aiDescription: text("ai_description"),
    classificationMetadata: jsonb("classification_metadata"),
    classificationProvider: varchar("classification_provider", { length: 80 }),
    classificationConfidence: numeric("classification_confidence", {
      precision: 5,
      scale: 4,
    }),
    capturedBy: uuid("captured_by").references(() => users.id),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("evidence_project_client_capture_unique").on(
      table.projectId,
      table.clientCaptureId,
    ),
  ],
);

// A claim is an explicitly reviewable engineering or commercial assertion. It
// never changes readiness, finance, or a technology draft by itself: those
// downstream surfaces must continue to use their own approved inputs.
export const evidenceClaims = pgTable(
  "evidence_claims",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    claimType: varchar("claim_type", { length: 50 }).notNull(),
    metricKey: varchar("metric_key", { length: 120 }).notNull(),
    value: numeric("value", { precision: 20, scale: 6 }),
    unit: varchar("unit", { length: 40 }),
    statement: text("statement").notNull(),
    status: varchar("status", { length: 20 }).notNull().default("proposed"),
    createdBy: uuid("created_by").references(() => users.id),
    ...timestamps,
  },
  (table) => [
    index("evidence_claims_project_created_idx").on(
      table.projectId,
      table.createdAt,
    ),
  ],
);

// The join is intentionally separate from the generic graph edges: the UI can
// show a controlled, auditable claim-to-evidence matrix without asking users to
// paste opaque IDs or infer a graph relationship.
export const evidenceClaimLinks = pgTable(
  "evidence_claim_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    claimId: uuid("claim_id")
      .notNull()
      .references(() => evidenceClaims.id),
    evidenceId: uuid("evidence_id")
      .notNull()
      .references(() => evidence.id),
    relationship: varchar("relationship", { length: 30 })
      .notNull()
      .default("supports"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("evidence_claim_links_unique").on(
      table.claimId,
      table.evidenceId,
    ),
  ],
);

export const findings = pgTable("findings", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id),
  gateId: uuid("gate_id").references(() => gates.id),
  title: varchar("title", { length: 250 }).notNull(),
  description: text("description"),
  severity: varchar("severity", { length: 20 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("open"),
  ownerId: uuid("owner_id").references(() => users.id),
  dueAt: timestamp("due_at", { withTimezone: true }),
  resolutionNote: text("resolution_note"),
  resolvedBy: uuid("resolved_by").references(() => users.id),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  version: integer("version").notNull().default(1),
  ...timestamps,
});

export const decisions = pgTable("decisions", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id),
  gateId: uuid("gate_id")
    .notNull()
    .references(() => gates.id),
  decidedBy: uuid("decided_by")
    .notNull()
    .references(() => users.id),
  decision: varchar("decision", { length: 20 }).notNull(),
  reason: text("reason").notNull(),
  evidenceBaselineHash: varchar("evidence_baseline_hash", {
    length: 64,
  }).notNull(),
  decidedAt: timestamp("decided_at", { withTimezone: true }).notNull(),
  ...timestamps,
});

export const edges = pgTable(
  "edges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    fromType: varchar("from_type", { length: 40 }).notNull(),
    fromId: uuid("from_id").notNull(),
    relationshipType: varchar("relationship_type", { length: 40 }).notNull(),
    toType: varchar("to_type", { length: 40 }).notNull(),
    toId: uuid("to_id").notNull(),
    ...timestamps,
  },
  (table) => [
    index("edges_project_from_idx").on(
      table.projectId,
      table.fromType,
      table.fromId,
    ),
    uniqueIndex("edges_project_edge_unique").on(
      table.projectId,
      table.fromType,
      table.fromId,
      table.relationshipType,
      table.toType,
      table.toId,
    ),
  ],
);

export const auditEvents = pgTable("audit_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id),
  actorId: uuid("actor_id").references(() => users.id),
  action: varchar("action", { length: 120 }).notNull(),
  entityType: varchar("entity_type", { length: 40 }).notNull(),
  entityId: uuid("entity_id").notNull(),
  beforeHash: varchar("before_hash", { length: 64 }),
  afterHash: varchar("after_hash", { length: 64 }),
  previousEventHash: varchar("previous_event_hash", { length: 64 }),
  eventHash: varchar("event_hash", { length: 64 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const cxChecklists = pgTable(
  "cx_checklists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    systemId: uuid("system_id")
      .notNull()
      .references(() => systems.id),
    gateId: uuid("gate_id")
      .notNull()
      .references(() => gates.id),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => assets.id),
    title: varchar("title", { length: 250 }).notNull(),
    status: checklistStatus("status").notNull().default("draft"),
    standardVersionIds: jsonb("standard_version_ids").notNull().default([]),
    generationStatus: varchar("generation_status", { length: 24 })
      .notNull()
      .default("queued"),
    generationJobId: uuid("generation_job_id"),
    generationError: text("generation_error"),
    generationModelVersion: varchar("generation_model_version", { length: 80 })
      .notNull()
      .default("pending"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    reviewedBy: uuid("reviewed_by").references(() => users.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewNote: text("review_note"),
    ...timestamps,
  },
  (table) => [
    index("cx_checklists_project_gate_idx").on(
      table.projectId,
      table.gateId,
      table.status,
    ),
  ],
);

export const cxChecklistSteps = pgTable(
  "cx_checklist_steps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    checklistId: uuid("checklist_id")
      .notNull()
      .references(() => cxChecklists.id),
    sequenceNumber: numeric("sequence_number", {
      precision: 8,
      scale: 0,
    }).notNull(),
    instruction: text("instruction").notNull(),
    modality: varchar("modality", { length: 20 }).notNull(),
    parameter: varchar("parameter", { length: 200 }),
    nominalValue: numeric("nominal_value", { precision: 20, scale: 8 }),
    unit: varchar("unit", { length: 40 }),
    tolerance: numeric("tolerance", { precision: 20, scale: 8 }),
    expectedBoolean: boolean("expected_boolean"),
    narrativeCriterion: text("narrative_criterion"),
    required: boolean("required").notNull().default(true),
    reviewState: reviewState("review_state").notNull().default("proposed"),
    reviewNote: text("review_note"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("cx_steps_checklist_sequence_unique").on(
      table.checklistId,
      table.sequenceNumber,
    ),
  ],
);

export const cxClauseCitations = pgTable("cx_clause_citations", {
  id: uuid("id").primaryKey().defaultRandom(),
  checklistId: uuid("checklist_id")
    .notNull()
    .references(() => cxChecklists.id),
  stepId: uuid("step_id").references(() => cxChecklistSteps.id),
  clauseReference: varchar("clause_reference", { length: 200 }).notNull(),
  sourceRegionId: uuid("source_region_id").references(() => sourceRegions.id),
  verificationStatus: varchar("verification_status", { length: 20 })
    .notNull()
    .default("pending"),
  verificationReason: text("verification_reason"),
  ...timestamps,
});

export const cxTestRecords = pgTable(
  "cx_test_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    checklistId: uuid("checklist_id")
      .notNull()
      .references(() => cxChecklists.id),
    gateId: uuid("gate_id")
      .notNull()
      .references(() => gates.id),
    executedBy: uuid("executed_by")
      .notNull()
      .references(() => users.id),
    overallStatus: cxVerdict("overall_status")
      .notNull()
      .default("needs_human_review"),
    reportStatus: reportStatus("report_status").notNull().default("draft"),
    reportGenerationStatus: varchar("report_generation_status", { length: 24 })
      .notNull()
      .default("not_started"),
    reportGenerationJobId: uuid("report_generation_job_id"),
    reportGenerationError: text("report_generation_error"),
    reportModelVersion: varchar("report_model_version", { length: 80 }),
    reportContent: jsonb("report_content"),
    reportContentHash: varchar("report_content_hash", { length: 64 }),
    reportArtifactObjectId: uuid("report_artifact_object_id").references(
      () => storageObjects.id,
    ),
    evidenceId: uuid("evidence_id").references(() => evidence.id),
    approvedBy: uuid("approved_by").references(() => users.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    reportReviewNote: text("report_review_note"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("cx_test_records_checklist_executor_unique").on(
      table.checklistId,
      table.executedBy,
    ),
  ],
);

export const cxStepResults = pgTable(
  "cx_step_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    testRecordId: uuid("test_record_id")
      .notNull()
      .references(() => cxTestRecords.id),
    stepId: uuid("step_id")
      .notNull()
      .references(() => cxChecklistSteps.id),
    readingValue: numeric("reading_value", { precision: 20, scale: 8 }),
    readingBoolean: boolean("reading_boolean"),
    readingText: text("reading_text"),
    enteredBy: uuid("entered_by")
      .notNull()
      .references(() => users.id),
    enteredAt: timestamp("entered_at", { withTimezone: true }).notNull(),
    verdict: cxVerdict("verdict").notNull(),
    findingId: uuid("finding_id").references(() => findings.id),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("cx_results_record_step_unique").on(
      table.testRecordId,
      table.stepId,
    ),
  ],
);

export const compliancePrecedents = pgTable(
  "compliance_precedents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    requirementId: uuid("requirement_id")
      .notNull()
      .references(() => requirements.id),
    targetSourceRegionId: uuid("target_source_region_id")
      .notNull()
      .references(() => sourceRegions.id),
    targetContentHash: varchar("target_content_hash", { length: 64 }).notNull(),
    sourceCheckId: uuid("source_check_id").notNull(),
    title: varchar("title", { length: 250 }).notNull(),
    rationale: text("rationale").notNull(),
    reviewState: reviewState("review_state").notNull().default("proposed"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    reviewedBy: uuid("reviewed_by").references(() => users.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewNote: text("review_note"),
    ...timestamps,
  },
  (table) => [
    index("compliance_precedents_project_review_idx").on(
      table.projectId,
      table.reviewState,
    ),
    index("compliance_precedents_match_idx").on(
      table.projectId,
      table.requirementId,
      table.targetContentHash,
    ),
  ],
);

export const complianceChecks = pgTable(
  "compliance_checks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    requirementId: uuid("requirement_id")
      .notNull()
      .references(() => requirements.id),
    targetSourceRegionId: uuid("target_source_region_id")
      .notNull()
      .references(() => sourceRegions.id),
    comparisonType: varchar("comparison_type", { length: 30 })
      .notNull()
      .default("qualitative"),
    requirementSnapshot: jsonb("requirement_snapshot").notNull().default({}),
    targetSnapshot: jsonb("target_snapshot").notNull().default({}),
    verdict: varchar("verdict", { length: 40 }).notNull(),
    reviewState: reviewState("review_state").notNull().default("proposed"),
    confidence: numeric("confidence", { precision: 5, scale: 4 }).notNull(),
    reason: text("reason").notNull(),
    precedentId: uuid("precedent_id").references(() => compliancePrecedents.id),
    proposedFindingId: uuid("proposed_finding_id").references(
      () => findings.id,
    ),
    findingDisposition: varchar("finding_disposition", { length: 30 })
      .notNull()
      .default("not_applicable"),
    reviewedBy: uuid("reviewed_by").references(() => users.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewNote: text("review_note"),
    version: integer("version").notNull().default(1),
    suggestionSource: varchar("suggestion_source", { length: 20 }),
    suggestionModelVersion: varchar("suggestion_model_version", { length: 80 }),
    ...timestamps,
  },
  (table) => [
    index("compliance_checks_project_review_idx").on(
      table.projectId,
      table.reviewState,
      table.createdAt,
    ),
  ],
);

export const knowledgeChunks = pgTable(
  "knowledge_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    sourceRegionId: uuid("source_region_id")
      .notNull()
      .references(() => sourceRegions.id),
    documentType: varchar("document_type", { length: 40 }).notNull(),
    content: text("content").notNull(),
    contentHash: varchar("content_hash", { length: 64 }).notNull(),
    embedding: vector("embedding", { dimensions: 768 }),
    embeddingModel: varchar("embedding_model", { length: 80 }),
    ...timestamps,
  },
  (table) => [
    index("knowledge_chunks_scope_idx").on(
      table.tenantId,
      table.projectId,
      table.documentType,
    ),
    index("knowledge_chunks_embedding_idx").using(
      "ivfflat",
      table.embedding.op("vector_cosine_ops"),
    ),
    uniqueIndex("knowledge_chunks_project_hash_unique").on(
      table.projectId,
      table.contentHash,
    ),
  ],
);

export const shipments = pgTable(
  "shipments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    equipmentId: uuid("equipment_id").references(() => assets.id),
    name: varchar("name", { length: 200 }).notNull(),
    transportMode: varchar("transport_mode", { length: 10 })
      .notNull()
      .default("sea"),
    originName: varchar("origin_name", { length: 200 }),
    originLat: numeric("origin_lat", { precision: 9, scale: 6 }),
    originLng: numeric("origin_lng", { precision: 9, scale: 6 }),
    destinationName: varchar("destination_name", { length: 200 }),
    destinationLat: numeric("destination_lat", { precision: 9, scale: 6 }),
    destinationLng: numeric("destination_lng", { precision: 9, scale: 6 }),
    currentLat: numeric("current_lat", { precision: 9, scale: 6 }),
    currentLng: numeric("current_lng", { precision: 9, scale: 6 }),
    positionSource: varchar("position_source", { length: 20 })
      .notNull()
      .default("simulated"),
    mmsi: varchar("mmsi", { length: 20 }),
    plannedEta: timestamp("planned_eta", { withTimezone: true }).notNull(),
    weatherAdjustedEta: timestamp("weather_adjusted_eta", {
      withTimezone: true,
    }),
    weatherDelayFactor: numeric("weather_delay_factor", {
      precision: 8,
      scale: 5,
    })
      .notNull()
      .default("0"),
    telemetryReason: text("telemetry_reason"),
    lastPolledAt: timestamp("last_polled_at", { withTimezone: true }),
    requiredOnSite: timestamp("required_on_site", {
      withTimezone: true,
    }).notNull(),
    portCongestion: boolean("port_congestion").notNull().default(false),
    status: varchar("status", { length: 10 }).notNull().default("green"),
    lastNotifiedStatus: varchar("last_notified_status", { length: 10 }),
    assessedThreats: jsonb("assessed_threats").default([]),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    ...timestamps,
  },
  (table) => [
    index("shipments_project_status_idx").on(table.projectId, table.status),
  ],
);

// A shipment plan is a reviewable procurement recommendation derived from the
// saved Site Analysis. It deliberately remains separate from a live shipment:
// no route, schedule impact, or simulated telemetry is created until a person
// approves the proposed package and supplies its logistics basis.
export const shipmentPlans = pgTable(
  "shipment_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id),
    siteAnalysisId: uuid("site_analysis_id").references(() => siteAnalyses.id),
    sourceKey: varchar("source_key", { length: 100 }).notNull(),
    category: varchar("category", { length: 40 }).notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    requirementLevel: varchar("requirement_level", { length: 20 }).notNull(),
    rationale: text("rationale").notNull(),
    sourceAnswers: jsonb("source_answers").notNull().default({}),
    transportMode: varchar("transport_mode", { length: 10 }).notNull().default("land"),
    status: varchar("status", { length: 24 }).notNull().default("proposed"),
    approvedBy: uuid("approved_by").references(() => users.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    materializedShipmentId: uuid("materialized_shipment_id").references(() => shipments.id),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("shipment_plans_project_source_unique").on(table.projectId, table.sourceKey),
    index("shipment_plans_project_status_idx").on(table.projectId, table.status),
  ],
);

export const alerts = pgTable(
  "alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    eventType: varchar("event_type", { length: 40 }).notNull(),
    dedupKey: varchar("dedup_key", { length: 300 }).notNull(),
    status: alertStatus("status").notNull().default("active"),
    title: varchar("title", { length: 300 }).notNull(),
    payload: jsonb("payload").notNull(),
    ...timestamps,
  },
  (table) => [
    index("alerts_project_status_idx").on(table.projectId, table.status),
    uniqueIndex("alerts_dedup_key_unique").on(table.dedupKey),
  ],
);

export const durableJobs = pgTable(
  "durable_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").references(() => tenants.id),
    projectId: uuid("project_id").references(() => projects.id),
    queue: varchar("queue", { length: 80 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    status: jobStatus("status").notNull().default("queued"),
    idempotencyKey: varchar("idempotency_key", { length: 300 })
      .notNull()
      .unique(),
    payload: jsonb("payload").notNull(),
    result: jsonb("result"),
    error: text("error"),
    attempts: integer("attempts").notNull().default(0),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("durable_jobs_project_status_idx").on(table.projectId, table.status),
  ],
);

export const idempotencyRecords = pgTable(
  "idempotency_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scope: varchar("scope", { length: 120 }).notNull(),
    key: varchar("key", { length: 300 }).notNull(),
    requestHash: varchar("request_hash", { length: 64 }).notNull(),
    responseStatus: integer("response_status"),
    responseBody: jsonb("response_body"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("idempotency_scope_key_unique").on(table.scope, table.key),
  ],
);

export const scheduleEvents = pgTable(
  "schedule_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    eventId: varchar("event_id", { length: 200 }).notNull(),
    eventType: varchar("event_type", { length: 40 }).notNull(),
    dedupKey: varchar("dedup_key", { length: 300 }).notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    payload: jsonb("payload").notNull(),
    processingStatus: varchar("processing_status", { length: 30 })
      .notNull()
      .default("queued"),
    durableJobId: uuid("durable_job_id").references(() => durableJobs.id),
    resultVersionId: uuid("result_version_id"),
    processingError: text("processing_error"),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("schedule_events_project_event_unique").on(
      table.projectId,
      table.eventId,
    ),
    uniqueIndex("schedule_events_project_dedup_unique").on(
      table.projectId,
      table.dedupKey,
    ),
  ],
);

export const turnoverPacks = pgTable(
  "turnover_packs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    gateId: uuid("gate_id")
      .notNull()
      .references(() => gates.id),
    decisionId: uuid("decision_id")
      .notNull()
      .references(() => decisions.id),
    manifest: jsonb("manifest").notNull(),
    manifestHash: varchar("manifest_hash", { length: 64 }).notNull().unique(),
    objectKey: varchar("object_key", { length: 500 }).notNull().unique(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    ...timestamps,
  },
  (table) => [
    index("turnover_packs_project_gate_idx").on(table.projectId, table.gateId),
  ],
);

export const scheduleTasks = pgTable(
  "schedule_tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    sourceRegionId: uuid("source_region_id").references(() => sourceRegions.id),
    name: varchar("name", { length: 240 }).notNull(),
    durationHours: integer("duration_hours").notNull(),
    earliestStart: timestamp("earliest_start", { withTimezone: true }),
    deadline: timestamp("deadline", { withTimezone: true }),
    fixedStart: timestamp("fixed_start", { withTimezone: true }),
    vendor: varchar("vendor", { length: 200 }),
    leadTimeDays: integer("lead_time_days"),
    deadlineType: varchar("deadline_type", { length: 20 }),
    confidence: numeric("confidence", { precision: 5, scale: 4 }),
    validationIssues: jsonb("validation_issues").notNull().default([]),
    reviewState: reviewState("review_state").notNull().default("proposed"),
    reviewedBy: uuid("reviewed_by").references(() => users.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewNote: text("review_note"),
    ...timestamps,
  },
  (table) => [
    index("schedule_tasks_project_review_idx").on(
      table.projectId,
      table.reviewState,
    ),
  ],
);

export const scheduleResources = pgTable(
  "schedule_resources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    sourceRegionId: uuid("source_region_id").references(() => sourceRegions.id),
    name: varchar("name", { length: 200 }).notNull(),
    capacity: integer("capacity").notNull(),
    unit: varchar("unit", { length: 60 }).notNull().default("crew"),
    confidence: numeric("confidence", { precision: 5, scale: 4 }),
    validationIssues: jsonb("validation_issues").notNull().default([]),
    reviewState: reviewState("review_state").notNull().default("proposed"),
    reviewedBy: uuid("reviewed_by").references(() => users.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewNote: text("review_note"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("schedule_resources_project_name_unique").on(
      table.projectId,
      table.name,
    ),
  ],
);

export const scheduleTaskResources = pgTable(
  "schedule_task_resources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => scheduleTasks.id),
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => scheduleResources.id),
    demand: integer("demand").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("schedule_task_resource_unique").on(
      table.taskId,
      table.resourceId,
    ),
  ],
);

export const scheduleDependencies = pgTable(
  "schedule_dependencies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    predecessorTaskId: uuid("predecessor_task_id")
      .notNull()
      .references(() => scheduleTasks.id),
    successorTaskId: uuid("successor_task_id")
      .notNull()
      .references(() => scheduleTasks.id),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("schedule_dependency_unique").on(
      table.predecessorTaskId,
      table.successorTaskId,
    ),
  ],
);

export const scheduleVersions = pgTable(
  "schedule_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    parentVersionId: uuid("parent_version_id"),
    triggerEventId: uuid("trigger_event_id").references(
      () => scheduleEvents.id,
    ),
    versionNumber: integer("version_number").notNull(),
    reason: text("reason").notNull(),
    solverStatus: varchar("solver_status", { length: 30 }).notNull(),
    solverVersion: varchar("solver_version", { length: 80 })
      .notNull()
      .default("ortools-cp-sat-v1"),
    inputHash: varchar("input_hash", { length: 64 }).notNull(),
    objectiveHours: integer("objective_hours"),
    criticalTaskIds: jsonb("critical_task_ids").notNull().default([]),
    bottlenecks: jsonb("bottlenecks").notNull().default([]),
    overrunHours: integer("overrun_hours").notNull().default(0),
    explanation: text("explanation"),
    explanationModelVersion: varchar("explanation_model_version", {
      length: 100,
    }),
    explanationGeneratedAt: timestamp("explanation_generated_at", {
      withTimezone: true,
    }),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("schedule_versions_project_number_unique").on(
      table.projectId,
      table.versionNumber,
    ),
  ],
);

export const scheduleAssignments = pgTable(
  "schedule_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    versionId: uuid("version_id")
      .notNull()
      .references(() => scheduleVersions.id),
    taskId: uuid("task_id")
      .notNull()
      .references(() => scheduleTasks.id),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    isCritical: boolean("is_critical").notNull().default(false),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("schedule_assignment_version_task_unique").on(
      table.versionId,
      table.taskId,
    ),
  ],
);

export const riskSignals = pgTable(
  "risk_signals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    taskId: uuid("task_id")
      .notNull()
      .references(() => scheduleTasks.id),
    pollCycleId: uuid("poll_cycle_id").notNull(),
    signalType: varchar("signal_type", { length: 60 }).notNull(),
    status: varchar("status", { length: 20 }).notNull(),
    dataAvailable: boolean("data_available").notNull().default(true),
    source: varchar("source", { length: 120 }).notNull(),
    value: jsonb("value"),
    unavailableReason: text("unavailable_reason"),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (table) => [
    index("risk_signals_project_observed_idx").on(
      table.projectId,
      table.observedAt,
    ),
    index("risk_signals_poll_task_idx").on(table.pollCycleId, table.taskId),
  ],
);

export const scheduleRisks = pgTable(
  "schedule_risks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    taskId: uuid("task_id")
      .notNull()
      .references(() => scheduleTasks.id),
    sourceSignalId: uuid("source_signal_id").references(() => riskSignals.id),
    riskType: varchar("risk_type", { length: 80 }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("active"),
    probability: numeric("probability", { precision: 5, scale: 4 }).notNull(),
    estimatedDelayHours: integer("estimated_delay_hours").notNull(),
    mitigationOptions: jsonb("mitigation_options").notNull().default([]),
    materialityHash: varchar("materiality_hash", { length: 64 }).notNull(),
    scheduleEventId: uuid("schedule_event_id").references(
      () => scheduleEvents.id,
    ),
    reviewState: reviewState("review_state").notNull().default("proposed"),
    reviewedBy: uuid("reviewed_by").references(() => users.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewNote: text("review_note"),
    mitigationDisposition: varchar("mitigation_disposition", { length: 30 })
      .notNull()
      .default("unreviewed"),
    version: integer("version").notNull().default(1),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
    clearedAt: timestamp("cleared_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("schedule_risks_project_task_type_unique").on(
      table.projectId,
      table.taskId,
      table.riskType,
    ),
  ],
);

// Slice 8: generalized teach-back — the general case of correcting any AI
// proposal/disposition, following the same polymorphic subject pattern as
// `edges` (subjectType/subjectId rather than a typed FK per subject table).
// `compliancePrecedents` remains the specialized compliance case (exact-hash
// matching semantics that compliance verdicts depend on) and is untouched;
// this table never feeds compliance verdicts.
export const teachbackNotes = pgTable(
  "teachback_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    subjectType: varchar("subject_type", { length: 40 }).notNull(),
    subjectId: uuid("subject_id").notNull(),
    // What the AI proposed vs. what the human decided. Both are small JSON
    // snapshots (not full-row payloads) so this stays cheap to write from every
    // review route without duplicating the same shape the primary table stores.
    correctedFrom: jsonb("corrected_from").notNull(),
    correctedTo: jsonb("corrected_to"),
    rationale: text("rationale").notNull(),
    sourceRegionId: uuid("source_region_id").references(() => sourceRegions.id),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    // Mirrors the disposition that produced the note ("edited" | "rejected") —
    // there is no separate approval workflow for teach-back notes themselves;
    // they are already the record of a human's own decision and are only ever
    // surfaced as advisory context, never auto-applied.
    reviewState: reviewState("review_state").notNull(),
    // Embedding of `correctedFrom` (what a *future* AI proposal would look
    // like) so a later similar proposal can be matched against this note by
    // semantic similarity, scoped to project + subjectType, mirroring the
    // mandatory-filter-first pattern `retrieveSemanticCitations` uses over
    // `knowledgeChunks` — implemented as a sibling query here rather than
    // literal reuse, since that function is hard-wired to the ingestion-owned
    // knowledgeChunks table.
    embedding: vector("embedding", { dimensions: 768 }),
    embeddingModel: varchar("embedding_model", { length: 80 }),
    ...timestamps,
  },
  (table) => [
    index("teachback_notes_project_subject_idx").on(
      table.projectId,
      table.subjectType,
      table.subjectId,
    ),
    index("teachback_notes_embedding_idx").using(
      "ivfflat",
      table.embedding.op("vector_cosine_ops"),
    ),
  ],
);
