"""Generate the print-safe Pramana Cx A4 technical architecture dossier."""
from pathlib import Path
import json
import re
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


def env_inventory():
    """Read the real example configuration so this appendix stays current."""
    rows, seen = [], set()
    for raw in (ROOT / ".env.example").read_text().splitlines():
        if not raw or raw.startswith("#") or "=" not in raw:
            continue
        key, value = raw.split("=", 1)
        if key in seen or not re.match(r"^[A-Z][A-Z0-9_]*$", key):
            continue
        seen.add(key)
        if key.startswith(("DATABASE", "POSTGRES", "REDIS", "S3", "MINIO", "OBJECT", "LOCAL_UPLOAD")):
            group = "data/infrastructure"
        elif key.startswith(("MODEL", "OLLAMA", "GEMINI", "NIM", "EMBEDDING", "RETRIEVAL")):
            group = "AI/retrieval"
        elif key.startswith(("AUTH", "SESSION", "CLERK", "APP_BASE")):
            group = "identity/application"
        elif key.startswith(("RISK", "SHIPMENT", "SOLVER", "INGESTION", "COMPLIANCE", "RFI", "HIGH", "PACK")):
            group = "domain/targets"
        else:
            group = "runtime"
        rows.append((key, group, value or "required/optional by selected mode"))
    return rows


def endpoint_inventory():
    routes = []
    for route in sorted((ROOT / "src" / "app" / "api").rglob("route.ts")):
        value = "/api" + str(route.parent.relative_to(ROOT / "src" / "app" / "api")).replace("\\", "/")
        if value.endswith("/."):
            value = "/api"
        top = value.split("/")[2] if len(value.split("/")) > 2 else "root"
        routes.append((top, value))
    return routes


def verification_inventory():
    scripts = json.loads((ROOT / "package.json").read_text())["scripts"]
    return [(name, scripts[name]) for name in scripts if name.startswith("verify:")]


def cover(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(DEEP)
    canvas.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    canvas.setStrokeColor(colors.HexColor("#E8B16F"))
    canvas.setLineWidth(.8)
    canvas.rect(10 * mm, 10 * mm, PAGE_W - 20 * mm, PAGE_H - 20 * mm, fill=0, stroke=1)
    canvas.setFillColor(PAPER)
    canvas.setFont("Times-Bold", 42)
    canvas.drawCentredString(PAGE_W / 2, 183 * mm, "Pramana Cx")
    canvas.setFillColor(colors.HexColor("#EDB574"))
    canvas.setFont("Helvetica-Bold", 10)
    canvas.drawCentredString(PAGE_W / 2, 164 * mm, "TECHNICAL ARCHITECTURE & PRODUCT DOSSIER")
    canvas.setFillColor(colors.HexColor("#D4E3DB"))
    canvas.setFont("Helvetica-Bold", 10)
    canvas.drawCentredString(PAGE_W / 2, 105 * mm, "TEAM PRAMANA")
    canvas.setFont("Helvetica", 11)
    canvas.drawCentredString(PAGE_W / 2, 95 * mm, "Atharva Deo  ·  Bhavik Sheth  ·  Dravvya Jain")
    canvas.setFillColor(colors.HexColor("#B9D8CA"))
    canvas.setFont("Helvetica-Bold", 8)
    canvas.drawCentredString(PAGE_W / 2, 25 * mm, "A4 PRINT EDITION  |  25 AUGUST 2026  |  CONFIDENTIAL")
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
        ("01", "Purpose, target users and authority model"), ("02", "Team, proposition and connected management outcome"), ("03", "Application experience and live screenshots"), ("04", "System architecture and service boundaries"), ("05", "End-to-end data flow, user flow and navigation"), ("06", "Database, provenance and schema domains"), ("07", "AI, RAG, agents and safety controls"), ("08", "Technology stack, SDKs, APIs and third parties"), ("09", "Prerequisites, installation, environment and operations"), ("10", "Testing strategy, branch/application errors and mitigations"), ("11", "Deployment readiness and future CI/CD"),
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
        "Sixteen-stage Site Analysis with review, deterministic conflicts, planning insights and versioned finalization.",
        "Readiness, commissioning plans, controlled tests, evidence, findings and turnover linked to accepted project records.",
        "USD-authoritative Financial Modeler with INR display, NPV, IRR, payback, sensitivity and key-driver explanations.",
        "Site-derived procurement, approved shipment materialization, maps, routes, weather and schedule events.",
        "RackDB-style digital rack revisions, project-derived capacity, custom GPU/rack components, wiring and controlled model exports.",
        "Compliance, controlled RAG, knowledge/RFI intelligence, graph, changes and Command Center.",
    ])
    story.append(PageBreak())

    story += [p("02 / TEAM, PROPOSITION AND CONNECTED OUTCOME", "kicker"), p("Three builders, one governed project story", "section"), p("<b>Atharva Deo, Bhavik Sheth and Dravvya Jain</b> are Team Pramana: a three-member product and engineering team building decision infrastructure for mission-critical data-centre delivery. Pramana Cx is not another document chatbot. It connects the work a project manager must already coordinate—site feasibility, requirements, systems, evidence, tests, compliance, logistics, economics and turnover—into one explainable control plane."), RoundedBoxDiagram("Connected management loop", [
        ("Controlled sources", "PDF, CSV, image and RFP"), ("Site analysis", "16-step planning ledger"), ("Project model", "systems, assets and racks"), ("Evidence graph", "claims, tests and citations"), ("Decision engines", "rules, CP-SAT and finance"), ("Manager action", "owner, blocker and route"), ("Turnover", "verified package"),
    ]), p("Core USPs", "subsection"), table(["Capability", "What has been built", "Why it is defensible"], [
        ("Controlled RAG", "Immutable regions, full-text and vector candidates, BGE reranking and cited synthesis.", "Scope is filtered before ranking; unsupported claims are removed."),
        ("Site Analysis", "Sixteen planning stages, evidence-aware defaults, deterministic rules, review and versioned insights.", "Assumptions, confirmations, conflicts and missing decisions stay separate."),
        ("Readiness + Cx", "Requirements and evidence generate context, procedures, blockers, progress and gate decisions.", "Only accepted proof affects deterministic readiness."),
        ("Local Gemma", "Bounded extraction, classification, drafting and manager-facing explanation.", "Model output stays proposed and records provider provenance."),
        ("Economics", "Canonical USD model with INR display, NPV, IRR, payback, sensitivity and key drivers.", "Formula results persist independently of narrative or display currency."),
        ("Supply + routes", "Site-derived plans, approval, shipments, maps, weather and schedule events.", "Live, simulated, fallback and unavailable states are explicit."),
        ("Evidence + compliance", "Field/PDF/image intake, claim links, exact citations, relevance gates and disposition.", "AI cannot certify, self-approve or compare unrelated concepts."),
        ("Digital racks", "Project-derived racks, custom GPUs/components, wiring, revisions and model exports.", "Objects remain tied to project scope and revision."),
    ], [31 * mm, 75 * mm, CONTENT_W - 106 * mm]), PageBreak()]

    story += [p("03 / APPLICATION EXPERIENCE", "kicker"), p("Task-oriented, cited and resilient", "section"), p("The workspace groups navigation as Control, Deliver and Investigate. Deep links preserve the selected gate, task, finding or shipment across feature boundaries. Busy-state and progress behaviour is operation-specific, bounded and visible, so long-running work cannot silently replace another action."), p("Live browser-captured application surfaces", "subsection"), shot("pramana-overview.jpg", "Overview and grouped navigation - one project context and a complete task map."), shot("pramana-cx.jpg", "Governed Cx tests - cited standards, deterministic readings, human review and report approval."), PageBreak(), shot("pramana-shipments.jpg", "Shipment visibility - route/position context, ETA provenance and controlled operational status."), shot("pramana-knowledge.jpg", "Cited knowledge intelligence - project-scoped retrieval and source-grounded answers."), p("End-to-end user journey", "subsection"), table(["Step", "Surface", "Data flow", "Outcome"], [
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
        ("Maps and 3D", "Leaflet, React Leaflet, Turf, searoute-js, OpenStreetMap, Three.js 0.185", "Route geometry, weather-aware logistics and project rack/model rendering."),
        ("Data and exports", "PapaParse 5.6, csv-parse 7, PDFKit 0.19", "Site-input CSV ingestion and controlled PDF/CSV/vendor/model deliverables."),
        ("Identity", "bcryptjs, OTPAuth, optional Clerk Next.js SDK", "Owned credentials/TOTP or external identity adapter with app-owned RBAC."),
    ], [37 * mm, 63 * mm, CONTENT_W - 100 * mm]), p("API group contract", "subsection"), table(["Group", "Representative routes", "Expectation"], [
        ("Identity", "/api/auth/*, /api/profile", "Credentials/Clerk, sessions, TOTP and rate limits."),
        ("Project authority", "/api/projects, /members, /activate, /alerts, /site-analysis", "Membership, planning snapshots, finalization and role enforcement."),
        ("Evidence control", "/sources, /evidence, /requirements, /gates, /turnover-packs", "Versioning, citations, review and readiness."),
        ("Schedule and risk", "/schedule/tasks, /resources, /baseline, /events, /risks, /shipment-plans", "Reviewed input, immutable versions, approval and solver isolation."),
        ("Economics and models", "/financial-model, /rack-model, /technology-drafts", "Versioned scenarios, rack/GPU revisions and controlled vendor packages."),
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
    ]) + [p("Explicit non-claims", "subsection"), callout("Engineering authority remains human.", "Pramana Cx assists engineering judgement. It does not independently certify a facility, replace the commissioning authority or engineer of record, issue Tier/TIA/BICSI/statutory approval, autonomously close findings/waivers or represent simulated operational feeds as live evidence.", True), p("Maintenance references", "subsection"), p("<b>README.md</b> - implementation map, diagrams, defect audit and configuration. <b>STATUS.md</b> - authoritative shipped/open ledger. <b>PLANNER/PRD.md</b> and <b>PLANNER/TRD.md</b> - product scope and technical contracts. <b>PLANNER/Schema.md</b>, <b>AppFlow.md</b>, <b>DesignDecisions.md</b> and <b>RetrievalArchitecture.md</b> - data model, flows, decisions and retrieval safeguards.", "small"), PageBreak()]

    # The following appendices deliberately preserve the complete technical inventory rather
    # than compressing the architecture into an executive summary.
    story += [p("APPENDIX A / COMPLETE COMPONENT ARCHITECTURE", "kicker"), p("Full component and responsibility map", "section"), p("This appendix records the implementation-level architecture omitted by an executive summary. It identifies every major runtime boundary, its state, its caller and the rule that prevents it from becoming an unauthorized decision-maker."), table(["Layer", "Components", "Responsibility", "Hard boundary"], [
        ("Experience", "Next.js server-rendered pages; responsive browser shell; mobile navigation; field-capture PWA; Three.js 404.", "Project workbenches for Overview, Sources, Requirements, Systems, Evidence, Field Capture, Readiness, Schedule, Actions, Cx, Shipments, Compliance, Knowledge, Graph, Command Center, Changes and Turnover.", "UI only requests project-scoped APIs; it does not make authority decisions locally."),
        ("Core API", "Next.js route handlers; Zod contracts; permission middleware; model-provider facade; presentation helpers.", "Authenticates, authorizes, validates, persists domain commands, returns read models and controls provider selection.", "No direct unscoped data access or direct vendor-model bypass."),
        ("Business authority", "Requirements/evidence/gates/findings/decisions; readiness rules; Cx deterministic verdicts; audit chain; typed edges.", "Makes relational state authoritative and invokes deterministic calculations over accepted records.", "LLM output has proposed state only; no AI can mark a gate ready."),
        ("Durable execution", "Redis, BullMQ, durable_jobs, idempotency_records, worker and bounded retry wrappers.", "Handles parse, embed, solve, polling, report and other retryable work with stable job identity.", "Jobs cannot bypass review/permission checks; retries are bounded and observable."),
        ("Ingestion", "PyMuPDF service on 8001; PDF/CSV/XLSX parser; source-region extraction; object-storage boundary.", "Creates page/box/row/cell provenance and structured extraction output from immutable source versions.", "Never becomes a source of business truth without core validation and human review."),
        ("Scheduling", "FastAPI OR-Tools CP-SAT service on 8002; accepted task/resource inputs; delta detector; immutable versions; explainer.", "Solves feasibility/optimization and returns explicit result or bottleneck report; carries completed work as fixed input on warm start.", "Solver is stateless, has no database credentials and never changes a date without a reviewed command."),
        ("Retrieval", "Postgres FTS + pgvector; knowledge_chunks; graph context expansion; retrieval service on 8003; cross-encoder reranker.", "Retrieves project-scoped controlled regions and ranks candidates before cited synthesis.", "Mandatory tenant/project/metadata filters happen before rank; service has no database credentials."),
        ("Operational signals", "Shipments, AIS/weather/congestion, procurement/lead-time/workforce, schedule_events, risks and alerts.", "Persists observations, calculates materiality/deduplication and exposes advisory impact.", "All sources explicitly label live, synthetic or unavailable; no signal directly changes readiness/schedule."),
        ("Object and security", "PostgreSQL, pgvector, local/MinIO/S3 objects, signed URLs, credentials/TOTP or Clerk, rate limits.", "Owns transactional state, immutable artifacts and controlled access.", "Cross-project IDs rejected; audit is append-only/hash-linked; production secrets are external."),
    ], [27 * mm, 45 * mm, 67 * mm, CONTENT_W - 139 * mm]), p("Full agent event contract", "subsection"), table(["Event", "Producer", "Trigger", "Persisted impact"], [
        ("TEST_FAILED", "Cx workflow", "Deterministic numeric/threshold or boolean/presence proposed failure only.", "Finding/NCR proposal and blocked gate flow; narrative observations stay human review."),
        ("shipment_delayed", "Shipment assessment", "Status transition into at-risk/delayed, never a repeated poll state.", "One event per affected task fan-out; delta detector assesses schedule impact."),
        ("shipment_recovered", "Shipment assessment", "Prior delay recovers to on-time.", "Clears stale active alert and may enter the same delta assessment."),
        ("predicted_risk_delay", "Predictive risk poll", "Task + risk-type materiality threshold crosses or changes materially.", "Advisory risk/mitigation event; no direct re-solve or schedule mutation."),
    ], [30 * mm, 37 * mm, 61 * mm, CONTENT_W - 128 * mm]), PageBreak()]

    adr_rows = [
        ("ADR-001", "Local modular monolith", "One typed core for MVP authority; isolated services only for extraction, solve and retrieval."),
        ("ADR-002", "Postgres + Drizzle", "Normalized relational source of truth with migrations and constrained traversal."),
        ("ADR-003", "Object-store bytes", "Immutable originals and exports live behind one local/S3-compatible boundary."),
        ("ADR-004", "Hybrid lexical + semantic retrieval", "Exact FTS plus project-scoped vector candidates and reranking."),
        ("ADR-005", "Durable asynchronous ingestion", "Long work runs through retryable jobs and human checkpoints."),
        ("ADR-006", "Deterministic readiness", "AI can propose; rules and authorized humans decide authority-bearing state."),
        ("ADR-007", "Project-scoped RBAC + strong approval", "Server-side membership with TOTP gate protection."),
        ("ADR-008", "Offline-capable field PWA", "Idempotent local queue supports site capture without authorizing offline decisions."),
        ("ADR-009", "Dedicated CP-SAT service", "Official OR-Tools backend avoids unstable WASM and Node event-loop blocking."),
        ("ADR-010", "ModelProvider for schedule extraction", "Ambiguous extracted tasks/resources require human review."),
        ("ADR-011", "Deterministic solver objective order", "Deadline overrun first, idle time second; never delegated to an LLM."),
        ("ADR-012", "Immutable schedule versions", "No in-place schedule mutation; every solve produces inspectable history."),
        ("ADR-013", "Delta-gated re-solves", "Only critical/downstream impact invokes CP-SAT."),
        ("ADR-014", "Internal agent-service pattern", "Domain services integrate through the same controlled boundary as solver."),
        ("ADR-015", "Pinned event contract", "Event payload/dedup semantics are defined while a general orchestrator remains deferred."),
        ("ADR-016", "Cx proposed verdict + draft report", "Narrative remains human-routed; report must be approved before evidence authority."),
        ("ADR-017", "Leaflet shipment navigator", "Route geometry, click-to-zoom and explicit live/simulated labels."),
        ("ADR-018", "LLM confined to drafting", "Acceptance/shipment classification remain deterministic or human reviewed."),
        ("ADR-019", "Compliance proposed-findings queue", "Modality-tiered flags and clause-vs-line evidence diffs require disposition."),
        ("ADR-020", "Predictive risk as advisory poll", "Dedicated live-events/risk surfaces cross-link critical path but do not reschedule."),
        ("ADR-021", "Scoped knowledge + edges graph", "User-facing cited RAG and graph/timeline reuse project data, no parallel graph authority."),
        ("ADR-022", "Command Center as read/cross-link surface", "Unified deduplicated alerts, recovery clearing and no direct state mutation."),
    ]
    story += [p("APPENDIX B / ARCHITECTURE DECISION RECORDS", "kicker"), p("All committed architecture decisions", "section"), table(["ID", "Decision", "Implementation consequence"], adr_rows, [22 * mm, 55 * mm, CONTENT_W - 77 * mm]), PageBreak()]

    schema_rows = [
        ("Scope and identity", "tenants, users, auth_sessions, projects, project_members", "Tenant/project ownership, membership, sessions and RBAC."),
        ("Object/source control", "storage_objects, documents, document_versions, source_regions", "Immutable objects, revision lineage and exact extraction provenance."),
        ("Facility and authority", "systems, assets, gates, requirements, evidence, findings, decisions", "Controlled requirements, proof, blockers and authorized decisions."),
        ("Graph and audit", "edges, audit_events, durable_jobs, idempotency_records, alerts", "Typed traversal, hash chain, job lifecycle, dedupe and alert state."),
        ("Commissioning", "cx_checklists, cx_checklist_steps, cx_clause_citations, cx_test_records, cx_step_results", "Cited checklist execution, deterministic readings and report evidence."),
        ("Compliance and knowledge", "compliance_precedents, compliance_checks, knowledge_chunks", "Proposed deviations, exact precedents, model-tagged hybrid retrieval units."),
        ("Logistics/turnover", "shipments, turnover_packs", "Asset-linked delivery observations and approved manifest artifacts."),
        ("Scheduling", "schedule_tasks, schedule_resources, schedule_task_resources, schedule_dependencies, schedule_versions, schedule_assignments", "Reviewed DAG/capacity inputs, immutable versions and assignments."),
        ("Risk and learning", "schedule_events, risk_signals, schedule_risks, teachback_notes", "Validated event history, source observations, advisory risks and reviewed teach-back."),
    ]
    story += [p("APPENDIX C / COMPLETE DATABASE INVENTORY", "kicker"), p("Schema domains and real table inventory", "section"), p("The current Drizzle schema defines 45 tables. The following inventory preserves every authoritative domain rather than reducing the database to a generic ER picture."), table(["Domain", "Tables", "Authority and relationship role"], schema_rows, [37 * mm, 78 * mm, CONTENT_W - 115 * mm]), p("Relationship rules", "subsection")] + bullet([
        "Tenant owns projects; project membership authorizes every project-scoped command and read.",
        "Document versions own source regions; source regions ground requirements, evidence, Cx citations, knowledge chunks and compliance comparisons.",
        "Systems contain assets; gates govern requirements; evidence can prove requirements and affect assets; findings block gates.",
        "Edges represent typed relationships such as PROVES, AFFECTS, REQUIRES and PRECEDES, but normalized tables remain business authority.",
        "Schedule versions contain assignments; tasks have dependencies/resources and are observed by risk signals/events without folding advisory risk into readiness.",
        "Business-key uniqueness, exact-row reconciliation and relational integrity checks protect merged/seeded data from duplicate identity corruption.",
    ]) + [PageBreak()]

    story += [p("APPENDIX D / COMPLETE API ENDPOINT CATALOG", "kicker"), p("All route-handler surfaces", "section"), p("The following catalog is generated from the current <font name='Courier'>src/app/api/**/route.ts</font> tree at PDF-build time. Dynamic route segments remain visible so contract owners can identify the entity scope."), table(["Group", "Endpoint"], endpoint_inventory(), [40 * mm, CONTENT_W - 40 * mm]), PageBreak()]

    env_rows = env_inventory()
    story += [p("APPENDIX E / ENVIRONMENT AND CONFIGURATION INVENTORY", "kicker"), p("Every example configuration key", "section"), p("The environment appendix is generated from the current <font name='Courier'>.env.example</font> file at PDF-build time. Values shown are examples only; production values must be secret-managed and individually validated."), table(["Key", "Group", "Example/default"], env_rows, [62 * mm, 32 * mm, CONTENT_W - 94 * mm]), PageBreak()]

    verify_rows = verification_inventory()
    story += [p("APPENDIX F / VERIFICATION COMMAND INVENTORY", "kicker"), p("Every verification script currently declared", "section"), p("The complete test command catalog below is generated from <font name='Courier'>package.json</font>. It makes the release matrix auditable and prevents a single green build from being mistaken for end-to-end verification."), table(["Command", "Runner"], verify_rows, [73 * mm, CONTENT_W - 73 * mm]), PageBreak()]

    defect_rows = [
        ("01", "Mock output could look like a real LLM.", "Explicit real provider configuration, Ollama default, production mock rejection and provenance."),
        ("02", "AI paths bypassed provider architecture.", "Shared schema-validated provider boundary across generation, vision, compliance, risk and knowledge."),
        ("03", "Generation and embeddings could select contradictory providers.", "Independent explicit provider configuration plus embedding-model tagging and mismatch exclusion."),
        ("04", "Long model work could freeze the frontend.", "Prompt/context/token limits, server deadline, client abort, progress and bounded retry."),
        ("05", "Deep links opened a generic page.", "Query-ID consumption/validation and focused destination record state."),
        ("06", "Duplicate React keys could omit or duplicate cards.", "Authoritative-id dedupe and composite stable UI keys."),
        ("07", "Duplicate systems/gates/edges/chunks/alerts were possible.", "Business-key constraints, seed reconciliation and integrity verifier."),
        ("08", "Two branch migration sequences conflicted.", "Final schema reconciliation, ordered migration history and replay validation."),
        ("09", "Processed PDFs could be absent from RAG.", "Extraction-to-indexing contract and historical semantic-chunk backfill."),
        ("10", "RAG could attribute another standard to named document.", "Document selection, exact title routing and SQL filtering before ranking."),
        ("11", "LLM planner could narrow authority scope incorrectly.", "Only explicit filters/deterministic title resolution may narrow metadata."),
        ("12", "Fallback text could masquerade as grounded synthesis.", "Structured cited synthesis or explicit no-results; unsupported claims dropped."),
        ("13", "Cx could mix cross-scope gate/system/asset.", "Project/system relationship validation and 422 rejection."),
        ("14", "Raw hashes/JSON/placeholder characters leaked into UI.", "Presentation helpers, labels, bounded precision and contextual provenance links."),
        ("15", "Long operations had inconsistent feedback.", "Per-operation busy state, status messages and disabled conflicting controls."),
        ("16", "UI navigation was crowded and weakly structured.", "Task-oriented groups, responsive navigation and contextual actions."),
        ("17", "Shipment map could lack route/position context.", "Saved-coordinate routes, markers, fit bounds and explicit no-coordinate state."),
        ("18", "Land-routing fallback could mislead.", "HTTPS/deadline routing, mode-aware provenance and safe fallback labels."),
        ("19", "Synthetic signals could look operational.", "Live/synthetic/unavailable provenance and fail-closed client behaviour."),
        ("20", "No trustworthy release gate existed.", "Full verification matrix, audit/dependency checks and explicit production prerequisites."),
    ]
    story += [p("APPENDIX G / FULL TOP-20 DEFECT AND RESOLUTION LEDGER", "kicker"), p("Complete merged-branch remediation record", "section"), table(["#", "Defect", "Resolution"], defect_rows, [10 * mm, 65 * mm, CONTENT_W - 75 * mm]), p("Source of truth", "subsection"), p("The complete narrative, original branch attribution and verification references remain in README.md under 'Top 20 defects found across Refinement and Updated-Refinement'. This appendix preserves every remedial category in the printable architecture reference."), PageBreak()]

    story += [p("APPENDIX H / FEATURE AND USER-STORY COVERAGE", "kicker"), p("Full planned-to-implemented product map", "section"), table(["Stories", "Capability group", "Controlled outcome"], [
        ("US-01 to US-08", "Project access, source ingestion, requirement review, readiness, actions, change impact, decisions and turnover", "A project-scoped evidence trail from controlled source to approved, verifiable pack."),
        ("US-09 to US-12", "Baseline schedule, event-triggered rescheduling, explanation and gate schedule context", "Accepted task/resource inputs lead to immutable CP-SAT versions and cross-linked context, not automatic readiness changes."),
        ("US-13 to US-18", "Standards checklist, IST execution, deterministic checks, failures, reports and evidence linkage", "Cited Cx workflow keeps numerical/boolean verdicts deterministic and narrative judgement human-routed."),
        ("US-19 to US-23", "Shipment tracking, weather ETA, risk status, map navigator and schedule events", "Asset-linked visibility with explicit provenance and delta-gated schedule influence."),
        ("US-24 to US-25", "Specification compliance and approved-equal grounding", "Proposed deviations are exact-citation grounded and require human disposition."),
        ("US-26 to US-27", "Predictive risk and live-event surfaces", "Advisory material risks cross-link critical path but never autonomously alter a plan."),
        ("US-28 to US-31", "Knowledge query, similar RFI, project graph/timeline and unified Command Center", "Project-scoped cited intelligence, typed graph navigation and deduplicated operational alerts."),
    ], [32 * mm, 62 * mm, CONTENT_W - 94 * mm]), p("Explicit product boundaries", "subsection")] + bullet([
        "No general cross-project chatbot, autonomous commissioning authority, independent certification, auto-closure of NCRs/waivers/tests or AI-issued gate state.",
        "No hidden substitution of synthetic AIS/weather/model output for verified live operations.",
        "No unlicensed standards/client/vendor content in reusable demos, prompts, embeddings or training material.",
        "No second authoritative graph/vector store: Postgres/pgvector/edges remain authority; service-local working state cannot override it.",
    ])
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
