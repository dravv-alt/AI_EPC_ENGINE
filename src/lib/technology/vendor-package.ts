import PDFDocument from "pdfkit";

export type VendorDetails = {
  vendorName: string;
  productName: string;
  modelFamily?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  vendorAddress?: string;
  manufacturer?: string;
  purchaserSignatoryName?: string;
  purchaserSignatoryTitle?: string;
  vendorSignatoryName?: string;
  vendorSignatoryTitle?: string;
};

export type ProcurementDetails = {
  referenceNumber: string;
  issueDate: string;
  responseDueDate?: string;
  deliveryLocation?: string;
  requiredDeliveryDate?: string;
  quantityBasis?: string;
  quotationValidityDays?: number;
  currency?: string;
  incoterms?: string;
  paymentTerms?: string;
  warrantyRequirements?: string;
  supportRequirements?: string;
  installationCommissioningScope?: string;
  evaluationCriteria?: string;
  specialTerms?: string;
};

export type VendorPackageContext = {
  project: { name: string; code: string; timezone: string };
  siteAnalysis: Array<{ section: string; label: string; value: string }>;
  systems: Array<{ name: string; type: string; assets: string[] }>;
};

export type VendorPackageInput = {
  category: string;
  solutionName: string;
  summary: string;
  evidenceChecklist: string[];
  commercialChecklist: string[];
  claims: Array<{ type: string; text: string; evidenceRequired: string }>;
  parameters: Array<{ key: string; label: string; unit: string; sourceHint: string }>;
  vendor: VendorDetails;
  procurement: ProcurementDetails;
  context: VendorPackageContext;
  draftMessage: string;
};

export function vendorPackageSearchText(input: VendorPackageInput) {
  const site = input.context.siteAnalysis.map((item) => `${item.section} — ${item.label}: ${item.value}`);
  const systems = input.context.systems.map((item) => `${item.name} (${item.type}); assets: ${item.assets.join(", ") || "none registered"}`);
  return [
    `Vendor request package ${input.procurement.referenceNumber}`,
    `Project: ${input.context.project.name} (${input.context.project.code})`,
    `Vendor: ${input.vendor.vendorName || "Open vendor"}`,
    `Product: ${input.vendor.productName}${input.vendor.modelFamily ? ` — ${input.vendor.modelFamily}` : ""}`,
    `Category: ${input.category}`,
    `Requested solution: ${input.solutionName}`,
    input.summary,
    input.draftMessage,
    "Site Analysis and system basis:",
    ...site,
    ...systems,
    "Required technical evidence:",
    ...input.evidenceChecklist,
    "Required commercial response:",
    ...input.commercialChecklist,
    "Claims requiring evidence:",
    ...input.claims.map((claim) => `${claim.type}: ${claim.text}; evidence: ${claim.evidenceRequired}`),
    "Parameters requiring vendor response:",
    ...input.parameters.map((parameter) => `${parameter.label} [${parameter.key}] (${parameter.unit}); source: ${parameter.sourceHint}`),
  ].join("\n");
}

function safeImage(doc: PDFKit.PDFDocument, bytes: Buffer | undefined, x: number, y: number, fit: [number, number]) {
  if (!bytes?.length) return false;
  try { doc.image(bytes, x, y, { fit }); return true; } catch { return false; }
}

function pdfText(value: unknown) {
  return String(value ?? "")
    .replace(/\u00b0C/g, "deg C")
    .replace(/\u00b0F/g, "deg F")
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2212]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u2022/g, " | ")
    .replace(/\u00b7/g, "*")
    .replace(/\u2192/g, "->")
    .replace(/\u00b0/g, " deg")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function createVendorPackagePdf(input: VendorPackageInput, media: { letterhead?: Buffer; purchaserSignature?: Buffer; vendorSignature?: Buffer }) {
  const doc = new PDFDocument({ size: "A4", margin: 0, bufferPages: true, info: { Title: pdfText(`${input.procurement.referenceNumber} - ${input.solutionName}`), Author: pdfText(input.context.project.name), Subject: "Vendor technical and commercial information request" } });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));
  const ink = "#17201c", muted = "#5f6d66", green = "#236a4d", pale = "#edf5f0", soft = "#f8faf8", line = "#d6dfd9", warning = "#fff5de";
  const pageWidth = 595.28, pageHeight = 841.89, left = 46, right = 46, top = 48, contentBottom = 780, usable = pageWidth - left - right;
  let cursorY = top;

  const drawContinuationHeader = () => {
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor(green).text(pdfText(input.procurement.referenceNumber), left, 25, { width: 150, lineBreak: false });
    doc.font("Helvetica").fillColor(muted).text(pdfText(input.solutionName), left + 160, 25, { width: usable - 160, align: "right", lineBreak: false });
    doc.moveTo(left, 39).lineTo(pageWidth - right, 39).strokeColor(line).lineWidth(0.6).stroke();
  };
  const addContentPage = () => {
    doc.addPage({ size: "A4", margin: 0 });
    cursorY = top;
    drawContinuationHeader();
  };
  const ensure = (height: number) => { if (cursorY + height > contentBottom) addContentPage(); };
  const textHeight = (text: unknown, width: number, font = "Helvetica", size = 9, lineGap = 2) => {
    doc.font(font).fontSize(size);
    return doc.heightOfString(pdfText(text), { width, lineGap });
  };
  const paragraph = (text: unknown, options: { font?: string; size?: number; color?: string; width?: number; lineGap?: number; gapAfter?: number; indent?: number } = {}) => {
    const font = options.font ?? "Helvetica", size = options.size ?? 9, color = options.color ?? ink, width = options.width ?? usable, lineGap = options.lineGap ?? 2, indent = options.indent ?? 0;
    const content = pdfText(text);
    const height = Math.max(size + 2, textHeight(content, width - indent, font, size, lineGap));
    ensure(height + (options.gapAfter ?? 7));
    doc.font(font).fontSize(size).fillColor(color).text(content, left + indent, cursorY, { width: width - indent, lineGap });
    cursorY += height + (options.gapAfter ?? 7);
  };
  const title = (text: string) => {
    const content = pdfText(text);
    const headingHeight = textHeight(content, usable, "Helvetica-Bold", 14, 1);
    ensure(headingHeight + 24);
    cursorY += 8;
    doc.font("Helvetica-Bold").fontSize(14).fillColor(ink).text(content, left, cursorY, { width: usable, lineGap: 1 });
    cursorY += headingHeight + 6;
    doc.moveTo(left, cursorY).lineTo(pageWidth - right, cursorY).strokeColor(green).lineWidth(0.8).stroke();
    cursorY += 9;
  };
  const field = (label: string, value?: string | number) => {
    const labelText = pdfText(label).toUpperCase();
    const valueText = pdfText(value) || "Vendor to complete";
    const labelWidth = 166, valueWidth = usable - labelWidth - 18;
    const rowHeight = Math.max(textHeight(labelText, labelWidth, "Helvetica-Bold", 7.5, 1), textHeight(valueText, valueWidth, "Helvetica", 8.5, 1.5)) + 12;
    ensure(rowHeight);
    if (Math.round(cursorY / rowHeight) % 2 === 0) doc.rect(left, cursorY, usable, rowHeight).fill(soft);
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor(muted).text(labelText, left + 7, cursorY + 6, { width: labelWidth, lineGap: 1 });
    doc.font("Helvetica").fontSize(8.5).fillColor(ink).text(valueText, left + labelWidth + 12, cursorY + 6, { width: valueWidth, lineGap: 1.5 });
    doc.moveTo(left, cursorY + rowHeight).lineTo(pageWidth - right, cursorY + rowHeight).strokeColor(line).lineWidth(0.35).stroke();
    cursorY += rowHeight;
  };
  const checklist = (items: string[]) => items.forEach((item) => {
    const content = pdfText(item);
    const rowHeight = Math.max(14, textHeight(content, usable - 30, "Helvetica", 9, 1.5) + 5);
    ensure(rowHeight);
    doc.rect(left + 3, cursorY + 3, 9, 9).strokeColor(green).lineWidth(0.8).stroke();
    doc.font("Helvetica").fontSize(9).fillColor(ink).text(content, left + 20, cursorY + 1, { width: usable - 24, lineGap: 1.5 });
    cursorY += rowHeight;
  });
  const responseRow = (label: string, unit: string, source: string) => {
    const labelText = pdfText(label), unitText = `Requested unit: ${pdfText(unit)}`, sourceText = `Evidence/source: ${pdfText(source)}`;
    const rowHeight = Math.max(50, textHeight(labelText, 155, "Helvetica-Bold", 8.5, 1) + textHeight(sourceText, usable - 20, "Helvetica", 7.5, 1.5) + 23);
    ensure(rowHeight + 6);
    const y = cursorY;
    doc.rect(left, y, usable, rowHeight).fillAndStroke(soft, line);
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor(ink).text(labelText, left + 9, y + 8, { width: 155, lineGap: 1 });
    doc.font("Helvetica").fontSize(8).fillColor(muted).text(unitText, left + 174, y + 8, { width: 115 });
    doc.fillColor(ink).text("Vendor value: __________________", left + 300, y + 8, { width: usable - 309 });
    doc.fontSize(7.5).fillColor(muted).text(sourceText, left + 9, y + 28, { width: usable - 18, lineGap: 1.5 });
    cursorY += rowHeight + 6;
  };

  doc.rect(0, 0, pageWidth, 7).fill(green);
  safeImage(doc, media.letterhead, left, 24, [220, 48]);
  doc.font("Helvetica-Bold").fontSize(8).fillColor(green).text("VENDOR TECHNICAL & COMMERCIAL INFORMATION REQUEST", left, 84, { width: usable, lineBreak: false });
  doc.fontSize(22).fillColor(ink).text(pdfText(input.solutionName), left, 103, { width: usable, lineGap: 1 });
  doc.font("Helvetica").fontSize(9.5).fillColor(muted).text(pdfText(`${input.context.project.name} | ${input.procurement.referenceNumber} | Issued ${input.procurement.issueDate} | Draft for vendor response`), left, 137, { width: usable, lineBreak: false });
  doc.rect(left, 162, usable, 72).fill(pale);
  doc.fillColor(ink).font("Helvetica-Bold").fontSize(9).text("PURCHASER", 58, 175).font("Helvetica").text(input.context.project.name, 58, 191, { width: 220 });
  doc.font("Helvetica-Bold").text("REQUESTED VENDOR", 300, 175).font("Helvetica").text(pdfText(input.vendor.vendorName) || "Open - vendor to complete", 300, 191, { width: 230 });
  doc.font("Helvetica-Bold").text("RESPONSE DUE", 58, 211).font("Helvetica").text(input.procurement.responseDueDate || "To be confirmed", 145, 211);
  doc.font("Helvetica-Bold").text("DELIVERY", 300, 211).font("Helvetica").text(input.procurement.requiredDeliveryDate || "Vendor to propose", 366, 211);
  cursorY = 250;

  title("1. Purpose and requested response");
  paragraph(input.draftMessage, { size: 9.5, lineGap: 3, gapAfter: 9 });
  const notice = "Important: This package is a request for information or quotation. It is not a purchase order, design approval, or notice to proceed.";
  const noticeHeight = textHeight(notice, usable - 20, "Helvetica-Bold", 8.5, 2) + 18;
  ensure(noticeHeight);
  doc.roundedRect(left, cursorY, usable, noticeHeight, 4).fill(warning);
  doc.font("Helvetica-Bold").fontSize(8.5).fillColor(ink).text(notice, left + 10, cursorY + 8, { width: usable - 20, lineGap: 2 });
  cursorY += noticeHeight + 2;

  title("2. Vendor and product identification");
  field("Vendor legal name", input.vendor.vendorName);
  field("Manufacturer", input.vendor.manufacturer);
  field("Product / solution", input.vendor.productName);
  field("Model family / exact reference", input.vendor.modelFamily);
  field("Vendor contact", [input.vendor.contactName, input.vendor.contactEmail, input.vendor.contactPhone].filter(Boolean).join(" | "));
  field("Vendor address", input.vendor.vendorAddress);

  title("3. Project use case and supplied planning basis");
  paragraph(input.summary, { size: 9, lineGap: 2, gapAfter: 6 });
  input.context.siteAnalysis.forEach((item) => field(`${item.section} · ${item.label}`, item.value));
  if (!input.context.siteAnalysis.length) paragraph("No matching saved Site Analysis values were available. Vendor must state all assumptions.", { color: muted, gapAfter: 4 });
  input.context.systems.forEach((item) => field(`System | ${item.name}`, `${item.type}${item.assets.length ? ` | ${item.assets.join(", ")}` : ""}`));

  title("4. Scope and response schedule");
  field("Category", input.category); field("Quantity / capacity basis", input.procurement.quantityBasis); field("Delivery location", input.procurement.deliveryLocation); field("Required delivery date", input.procurement.requiredDeliveryDate); field("Installation / commissioning responsibility", input.procurement.installationCommissioningScope);

  title("5. Required technical evidence - attach and identify revision");
  paragraph("Tick each enclosure and identify its document number, revision, date, applicable model and page or table. Missing items must be listed as deviations.", { size: 8.5, color: muted, gapAfter: 5 });
  checklist(input.evidenceChecklist);

  title("6. Evidence-backed claims");
  input.claims.forEach((claim) => {
    const type = pdfText(claim.type), claimText = pdfText(claim.text), evidence = pdfText(`Required evidence: ${claim.evidenceRequired}`);
    const height = textHeight(type, usable - 20, "Helvetica-Bold", 9, 1) + textHeight(claimText, usable - 20, "Helvetica", 8.5, 2) + textHeight(evidence, usable - 20, "Helvetica", 7.5, 1) + 23;
    ensure(height + 6);
    doc.roundedRect(left, cursorY, usable, height, 4).fillAndStroke(soft, line);
    let y = cursorY + 8;
    doc.font("Helvetica-Bold").fontSize(9).fillColor(ink).text(type, left + 10, y, { width: usable - 20 }); y += textHeight(type, usable - 20, "Helvetica-Bold", 9, 1) + 3;
    doc.font("Helvetica").fontSize(8.5).text(claimText, left + 10, y, { width: usable - 20, lineGap: 2 }); y += textHeight(claimText, usable - 20, "Helvetica", 8.5, 2) + 3;
    doc.fontSize(7.5).fillColor(muted).text(evidence, left + 10, y, { width: usable - 20 });
    cursorY += height + 6;
  });

  title("7. Vendor parameter schedule");
  input.parameters.forEach((parameter) => responseRow(parameter.label, parameter.unit, parameter.sourceHint));

  title("8. Commercial response - complete every applicable item");
  checklist(input.commercialChecklist);
  field("Currency", input.procurement.currency); field("Price / tax / freight basis", "Vendor to state unit and extended pricing"); field("Incoterms", input.procurement.incoterms); field("Quotation validity", input.procurement.quotationValidityDays ? `${input.procurement.quotationValidityDays} days` : undefined); field("Payment terms", input.procurement.paymentTerms); field("Warranty", input.procurement.warrantyRequirements); field("Support / service response", input.procurement.supportRequirements);

  title("9. Evaluation, deviations and clarifications");
  field("Evaluation basis", input.procurement.evaluationCriteria || "Technical compliance, evidence completeness, price, delivery, warranty and serviceability");
  field("Special terms", input.procurement.specialTerms);
  paragraph("Vendor deviations / exclusions / alternatives", { font: "Helvetica-Bold", size: 9, gapAfter: 2 });
  ensure(70);
  for (let i = 0; i < 5; i++) { doc.moveTo(left, cursorY + (i * 14)).lineTo(pageWidth - right, cursorY + (i * 14)).strokeColor(line).lineWidth(0.5).stroke(); }
  cursorY += 70;

  title("10. Authorization");
  ensure(130); const signatureY = cursorY + 6;
  safeImage(doc, media.purchaserSignature, 55, signatureY, [130, 42]); safeImage(doc, media.vendorSignature, 313, signatureY, [130, 42]);
  doc.moveTo(55, signatureY + 53).lineTo(230, signatureY + 53).strokeColor(ink).stroke(); doc.moveTo(313, signatureY + 53).lineTo(488, signatureY + 53).stroke();
  doc.font("Helvetica-Bold").fontSize(8).fillColor(ink).text("Issued by / purchaser", 55, signatureY + 60).text("Vendor authorized signatory", 313, signatureY + 60);
  doc.font("Helvetica").fillColor(muted).text(input.vendor.purchaserSignatoryName || "Name: __________________", 55, signatureY + 75).text(input.vendor.vendorSignatoryName || "Name: __________________", 313, signatureY + 75);
  doc.text(input.vendor.purchaserSignatoryTitle || "Title: __________________", 55, signatureY + 89).text(input.vendor.vendorSignatoryTitle || "Title: __________________", 313, signatureY + 89);
  doc.text("Date: __________________", 55, signatureY + 103).text("Date: __________________", 313, signatureY + 103);

  const range = doc.bufferedPageRange();
  for (let page = range.start; page < range.start + range.count; page++) {
    doc.switchToPage(page);
    doc.rect(0, 0, doc.page.width, 7).fill(green);
    doc.moveTo(left, 801).lineTo(pageWidth - right, 801).strokeColor(line).lineWidth(0.5).stroke();
    doc.font("Helvetica").fontSize(7).fillColor(muted).text(pdfText(`${input.procurement.referenceNumber} | Controlled vendor draft | Page ${page + 1} of ${range.count}`), left, 812, { width: usable, align: "center", lineBreak: false });
  }
  doc.end();
  return done;
}
