export const evidenceTaxonomy = [
  { value: "photo", label: "Site / installation photo", hint: "Visual condition, installation progress, or defect record." },
  { value: "equipment_nameplate", label: "Equipment nameplate", hint: "Manufacturer, model, serial number, or rating plate." },
  { value: "measurement", label: "Measurement reading", hint: "Observed value with unit, method, and conditions." },
  { value: "test_reading", label: "Test reading", hint: "Commissioning or functional test result." },
  { value: "inspection", label: "Inspection record", hint: "Inspection evidence, checklist, or site observation." },
  { value: "commissioning_checklist", label: "Commissioning checklist", hint: "Completed pre-functional or commissioning checklist." },
  { value: "delivery_note", label: "Delivery note / challan", hint: "Receipt, packing list, or delivery confirmation." },
  { value: "invoice_bill", label: "Invoice / bill / receipt", hint: "Commercial invoice, bill, receipt, or tax document." },
  { value: "purchase_order", label: "Purchase order", hint: "Approved procurement order or supplier acknowledgement." },
  { value: "calibration_certificate", label: "Calibration certificate", hint: "Calibration evidence for a measuring instrument." },
  { value: "compliance_certificate", label: "Compliance certificate", hint: "Material, test, statutory, or conformity certificate." },
  { value: "drawing_markup", label: "Drawing / markup", hint: "Controlled drawing, redline, or as-built markup." },
  { value: "permit", label: "Permit / authorization", hint: "Permit to work, approval, or authority record." },
  { value: "maintenance_record", label: "Maintenance record", hint: "Service report, maintenance log, or work order." },
  { value: "document", label: "Other controlled document", hint: "A document that does not fit a more specific category." }
] as const;

export type EvidenceType = (typeof evidenceTaxonomy)[number]["value"];
export const evidenceTypeValues = evidenceTaxonomy.map((item) => item.value) as [EvidenceType, ...EvidenceType[]];

export function evidenceLabel(value: string) {
  return evidenceTaxonomy.find((item) => item.value === value)?.label ?? value.replaceAll("_", " ");
}

export function recommendEvidenceType(file?: File | null): EvidenceType {
  const name = file?.name.toLowerCase() ?? "";
  if (/invoice|bill|receipt|tax/.test(name)) return "invoice_bill";
  if (/delivery|challan|packing/.test(name)) return "delivery_note";
  if (/purchase.?order|\bpo\b/.test(name)) return "purchase_order";
  if (/calibrat/.test(name)) return "calibration_certificate";
  if (/certificate|cert\b|conform/.test(name)) return "compliance_certificate";
  if (/drawing|as.?built|redline|markup/.test(name)) return "drawing_markup";
  if (/permit|authorization/.test(name)) return "permit";
  if (/mainten|service.?report|work.?order/.test(name)) return "maintenance_record";
  if (/checklist|pre.?functional/.test(name)) return "commissioning_checklist";
  if (/inspection/.test(name)) return "inspection";
  if (/test|commission/.test(name)) return "test_reading";
  if (/nameplate|serial|rating/.test(name)) return "equipment_nameplate";
  if (file?.type.startsWith("image/")) return "photo";
  return "document";
}
