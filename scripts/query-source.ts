import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

function argument(name: string, fallback?: string) {
  const index = process.argv.indexOf(`--${name}`);
  const value = index >= 0 ? process.argv[index + 1] : fallback;
  if (!value) throw new Error(`Missing --${name}.`);
  return value;
}

function repeatedArguments(name: string) {
  return process.argv.flatMap((value, index) => value === `--${name}` && process.argv[index + 1] ? [process.argv[index + 1]!] : []);
}

const defaultQueries = [
  "What are the core components and functions of a data center network architecture?",
  "How should redundancy and high availability be designed in a data center?",
  "What power distribution and cooling considerations are described for data centers?",
  "How do Fibre Channel and storage area networks operate in a data center?",
  "What is the prescribed FM-200 agent concentration?"
];

async function main() {
  const projectCode = argument("project", "MDC-07");
  const documentTitle = argument("document");
  const queries = repeatedArguments("query");
  const synthesize = process.argv.includes("--synthesize");
  const [{ eq, inArray }, { db }, { documents, projects, sourceRegions }, { retrieveSemanticCitations }, { getModelProvider, activeEmbeddingModelTag }] = await Promise.all([
    import("drizzle-orm"),
    import("../src/lib/db/client"),
    import("../src/lib/db/schema"),
    import("../src/lib/knowledge/query"),
    import("../src/lib/model/provider")
  ]);

  const [document] = await db
    .select({ id: documents.id, title: documents.title, projectId: projects.id })
    .from(documents)
    .innerJoin(projects, eq(documents.projectId, projects.id))
    .where(eq(documents.title, documentTitle))
    .limit(1);
  if (!document || document.projectId === null) throw new Error(`Controlled document "${documentTitle}" was not found.`);
  const [project] = await db.select({ id: projects.id }).from(projects).where(eq(projects.code, projectCode)).limit(1);
  if (!project || project.id !== document.projectId) throw new Error(`Document does not belong to project ${projectCode}.`);

  const activeQueries = queries.length ? queries : defaultQueries;
  const diagnosticVector = await getModelProvider().embed(activeQueries[0]!);
  const results = [];
  for (const query of activeQueries) {
    const citations = await retrieveSemanticCitations({
      projectId: project.id,
      documentId: document.id,
      query,
      limit: 5
    });
    const regionIds = citations.map((citation) => citation.sourceRegionId);
    const pages = regionIds.length
      ? await db.select({ id: sourceRegions.id, page: sourceRegions.pageNumber }).from(sourceRegions).where(inArray(sourceRegions.id, regionIds))
      : [];
    const pageById = new Map(pages.map((page) => [page.id, page.page]));
    results.push({
      query,
      matches: citations.map((citation) => ({
        similarity: Number(citation.similarity.toFixed(4)),
        page: pageById.get(citation.sourceRegionId) ?? null,
        sourceRegionId: citation.sourceRegionId,
        excerpt: citation.text.replace(/\s+/g, " ").trim().slice(0, 320)
      }))
    });
  }

  const synthesis = synthesize
    ? await import("../src/lib/knowledge/pipeline").then(({ answerKnowledgeQuery }) =>
      answerKnowledgeQuery({
        projectId: project.id,
        documentId: document.id,
        query: activeQueries[0]!
      }))
    : null;

  const output = JSON.stringify({
    documentId: document.id,
    documentTitle: document.title,
    embeddingModel: activeEmbeddingModelTag(),
    vectorDimensions: diagnosticVector.length,
    vectorFirstFive: diagnosticVector.slice(0, 5),
    synthesis: synthesis ? {
      query: activeQueries[0],
      answer: synthesis.answer,
      noResults: synthesis.noResults,
      claimCount: synthesis.claims.length,
      droppedClaimCount: synthesis.droppedClaimCount,
      planProvider: synthesis.planProvider,
      planModel: synthesis.planModel,
      synthesisProvider: synthesis.synthesisProvider,
      synthesisModel: synthesis.synthesisModel,
      citations: synthesis.claims.map((claim) => ({
        similarity: Number(claim.similarity.toFixed(4)),
        sourceRegionId: claim.sourceRegionId,
        text: claim.text
      }))
    } : null,
    results
  }, null, 2);
  await new Promise<void>((resolve, reject) => {
    process.stdout.write(`${output}\n`, (error) => error ? reject(error) : resolve());
  });
  process.exit(0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
