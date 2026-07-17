import { NextResponse } from "next/server";
import { verifyAuditChain } from "@/lib/audit/verify-chain";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";

export async function GET(_: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  try {
    await requireProjectPermission(projectId, "audit:view");
    const verification = await verifyAuditChain(projectId);
    return NextResponse.json({ verification }, { status: verification.valid ? 200 : 409 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to verify audit chain." }, { status: error instanceof AccessError ? error.status : 500 });
  }
}
