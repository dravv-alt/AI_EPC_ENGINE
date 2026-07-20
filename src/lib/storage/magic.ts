const allowedTextTypes = new Set(["text/plain", "text/csv", "application/csv"]);

function isMostlyText(bytes: Uint8Array) {
  const sample = bytes.subarray(0, Math.min(bytes.length, 4096));
  if (!sample.length) return false;
  let printable = 0;
  for (const byte of sample) if (byte === 9 || byte === 10 || byte === 13 || byte >= 32 && byte <= 126) printable += 1;
  return printable / sample.length > 0.95;
}

export function detectAllowedCaptureMediaType(bytes: Uint8Array, declared: string) {
  if (bytes.length >= 5 && Buffer.from(bytes.subarray(0, 5)).toString("ascii") === "%PDF-") return "application/pdf";
  if (bytes.length >= 8 && Buffer.from(bytes.subarray(0, 8)).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 12 && Buffer.from(bytes.subarray(0, 4)).toString("ascii") === "RIFF" && Buffer.from(bytes.subarray(8, 12)).toString("ascii") === "WEBP") return "image/webp";
  if (allowedTextTypes.has(declared) && isMostlyText(bytes)) return declared === "text/csv" || declared === "application/csv" ? "text/csv" : "text/plain";
  return null;
}
