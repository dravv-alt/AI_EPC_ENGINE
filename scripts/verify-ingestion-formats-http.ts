import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { eq, inArray } from "drizzle-orm";
import { db } from "../src/lib/db/client";
import { documentVersions, documents, durableJobs, knowledgeChunks, requirements, sourceRegions, storageObjects } from "../src/lib/db/schema";
import { developmentProjectId } from "../src/lib/demo";
import { objectStorage } from "../src/lib/storage/service";

function pdfWithPages(texts: string[]) {
  const objects = new Map<number, string>();
  const pageIds = texts.map((_, index) => 3 + index * 2);
  const fontId = 3 + texts.length * 2;
  objects.set(1, "<< /Type /Catalog /Pages 2 0 R >>");
  objects.set(2, `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${texts.length} >>`);
  texts.forEach((text, index) => {
    const pageId = pageIds[index]; const contentId = pageId + 1; const escaped = text.replace(/([\\()])/g, "\\$1"); const stream = `BT /F1 12 Tf 72 720 Td (${escaped}) Tj ET`;
    objects.set(pageId, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    objects.set(contentId, `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
  });
  objects.set(fontId, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  let pdf = "%PDF-1.4\n"; const offsets = [0];
  for (let id = 1; id <= fontId; id += 1) { offsets[id] = Buffer.byteLength(pdf); pdf += `${id} 0 obj\n${objects.get(id)}\nendobj\n`; }
  const xref = Buffer.byteLength(pdf); pdf += `xref\n0 ${fontId + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n `).join("\n")}\ntrailer\n<< /Size ${fontId + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf);
}

async function request(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const body = await response.json();
  return { status: response.status, body };
}

async function requestOk(url: string, init?: RequestInit) {
  const { status, body } = await request(url, init);
  if (status < 200 || status >= 300) throw new Error(`${init?.method ?? "GET"} ${url} returned ${status}: ${JSON.stringify(body)}`);
  return body;
}

async function poll(base: string, jobId: string) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const body = await requestOk(`${base}/api/jobs/${jobId}`);
    if (body.job.status === "completed") return body.job;
    if (body.job.status === "failed") throw new Error(`Job ${jobId} failed: ${body.job.error}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Job ${jobId} timed out.`);
}

async function uploadAndExtract(base: string, opts: { title: string; revision: string; fileName: string; mediaType: string; bytes: Buffer }) {
  const form = new FormData();
  form.set("title", opts.title);
  form.set("revision", opts.revision);
  form.set("documentType", "procedure");
  form.set("file", new Blob([opts.bytes], { type: opts.mediaType }), opts.fileName);
  const created = await requestOk(`${base}/api/projects/${developmentProjectId}/sources`, { method: "POST", body: form });
  if (created.extractionStatus === "processing") await poll(base, created.jobId);
  return created as { document: { id: string }; version: { id: string; objectKey: string } };
}

type Teardown = { objectKeys: string[]; versionIds: string[]; documentIds: string[]; jobIds: string[] };

async function cleanupOne(teardown: Teardown, created: { document: { id: string }; version: { id: string; objectKey: string } }, jobId?: string) {
  teardown.objectKeys.push(created.version.objectKey);
  teardown.versionIds.push(created.version.id);
  teardown.documentIds.push(created.document.id);
  if (jobId) teardown.jobIds.push(jobId);
}

async function main() {
  const base = process.env.INGESTION_FORMATS_TEST_URL ?? "http://localhost:4173";
  const teardown: Teardown = { objectKeys: [], versionIds: [], documentIds: [], jobIds: [] };
  try {
    // --- CSV ---
    const csvText = ["Clause,Requirement,Value", "1.1,Design flow shall be at least,100 L/s", "1.2,Standby interlock shall be present,yes", "1.3,Vibration shall not exceed,4.5 mm/s"].join("\n");
    const csvBytes = Buffer.from(csvText, "utf-8");
    const csvResult = await uploadAndExtract(base, { title: "Synthetic CSV source", revision: "Rev A", fileName: "requirements.csv", mediaType: "text/csv", bytes: csvBytes });
    await cleanupOne(teardown, csvResult, csvResult && (csvResult as unknown as { jobId?: string }).jobId);
    const csvRegions = await db.select().from(sourceRegions).where(eq(sourceRegions.documentVersionId, csvResult.version.id));
    assert.equal(csvRegions.length, 3, `expected 3 CSV data-row regions (header excluded), got ${csvRegions.length}`);
    assert.ok(csvRegions.every((region) => region.bbox === null), "CSV regions must have null bbox");
    assert.ok(csvRegions.some((region) => region.extractedText.includes("Design flow shall be at least") && region.extractedText.includes("Clause") && region.extractedText.includes("1.1")), `CSV region text should be a readable field-labeled rendering, got: ${csvRegions.map((r) => r.extractedText).join(" | ")}`);
    assert.ok(csvRegions.every((region) => /^[0-9a-f]{64}$/.test(region.contentHash)), "CSV regions must have a sha256 content hash");
    const csvPageNumbers = csvRegions.map((region) => Number(region.pageNumber)).sort((a, b) => a - b);
    assert.deepEqual(csvPageNumbers, [1, 2, 3], "CSV page_number should be the 1-indexed data row number");

    // --- XLSX ---
    const xlsxBytes = readFileSync(path.join(process.cwd(), "scripts/fixtures/sample-source.xlsx"));
    const xlsxResult = await uploadAndExtract(base, { title: "Synthetic XLSX source", revision: "Rev A", fileName: "requirements.xlsx", mediaType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", bytes: xlsxBytes });
    await cleanupOne(teardown, xlsxResult, (xlsxResult as unknown as { jobId?: string }).jobId);
    const xlsxRegions = await db.select().from(sourceRegions).where(eq(sourceRegions.documentVersionId, xlsxResult.version.id));
    assert.equal(xlsxRegions.length, 3, `expected 3 XLSX data-row regions (header excluded), got ${xlsxRegions.length}`);
    assert.ok(xlsxRegions.every((region) => region.bbox === null), "XLSX regions must have null bbox");
    assert.ok(xlsxRegions.some((region) => region.extractedText.includes("Standby interlock shall be present")), `XLSX region text should be readable, got: ${xlsxRegions.map((r) => r.extractedText).join(" | ")}`);
    assert.ok(xlsxRegions.every((region) => /^[0-9a-f]{64}$/.test(region.contentHash)), "XLSX regions must have a sha256 content hash");

    // --- PDF regression (unchanged path) ---
    const pdfBytes = pdfWithPages(["Clause 2.1 Existing PDF ingestion must remain unaffected."]);
    const pdfResult = await uploadAndExtract(base, { title: "Synthetic PDF regression source", revision: "Rev A", fileName: "regression.pdf", mediaType: "application/pdf", bytes: pdfBytes });
    await cleanupOne(teardown, pdfResult, (pdfResult as unknown as { jobId?: string }).jobId);
    const pdfRegions = await db.select().from(sourceRegions).where(eq(sourceRegions.documentVersionId, pdfResult.version.id));
    assert.equal(pdfRegions.length, 1, "PDF ingestion should still work exactly as before");
    assert.ok(pdfRegions[0].bbox !== null, "PDF regions must still carry a bbox");

    // --- Rejection: unsupported format ---
    const txtForm = new FormData();
    txtForm.set("title", "Unsupported format attempt");
    txtForm.set("revision", "Rev A");
    txtForm.set("documentType", "procedure");
    txtForm.set("file", new Blob([Buffer.from("plain text, not a supported format")], { type: "text/plain" }), "notes.txt");
    const rejected = await request(`${base}/api/projects/${developmentProjectId}/sources`, { method: "POST", body: txtForm });
    assert.ok(rejected.status === 415 || rejected.status === 400, `expected unsupported format to be rejected with 415/400, got ${rejected.status}: ${JSON.stringify(rejected.body)}`);

    // --- Rejection: corrupted CSV masquerading as xlsx (bad magic bytes for the claimed type) ---
    const fakeXlsxForm = new FormData();
    fakeXlsxForm.set("title", "Corrupted XLSX attempt");
    fakeXlsxForm.set("revision", "Rev A");
    fakeXlsxForm.set("documentType", "procedure");
    fakeXlsxForm.set("file", new Blob([Buffer.from("this is not a real zip/xlsx file")], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "fake.xlsx");
    const rejectedXlsx = await request(`${base}/api/projects/${developmentProjectId}/sources`, { method: "POST", body: fakeXlsxForm });
    assert.ok(rejectedXlsx.status === 415 || rejectedXlsx.status === 400 || rejectedXlsx.status === 502, `expected corrupted XLSX to be rejected, got ${rejectedXlsx.status}: ${JSON.stringify(rejectedXlsx.body)}`);
    if (rejectedXlsx.status === 502 && rejectedXlsx.body?.documentVersionId) {
      teardown.versionIds.push(rejectedXlsx.body.documentVersionId);
    }

    console.log("Ingestion multi-format verification passed: CSV row-per-region extraction, XLSX row-per-region extraction, unchanged PDF extraction, and rejection of unsupported/corrupted uploads.");
  } finally {
    if (teardown.versionIds.length) {
      const regions = await db.select({ id: sourceRegions.id }).from(sourceRegions).where(inArray(sourceRegions.documentVersionId, teardown.versionIds));
      const regionIds = regions.map((region) => region.id);
      if (regionIds.length) {
        // The periodic knowledge.embed poll job and proposeDocumentRecords may have
        // already attached downstream rows to these source regions; clear those first
        // so the FK-constrained sourceRegions/documentVersions deletes below succeed.
        await db.delete(requirements).where(inArray(requirements.sourceRegionId, regionIds));
        await db.delete(knowledgeChunks).where(inArray(knowledgeChunks.sourceRegionId, regionIds));
      }
    }
    if (teardown.versionIds.length) await db.delete(sourceRegions).where(inArray(sourceRegions.documentVersionId, teardown.versionIds));
    if (teardown.versionIds.length) await db.delete(documentVersions).where(inArray(documentVersions.id, teardown.versionIds));
    if (teardown.documentIds.length) await db.delete(documents).where(inArray(documents.id, teardown.documentIds));
    const storedRows = teardown.objectKeys.length ? await db.select().from(storageObjects).where(inArray(storageObjects.objectKey, teardown.objectKeys)) : [];
    if (storedRows.length) await db.delete(storageObjects).where(inArray(storageObjects.id, storedRows.map((row) => row.id)));
    for (const key of [...new Set(teardown.objectKeys)]) await objectStorage.remove(key).catch(() => undefined);
    if (teardown.jobIds.length) await db.delete(durableJobs).where(inArray(durableJobs.id, [...new Set(teardown.jobIds)]));
  }
}

main().then(() => process.exit(0)).catch((error) => { console.error(error); process.exit(1); });
