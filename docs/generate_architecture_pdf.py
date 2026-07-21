"""Generate the print-safe Pramana Cx A4 technical architecture dossier."""
from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate, Flowable, Frame, Image, KeepTogether, NextPageTemplate, PageBreak,
    PageTemplate, Paragraph, Spacer, Table, TableStyle,
)
from reportlab.pdfbase.pdfmetrics import stringWidth

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output" / "pdf" / "pramana-cx-technical-architecture.pdf"
ASSETS = ROOT / "docs" / "assets"

PAGE_W, PAGE_H = A4
MARGIN_X = 18 * mm
MARGIN_TOP = 20 * mm
MARGIN_BOTTOM = 19 * mm
CONTENT_W = PAGE_W - (2 * MARGIN_X)

FOREST = colors.HexColor("#2D463E")
DEEP = colors.HexColor("#102B23")
MINT = colors.HexColor("#DCECE3")
PAPER = colors.HexColor("#FDFBF7")
SAND = colors.HexColor("#F2EEE6")
AMBER = colors.HexColor("#B5651D")
AMBER_LIGHT = colors.HexColor("#F4D6B7")
WINE = colors.HexColor("#583935")
WINE_LIGHT = colors.HexColor("#EADBD8")
BLUE_LIGHT = colors.HexColor("#DBE7EE")
LINE = colors.HexColor("#D8DED9")
INK = colors.HexColor("#17211E")
MUTED = colors.HexColor("#66716D")


class RoundedBoxDiagram(Flowable):
    """Print-safe horizontal architecture flow diagram."""

    def __init__(self, title, nodes, width=CONTENT_W, height=72 * mm):
        super().__init__()
        self.title, self.nodes, self.width, self.height = title, nodes, width, height

    def draw(self):
        c = self.canv
        c.setFillColor(colors.HexColor("#FAFFF9"))
        c.setStrokeColor(LINE)
        c.roundRect(0, 0, self.width, self.height, 4 * mm, fill=1, stroke=1)
        c.setFillColor(FOREST)
        c.setFont("Helvetica-Bold", 8)
        c.drawString(6 * mm, self.height - 8 * mm, self.title.upper())
        gap = 4 * mm
        left = 6 * mm
        box_w = (self.width - left * 2 - gap * (len(self.nodes) - 1)) / len(self.nodes)
        box_h = 25 * mm
        y = (self.height - box_h) / 2 - 3 * mm
        palette = [MINT, AMBER_LIGHT, WINE_LIGHT, BLUE_LIGHT, MINT]
        for i, (label, note) in enumerate(self.nodes):
            x = left + i * (box_w + gap)
            c.setFillColor(palette[i % len(palette)])
            c.setStrokeColor(FOREST if i in (0, len(self.nodes) - 1) else colors.HexColor("#8B9A92"))
            c.roundRect(x, y, box_w, box_h, 3 * mm, fill=1, stroke=1)
            c.setFillColor(INK)
            c.setFont("Helvetica-Bold", 8)
            lines = _wrap(label, box_w - 8 * mm, "Helvetica-Bold", 8)
            text_y = y + box_h - 8 * mm
            for line in lines:
                c.drawCentredString(x + box_w / 2, text_y, line)
                text_y -= 3.5 * mm
            c.setFont("Helvetica", 6.5)
            c.setFillColor(MUTED)
            for line in _wrap(note, box_w - 8 * mm, "Helvetica", 6.5)[:2]:
                c.drawCentredString(x + box_w / 2, text_y - 1 * mm, line)
                text_y -= 3 * mm
            if i < len(self.nodes) - 1:
                c.setStrokeColor(colors.HexColor("#586D63"))
                c.setLineWidth(.8)
                start, end = x + box_w, x + box_w + gap
                mid_y = y + box_h / 2
                c.line(start, mid_y, end - 2 * mm, mid_y)
                c.line(end - 2 * mm, mid_y, end - 4 * mm, mid_y + 1.5 * mm)
                c.line(end - 2 * mm, mid_y, end - 4 * mm, mid_y - 1.5 * mm)


def _wrap(text, max_width, font, size):
    words, lines, current = text.split(), [], ""
    for word in words:
        candidate = (current + " " + word).strip()
        if current and stringWidth(candidate, font, size) > max_width:
            lines.append(current)
            current = word
        else:
            current = candidate
    if current:
        lines.append(current)
    return lines


def styles():
    base = getSampleStyleSheet()
    return {
        "cover_kicker": ParagraphStyle("cover_kicker", parent=base["Normal"], fontName="Helvetica-Bold", fontSize=9, leading=12, textColor=colors.HexColor("#B9D8CA"), spaceAfter=10, tracking=1.2),
        "cover_title": ParagraphStyle("cover_title", parent=base["Normal"], fontName="Times-Bold", fontSize=39, leading=39, textColor=PAPER, spaceAfter=16),
        "cover_body": ParagraphStyle("cover_body", parent=base["Normal"], fontName="Helvetica", fontSize=14, leading=21, textColor=colors.HexColor("#D4E3DB"), spaceAfter=16),
        "title": ParagraphStyle("title", parent=base["Heading1"], fontName="Times-Bold", fontSize=29, leading=31, textColor=INK, spaceAfter=10),
        "section": ParagraphStyle("section", parent=base["Heading1"], fontName="Times-Bold", fontSize=23, leading=26, textColor=INK, spaceBefore=2, spaceAfter=11),
        "subsection": ParagraphStyle("subsection", parent=base["Heading2"], fontName="Times-Bold", fontSize=14, leading=17, textColor=FOREST, spaceBefore=12, spaceAfter=6),
        "kicker": ParagraphStyle("kicker", parent=base["Normal"], fontName="Helvetica-Bold", fontSize=8, leading=10, textColor=AMBER, spaceBefore=2, spaceAfter=5, tracking=1.1),
        "body": ParagraphStyle("body", parent=base["BodyText"], fontName="Helvetica", fontSize=9.4, leading=14, textColor=INK, spaceAfter=8),
        "small": ParagraphStyle("small", parent=base["BodyText"], fontName="Helvetica", fontSize=7.4, leading=10.2, textColor=INK, spaceAfter=3),
        "tablehead": ParagraphStyle("tablehead", parent=base["Normal"], fontName="Helvetica-Bold", fontSize=7, leading=8.5, textColor=PAPER),
        "tablecell": ParagraphStyle("tablecell", parent=base["Normal"], fontName="Helvetica", fontSize=7, leading=9, textColor=INK),
        "footer": ParagraphStyle("footer", parent=base["Normal"], fontName="Helvetica", fontSize=7, leading=9, textColor=MUTED),
    }


S = styles()


def p(text, style="body"):
    return Paragraph(text, S[style])


def bullet(items):
    return [Paragraph(f"&bull; {item}", ParagraphStyle("b", parent=S["body"], leftIndent=10, firstLineIndent=-8, spaceAfter=3)) for item in items]


def table(headers, rows, widths):
    data = [[Paragraph(h, S["tablehead"]) for h in headers]]
    for row in rows:
        data.append([Paragraph(str(value), S["tablecell"]) for value in row])
    t = Table(data, colWidths=widths, repeatRows=1, hAlign="LEFT")
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), FOREST),
        ("TEXTCOLOR", (0, 0), (-1, 0), PAPER),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), .35, LINE),
        ("BACKGROUND", (0, 1), (-1, -1), colors.HexColor("#FFFEFA")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#FFFEFA"), colors.HexColor("#FAF9F5")]),
        ("LEFTPADDING", (0, 0), (-1, -1), 5), ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    return t


def callout(title, text, warning=False):
    bg = colors.HexColor("#F8EFEE") if warning else colors.HexColor("#FBF3E9")
    border = WINE if warning else AMBER
    content = Paragraph(f"<b>{title}</b> {text}", S["body"])
    t = Table([[content]], colWidths=[CONTENT_W])
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), bg), ("LINEBEFORE", (0, 0), (0, -1), 3, border), ("LEFTPADDING", (0, 0), (-1, -1), 10), ("RIGHTPADDING", (0, 0), (-1, -1), 10), ("TOPPADDING", (0, 0), (-1, -1), 9), ("BOTTOMPADDING", (0, 0), (-1, -1), 9)]))
    return t


def shot(filename, caption):
    image = Image(str(ASSETS / filename))
    image.drawWidth = CONTENT_W
    image.drawHeight = CONTENT_W * 720 / 1280
    return KeepTogether([image, Spacer(1, 3 * mm), p(f"<b>{caption}</b>", "small")])


def cover(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(DEEP)
    canvas.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    canvas.setStrokeColor(colors.HexColor("#E8B16F"))
    canvas.setLineWidth(.7)
    canvas.circle(PAGE_W - 42 * mm, 57 * mm, 50 * mm, fill=0, stroke=1)
    canvas.circle(PAGE_W - 42 * mm, 57 * mm, 38 * mm, fill=0, stroke=1)
    canvas.setFillColor(colors.HexColor("#B9D8CA"))
    canvas.setFont("Helvetica-Bold", 8)
    canvas.drawString(20 * mm, 272 * mm, "PRAMANA CX  /  TECHNICAL ARCHITECTURE DOSSIER")
    canvas.setFillColor(PAPER)
    canvas.setFont("Times-Bold", 34)
    canvas.drawString(20 * mm, 240 * mm, "Evidence controlled.")
    canvas.setFillColor(colors.HexColor("#EDB574"))
    canvas.drawString(20 * mm, 218 * mm, "Intelligence governed.")
    canvas.setFillColor(colors.HexColor("#D4E3DB"))
    canvas.setFont("Helvetica", 13)
    text = "End-to-end product, system, data, AI, operations and deployment specification for governed commissioning intelligence."
    y = 188 * mm
    for line in _wrap(text, 130 * mm, "Helvetica", 13):
        canvas.drawString(20 * mm, y, line)
        y -= 7 * mm
    canvas.setFillColor(colors.HexColor("#B9D8CA"))
    canvas.setFont("Helvetica-Bold", 8)
    canvas.drawString(20 * mm, 25 * mm, "A4 PRINT EDITION  |  21 JULY 2026  |  CONFIDENTIAL")
    canvas.restoreState()


def normal_page(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(FOREST)
    canvas.setLineWidth(.7)
    canvas.rect(8 * mm, 8 * mm, PAGE_W - 16 * mm, PAGE_H - 16 * mm, fill=0, stroke=1)
    canvas.setFillColor(FOREST)
    canvas.setFont("Helvetica-Bold", 7)
    canvas.drawString(13 * mm, PAGE_H - 12 * mm, "PRAMANA CX  /  TECHNICAL ARCHITECTURE")
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 7)
    canvas.drawRightString(PAGE_W - 13 * mm, 12 * mm, f"CONFIDENTIAL  |  PAGE {doc.page}")
    canvas.restoreState()


def build_story():
    # Reserve the first A4 frame exclusively for the cover artwork.
    story = [Spacer(1, 245 * mm), NextPageTemplate("normal"), PageBreak()]
    story += [p("DOCUMENT INDEX", "kicker"), p("A4 technical dossier", "title"), p("This print-safe edition consolidates the current repository architecture, product requirements, technical requirements, data schema, application flow, design decisions, retrieval safeguards, release ledger and browser acceptance evidence.")]
    story.append(table(["Part", "Content"], [
        ("01", "Purpose, target users and authority model"), ("02", "Application experience and live screenshots"), ("03", "System architecture and service boundaries"), ("04", "End-to-end data flow, user flow and navigation"), ("05", "Database, provenance and schema domains"), ("06", "AI, RAG, agents and safety controls"), ("07", "Technology stack, SDKs, APIs and third parties"), ("08", "Prerequisites, installation, environment and operations"), ("09", "Testing strategy, branch/application errors and mitigations"), ("10", "Deployment readiness and future CI/CD"),
    ], [25 * mm, CONTENT_W - 25 * mm]))
    story.append(PageBreak())

    story += [p("01 / PURPOSE, USERS AND AUTHORITY", "kicker"), p("What Pramana Cx is designed to decide", "section"), p("Pramana Cx is a governed evidence control plane for mission-critical EPC and data-centre commissioning. It connects controlled requirements to systems, assets, gates, tests, evidence, findings, schedules, shipments and immutable source evidence so an authorized engineer can make a defensible gate decision."), callout("Non-negotiable authority rule.", "AI may extract, retrieve, rank, draft, classify and explain. Deterministic services calculate readiness, schedule feasibility and structured verdicts. Only an authorized human can accept a requirement or evidence item, approve a report, disposition a compliance finding or make a gate decision."), p("Target users and friction removed", "subsection"), table(["User", "Decision", "How the application makes it easier"], [
        ("Commissioning manager / authority", "Can a gate be defended today?", "Readiness unifies accepted proof, stale/failed evidence, predecessors, blockers, owners and citations."),
        ("EPC / GC MEP package lead", "What must be fixed before the next test?", "Actions, Cx, evidence and schedule views preserve shared operational context."),
        ("QA/QC engineer", "Does a controlled record meet a requirement?", "Source-region provenance, deterministic checks and cited comparison proposals replace evidence hunting."),
        ("Planner / scheduler", "What changed and should the baseline move?", "Reviewed inputs, immutable CP-SAT versions and before/after explanations separate facts from speculation."),
        ("Owner / operations team", "Is turnover complete and auditable?", "Approved-gate-only manifests, hashes and independent verification make the package inspectable."),
        ("Field engineer / vendor", "How can proof be captured safely on site?", "Offline capture queues evidence idempotently until an authorized reviewer accepts it."),
    ], [38 * mm, 43 * mm, CONTENT_W - 81 * mm]), p("Application coverage", "subsection")] + bullet([
        "Controlled sources, revisions, exact source-region citations and proposal review.",
        "Requirements, systems, assets, gates, evidence, findings, readiness and turnover packs.",
        "Schedule inputs, CP-SAT baselines, immutable versions, live events and advisory risks.",
        "Cx standards, cited checklists, deterministic readings, reports and human approval.",
        "Shipments, map routes, compliance, knowledge/RFI intelligence, graph, changes and Command Center.",
    ])
    story.append(PageBreak())

    story += [p("02 / APPLICATION EXPERIENCE", "kicker"), p("Task-oriented, cited and resilient", "section"), p("The workspace groups navigation as Control, Deliver and Investigate. Deep links preserve the selected gate, task, finding or shipment across feature boundaries. Busy-state and progress behaviour is operation-specific, bounded and visible, so long-running work cannot silently replace another action."), p("Live browser-captured application surfaces", "subsection"), shot("pramana-overview.jpg", "Overview and grouped navigation - one project context and a complete task map."), shot("pramana-cx.jpg", "Governed Cx tests - cited standards, deterministic readings, human review and report approval."), PageBreak(), shot("pramana-shipments.jpg", "Shipment visibility - route/position context, ETA provenance and controlled operational status."), shot("pramana-knowledge.jpg", "Cited knowledge intelligence - project-scoped retrieval and source-grounded answers."), p("End-to-end user journey", "subsection"), table(["Step", "Surface", "Data flow", "Outcome"], [
        ("1", "Overview / Settings", "Project membership scopes all loads and actions.", "User enters an authorized project context."),
        ("2", "Sources / Cx", "Bytes -> hash/version -> source regions -> durable extraction.", "Reviewer sees cited proposals."),
        ("3", "Systems / Requirements", "Accepted records create typed system/asset/gate relationships.", "Facility context is traversable."),
        ("4", "Evidence / Field / Cx", "Evidence starts pending; review adds acceptance/audit state.", "Proof contributes to readiness only when accepted."),
        ("5", "Schedule / Shipments", "Validated event -> delta detector -> CP-SAT only if material.", "New immutable version or status-only update."),
        ("6", "Actions / Compliance / Knowledge", "Findings, alerts and citations retain record identity.", "Owner resolves human-reviewed work."),
        ("7", "Readiness / Turnover", "Rules + authorized decision -> manifest.", "Approved gates produce verifiable turnover."),
    ], [10 * mm, 35 * mm, 73 * mm, CONTENT_W - 118 * mm])]
    story.append(PageBreak())

    story += [p("03 / SYSTEM ARCHITECTURE", "kicker"), p("Modular monolith with isolated services", "section"), p("The Next.js core is the authenticated, project-scoped front door and business authority. Durable or expensive work passes through Redis/BullMQ. PostgreSQL is the transactional source of truth; object storage holds immutable bytes; typed relational edges provide governed graph traversal."), RoundedBoxDiagram("End-to-end platform", [
        ("Next.js experience", "web, PWA and route handlers"), ("Node core", "auth, RBAC, Zod, domain commands"), ("PostgreSQL", "authority, audit, FTS and vectors"), ("Durable worker", "BullMQ, retries and idempotency"), ("Internal services", "ingestion, solver, retrieval and signals"),
    ]), p("Service ownership and boundaries", "subsection"), table(["Component", "Owns", "Must not own"], [
        ("Next.js core", "Authentication, authorization, validation, domain commands, audit and project scoping.", "Long solver/extraction work or vendor-specific direct AI calls."),
        ("Worker + BullMQ", "Retryable background operations, stable job identity and durable job state.", "Interactive authorization or final human approval."),
        ("Ingestion service", "Format extraction into structured regions.", "Business authority, readiness or permission decisions."),
        ("CP-SAT solver", "Feasible schedule or explicit bottleneck/infeasibility result.", "Database/object storage access, approvals or LLM calls."),
        ("Retrieval service", "Embeddings and cross-encoder reranking.", "Database credentials, tenant decisions or final-answer authority."),
    ], [35 * mm, 66 * mm, CONTENT_W - 101 * mm]), callout("Architecture decision.", "CP-SAT runs as a stateless dedicated service because an optimization run must not block the Node request process. The caller passes the complete DAG/constraints; the solver does not read Postgres or object storage."), PageBreak()]

    story += [p("04 / DATA FLOW, USER FLOW AND NAVIGATION", "kicker"), p("From controlled source to approved turnover", "section"), RoundedBoxDiagram("Authority and evidence flow", [
        ("Upload", "immutable object and SHA-256"), ("Extract", "page/box source regions"), ("Propose", "bounded AI + citations"), ("Review", "accept, edit or reject"), ("Rules", "readiness and verdicts"), ("Turnover", "approved-gate manifest"),
    ]), p("Runtime job lifecycle", "subsection")] + bullet([
        "The browser submits a project-scoped command. The core authenticates, authorizes, validates and persists idempotency/audit state.",
        "Long-running work becomes a stable BullMQ job. The caller receives a job reference and can read progress without freezing the UI.",
        "The worker reads immutable input, invokes an internal service under timeout/retry rules, validates structured output and persists result, edges and audit event.",
        "The UI reads the authoritative result and labels advisory versus authoritative state.",
    ]) + [p("Schedule event flow", "subsection"), RoundedBoxDiagram("Materiality-gated schedule handling", [
        ("Event producer", "shipment, weather or risk"), ("Validated event", "deduped project record"), ("Delta detector", "critical-path/downstream check"), ("Status only", "no new version if irrelevant"), ("CP-SAT solve", "warm start when material"), ("Version + explainer", "immutable before/after"),
    ]), callout("Schedule safety boundary.", "Predictive risk can observe, explain and propose mitigation options. It cannot apply a mitigation, alter dependencies/resources, invoke the solver autonomously or change dates.", True), p("Navigation contract", "subsection"), p("Cross-feature actions include a stable identifier in the URL, for example <font name='Courier'>/readiness?gate=...</font>, <font name='Courier'>/schedule?task=...</font>, <font name='Courier'>/actions?finding=...</font> and <font name='Courier'>/shipments?shipment=...</font>. The destination validates, consumes and focuses the exact record; a missing target degrades safely rather than producing an unrelated generic screen.")]

    story += [p("05 / DATABASE, PROVENANCE AND SCHEMA", "kicker"), p("Transactional authority, immutable bytes, traversable relationships", "section"), p("Every authoritative record is tenant and project scoped. Cross-project identifiers are rejected at the API boundary. Normalized relational tables remain the authority; the <font name='Courier'>edges</font> relation enables governed traversal; immutable object storage retains original source/evidence/report/turnover bytes."), RoundedBoxDiagram("Core entity path", [
        ("Tenant / project", "membership and authorization"), ("Document version", "immutable source record"), ("Source region", "page, box and hash"), ("Requirement", "human-reviewed authority"), ("Evidence / finding", "proof or blocker"), ("Gate / turnover", "decision and manifest"),
    ]), p("Persistence domains", "subsection"), table(["Domain", "Representative records", "Integrity intent"], [
        ("Identity and scope", "tenants, users, projects, project_members, sessions", "Membership is evaluated server-side for every record and action."),
        ("Sources and knowledge", "documents, document_versions, source_regions, knowledge_chunks", "Immutable bytes, exact citations and embedding-model tags prevent mixed vector spaces."),
        ("Evidence control", "requirements, evidence, systems, assets, gates, findings, decisions, turnover packs", "Human review and deterministic readiness govern state transitions."),
        ("Planning and supply", "schedule_tasks, resources, schedule_versions, schedule_events, risks, shipments", "Accepted inputs, immutable solve history, event deduplication and provenance."),
        ("Cross-cutting", "edges, durable_jobs, alerts, audit_events", "Typed relationships, retry/idempotency and append-only hash-linked history."),
    ], [35 * mm, 80 * mm, CONTENT_W - 115 * mm]), p("Provenance safeguards", "subsection")] + bullet([
        "Immutable SHA-256 object record is stored before extraction; source regions retain document version, page, bounding box and content hash.",
        "New revisions never overwrite old regions; superseded, rejected, failed or unauthorized sources cannot be retrieval candidates.",
        "Accepted-only evidence can prove a requirement. Stale/failed evidence invalidates readiness; edits trigger audited recalculation.",
        "Audit events are append-only and hash-linked per project.",
    ])

    story += [p("06 / AI, RAG AND AGENT BOUNDARIES", "kicker"), p("Bounded, cited, time-limited and non-authoritative", "section"), p("Core generation and embedding calls resolve through a central provider boundary. Local Ollama is the intended deployment default: gemma4:e2b for structured generation and nomic-embed-text:latest for 768-dimensional embeddings. Gemini and NVIDIA NIM can be selected explicitly. The deterministic mock provider is verification-only and must never be deployed."), RoundedBoxDiagram("Controlled RAG pipeline", [
        ("User query", "project-scoped request"), ("Deterministic scope", "tenant, project and explicit filters"), ("Hybrid candidates", "SQL FTS + pgvector"), ("Cross-encoder", "stateless retrieval service"), ("Cited synthesis", "claims without region IDs dropped"),
    ]), p("Provider and RAG safeguards", "subsection")] + bullet([
        "Bounded prompt/context sizes, output token caps, request deadlines, schema validation and retry limits.",
        "Client aborts, per-operation busy state and progress feedback prevent frontend blocking.",
        "Tenant/project and supplied metadata filters are enforced in SQL before ranking, not after retrieval.",
        "Only explicit reviewer/user filters and deterministic title routing may narrow authority-bearing scope. The LLM cannot choose system, asset, gate, revision, type or document scope.",
        "Groundedness is code-enforced: an answer claim without a resolvable source-region identifier is dropped.",
    ]) + [p("Five operational agent capabilities", "subsection"), table(["Capability", "Implementation posture", "Non-negotiable boundary"], [
        ("Commissioning QA Copilot", "Cited standards, checklist proposal, deterministic readings, human-routed narrative review and draft report workflow.", "No automatic approval; approved report only becomes immutable evidence after review."),
        ("Supply Chain Visibility and Risk", "Shipment legs, multi-mode map, polling and weather/congestion/AIS assessment.", "Delayed/recovered event is provenance-labelled and cannot directly alter a schedule."),
        ("Specification and Quality Compliance", "Semantic candidate discovery plus deterministic numeric/boolean/category comparisons and precedent handling.", "Creates proposed findings only; an engineer decides disposition."),
        ("Predictive Schedule Risk", "Bounded observations of procurement, lead-time, workforce and weather with materiality/deduplication.", "Advisory risks/mitigations only; it cannot change dates or apply an option."),
        ("Knowledge and RFI Intelligence", "Hybrid project-scoped retrieval, graph context, reranking, cited synthesis and similar-RFI retrieval.", "Returns grounded citations or explicit no-results; never invents authority."),
    ], [37 * mm, 80 * mm, CONTENT_W - 117 * mm]), PageBreak()]

    story += [p("07 / TECHNOLOGY, SDKS, APIS AND SERVICES", "kicker"), p("Concrete technology inventory", "section"), table(["Layer", "Technology", "Purpose"], [
        ("Web", "Next.js 16.2.10, React 19, TypeScript 5.7", "Server-rendered application, route handlers, typed UI and responsive PWA surfaces."),
        ("Schema and validation", "Drizzle ORM 0.45, Drizzle Kit 0.31, Zod 3.24", "SQL migrations, relational authority and validated contracts."),
        ("Database", "PostgreSQL 16 target topology, pgvector, Postgres FTS", "Transactional state, constraints, audit/jobs and hybrid search."),
        ("Queue/cache", "Redis, BullMQ 5.80, ioredis 5.11", "Durable background work, idempotency coordination and rate limits."),
        ("Storage", "Filesystem locally; MinIO/S3 via AWS SDK v3", "Immutable original, report and turnover artifacts with signed reads."),
        ("Extraction / solver / retrieval", "Python/FastAPI, PyMuPDF, Google OR-Tools CP-SAT, BAAI bge models", "Controlled source extraction, optimization, embeddings and reranking."),
        ("AI providers", "Ollama gemma4:e2b and nomic-embed-text; optional Gemini and NVIDIA NIM", "Explicit schema-validated advisory provider choices."),
        ("Maps and UX", "Leaflet, React Leaflet, Turf, searoute-js, OpenStreetMap, Lucide, Three.js", "Route visualisation, geospatial geometry and application visual system."),
        ("Identity", "bcryptjs, OTPAuth, optional Clerk Next.js SDK", "Owned credentials/TOTP or external identity adapter with app-owned RBAC."),
    ], [37 * mm, 63 * mm, CONTENT_W - 100 * mm]), p("API group contract", "subsection"), table(["Group", "Representative routes", "Expectation"], [
        ("Identity", "/api/auth/*, /api/profile", "Credentials/Clerk, sessions, TOTP and rate limits."),
        ("Project authority", "/api/projects, /members, /activate, /alerts", "Server-side membership and role enforcement."),
        ("Evidence control", "/sources, /evidence, /requirements, /gates, /turnover-packs", "Versioning, citations, review and readiness."),
        ("Schedule and risk", "/schedule/tasks, /resources, /baseline, /events, /risks", "Reviewed input, immutable versions and solver isolation."),
        ("Cx/compliance/knowledge", "/cx/*, /compliance/*, /knowledge/*, /graph", "Cited, scoped, proposed-only advisory flows."),
    ], [37 * mm, 64 * mm, CONTENT_W - 101 * mm]), PageBreak()]

    story += [p("08 / PREREQUISITES, INSTALLATION AND CONFIGURATION", "kicker"), p("Local topology and production configuration", "section"), p("Local development can use separate PostgreSQL, Redis, ingestion and solver processes or the complete Compose topology. Production must use secret-managed configuration, non-degraded infrastructure and a model endpoint reachable from both web and worker services."), p("Installation", "subsection"), Paragraph("<font name='Courier'>npm install<br/>cp .env.example .env.local<br/>npm run db:migrate<br/>npm run db:seed<br/>npm run system:start<br/><br/>npm run typecheck<br/>npm run build<br/>npm run verify:all<br/><br/>ollama pull gemma4:e2b<br/>ollama pull nomic-embed-text:latest<br/>MODEL_PROVIDER=ollama EMBEDDING_PROVIDER=ollama npm run verify:ollama</font>", S["body"]), p("Environment and infrastructure requirements", "subsection"), table(["Requirement", "Local", "Production"], [
        ("Runtime", "Node 22, npm, Python 3; Docker Desktop for Compose.", "Pinned images/runtimes; separate web and worker processes."),
        ("Database", "Reachable Postgres; migrations applied; pgvector where used.", "TLS, backups, restore rehearsal, role separation and empty-db migration proof."),
        ("Secrets", ".env.local never committed.", "Secret manager, rotation policy and no secrets in artifacts/logs."),
        ("Object storage", "Filesystem or local MinIO.", "Private bucket, encryption, lifecycle/retention and signed URL policy."),
        ("Models", "Optional local Ollama for real smoke tests.", "Reachable model service for web/worker with data-processing approval."),
    ], [35 * mm, 68 * mm, CONTENT_W - 103 * mm]), p("Key configuration groups", "subsection"), table(["Group", "Representative keys", "Release condition"], [
        ("Auth", "APP_BASE_URL, AUTH_MODE, AUTH_ENCRYPTION_KEY, Clerk keys", "Use credentials or Clerk, never development mode."),
        ("AI/RAG", "MODEL_PROVIDER, EMBEDDING_PROVIDER, OLLAMA_BASE_URL, model keys, GEMINI_API_KEY, NIM_API_KEY", "No mock provider; endpoints reachable and bounded."),
        ("Infrastructure", "Database/Redis URLs, object storage settings, INFRA_ALLOW_DEGRADED", "All dependencies healthy; degraded mode false."),
        ("Signals", "Procurement, lead-time, workforce, weather, AIS/congestion settings", "Live/synthetic/unavailable provenance is explicit."),
    ], [29 * mm, 83 * mm, CONTENT_W - 112 * mm]), callout("Installation exit criteria.", "Migrations pass, dependencies are healthy, an authorized source can be processed, the verification matrix passes and the real-provider smoke test is run separately when a provider is configured."), PageBreak()]

    story += [p("09 / TESTING, ERROR HISTORY AND MITIGATION", "kicker"), p("Release confidence is a matrix, not a green build", "section"), table(["Area", "Coverage", "Evidence"], [
        ("Build/migration", "TypeScript, optimized build, Drizzle checks and migration replay.", "Valid artifact and schema state."),
        ("Security/tenancy", "Credentials/TOTP, rate limits, cross-project rejection and audit chain.", "Server-side enforcement and append-only history."),
        ("Evidence to turnover", "Pending/accepted proof, readiness, gate decision and manifest verification.", "Accepted-only proof and independently verifiable turnover."),
        ("Schedule/risk", "Inputs, dependencies, CP-SAT feasibility, immutable versions and recovery.", "No solve for irrelevant event; explicit degradation."),
        ("Cx/compliance/knowledge", "Citations, deterministic readings, review, filters, reranking and groundedness.", "No ungrounded or unauthorized decision."),
        ("Browser acceptance", "Sidebar journeys, mobile/desktop layouts, busy state, maps and console capture.", "No duplicate-key warning, error boundary or overflow."),
    ], [36 * mm, 86 * mm, CONTENT_W - 122 * mm]), p("Cross-branch and application mitigation ledger", "subsection"), table(["Failure found", "Mitigation now built"], [
        ("Mock TypeScript output could impersonate an LLM.", "Explicit generation/embedding providers, Ollama default, mock test-only rule and provenance."),
        ("Direct Gemini/provider bypasses produced inconsistent policy.", "Central schema-validated provider boundary and real-provider smoke tests."),
        ("Long prompts made operations look stuck.", "Prompt/token/request bounds, client abort, progress, busy state and bounded retry."),
        ("Deep links lost record context.", "Destination validation and focus contracts for readiness, schedule, actions and shipments."),
        ("Duplicate React keys and business rows.", "Stable composite UI keys, unique business constraints and integrity verification."),
        ("Conflicting branch migrations.", "Final-schema-first reconciliation, ordered migrations and replay validation."),
        ("Processed documents were absent/misattributed in RAG.", "Extraction-indexing contract, backfill, SQL document filtering and citation validation."),
        ("Map fallbacks looked operational.", "Coordinate checks, HTTPS/deadline routing, mode-aware provenance and explicit fallback notice."),
        ("Raw JSON/hashes/synthetic cues degraded UX.", "Presentation helpers, human labels, bounded formatting and source-state labels."),
        ("Architecture documentation regressed through merge work.", "Visible README diagrams, this PDF dossier, release ledger and documentation-first review."),
    ], [75 * mm, CONTENT_W - 75 * mm]), callout("Local verification result.", "Type check, optimized production build, production dependency audit and the post-fix local verification matrix have passed. Target-environment infrastructure, real provider acceptance, accessibility and load validation remain production gates.")]

    story += [p("10 / DEPLOYMENT READINESS AND FUTURE CI/CD", "kicker"), p("Controlled deployment, not an environment-variable switch", "section"), RoundedBoxDiagram("Future CI/CD pipeline", [
        ("Pull request", "review and protected branch"), ("Static gates", "typecheck, audit, secret scan"), ("Test matrix", "API, migration and browser"), ("Build artifact", "SBOM and image scan"), ("Staging proof", "services and real provider"), ("Controlled deploy", "approval, observe, rollback"),
    ]), p("Required production gates", "subsection")] + bullet([
        "Secrets and identity: production AUTH_MODE, encryption/session settings, base URL and identity credentials are secret-managed and validated.",
        "AI: selected Ollama, Gemini or NIM generation/embedding endpoint is reachable by web and worker; deadline, structured output and embeddings are smoke-tested in release configuration.",
        "Data plane: pgvector is available; migrations-from-empty, S3/MinIO lifecycle, Redis/worker recovery and backup/restore are rehearsed.",
        "Internal services: ingestion, solver and retrieval health checks are green; TLS/internal network restrictions and non-degraded infrastructure are active.",
        "Live signals: AIS/weather/congestion/procurement provenance and failure semantics are validated; synthetic paths are disabled or visibly labelled outside test/demo environments.",
        "Operations: CI, structured logs/correlation IDs, metrics, traces, queue dashboards, alerting, incident ownership, accessibility and load testing are present before release.",
    ]) + [p("Explicit non-claims", "subsection"), callout("Engineering authority remains human.", "Pramana Cx assists engineering judgement. It does not independently certify a facility, replace the commissioning authority or engineer of record, issue Tier/TIA/BICSI/statutory approval, autonomously close findings/waivers or represent simulated operational feeds as live evidence.", True), p("Maintenance references", "subsection"), p("<b>README.md</b> - implementation map, diagrams, defect audit and configuration. <b>STATUS.md</b> - authoritative shipped/open ledger. <b>PLANNER/PRD.md</b> and <b>PLANNER/TRD.md</b> - product scope and technical contracts. <b>PLANNER/Schema.md</b>, <b>AppFlow.md</b>, <b>DesignDecisions.md</b> and <b>RetrievalArchitecture.md</b> - data model, flows, decisions and retrieval safeguards.", "small")]
    return story


def main():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    frame = Frame(MARGIN_X, MARGIN_BOTTOM, CONTENT_W, PAGE_H - MARGIN_TOP - MARGIN_BOTTOM, leftPadding=0, bottomPadding=0, rightPadding=0, topPadding=0)
    doc = BaseDocTemplate(str(OUT), pagesize=A4, leftMargin=MARGIN_X, rightMargin=MARGIN_X, topMargin=MARGIN_TOP, bottomMargin=MARGIN_BOTTOM)
    doc.addPageTemplates([
        PageTemplate(id="cover", frames=[frame], onPage=cover),
        PageTemplate(id="normal", frames=[frame], onPage=normal_page),
    ])
    story = build_story()
    doc.build(story)


if __name__ == "__main__":
    main()
