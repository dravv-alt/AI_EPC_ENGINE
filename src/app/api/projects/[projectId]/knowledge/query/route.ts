import { NextResponse } from "next/server";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";
import { semanticSearch } from "@/lib/knowledge/query";
import { generateSynthesis } from "@/lib/knowledge/generate";

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const { query, documentType } = await request.json().catch(() => ({}));
  
  if (typeof query !== "string" || query.trim().length < 3) {
    return NextResponse.json({ error: "A query of at least three characters is required." }, { status: 400 });
  }

  try {
    await requireProjectPermission(projectId, "audit:view");
    
    // Get relevant chunks using semantic search
    const claims = await semanticSearch({ 
      projectId, 
      query, 
      limit: 8, 
      documentType 
    });
    
    // Generate Gemini synthesis or fallback to concatenation
    let answer = null;
    if (claims.length > 0) {
      answer = await generateSynthesis(query, claims);
    }
    
    return NextResponse.json({ 
      answer, 
      claims, 
      noResults: claims.length === 0, 
      scopedTo: { projectId, documentType: documentType ?? "all" } 
    });
  } catch (error) { 
    console.error("Knowledge query error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to query controlled knowledge" }, 
      { status: error instanceof AccessError ? error.status : 500 }
    );
  }
}
