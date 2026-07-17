import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { turnoverPacks } from "@/lib/db/schema";
import { requireProjectPermission } from "@/lib/projects/access";
import { objectStorage } from "@/lib/storage/service";
import { canonicalJson } from "@/lib/crypto/canonical-json";
export async function GET(_: Request, { params }: { params: Promise<{ packId: string }> }) { const { packId } = await params; const pack = await db.query.turnoverPacks.findFirst({ where: eq(turnoverPacks.id, packId) }); if (!pack) return NextResponse.json({ error: "Turnover pack not found." }, { status: 404 }); try { await requireProjectPermission(pack.projectId, "audit:view"); const bytes = await objectStorage.read(pack.objectKey); const objectHash = createHash("sha256").update(bytes).digest("hex"); const manifestHash = createHash("sha256").update(canonicalJson(pack.manifest)).digest("hex"); return NextResponse.json({ verified: objectHash === pack.manifestHash && manifestHash === pack.manifestHash, expectedHash: pack.manifestHash, objectHash, manifestHash }); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to verify pack." }, { status: 500 }); } }
