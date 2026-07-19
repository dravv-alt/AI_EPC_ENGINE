import { env } from "@/lib/env";

const MODEL = "gemini-2.5-flash";

export async function generateSynthesis(query: string, claims: Array<{ text: string, pageNumber: string }>): Promise<string | null> {
  if (!env.GEMINI_API_KEY) {
    return claims.map((claim) => claim.text).join("\n\n");
  }

  const context = claims.map((c, i) => `[Source ${i + 1}, Page ${c.pageNumber}]:\n${c.text}`).join("\n\n---\n\n");

  const prompt = `You are an AI assistant answering questions based strictly on the provided context.
If the context does not contain the answer, say "I cannot answer this based on the provided documents."
Do not use outside knowledge. Cite your sources using [Source X] notation where appropriate.

CONTEXT:
${context}

QUESTION:
${query}

ANSWER:`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 500,
          }
        }),
        signal: AbortSignal.timeout(25_000),
      }
    );

    if (!response.ok) {
      console.error(`Gemini API returned HTTP ${response.status}`);
      return claims.map((claim) => claim.text).join("\n\n");
    }

    const body = await response.json();
    return body.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch (err) {
    console.error("Failed to generate synthesis:", err);
    return claims.map((claim) => claim.text).join("\n\n");
  }
}
