import { NextResponse } from "next/server";
import { objectStorage } from "@/lib/storage/service";

function requestedRange(header: string | null, byteSize: number) {
  const match = header?.match(/^bytes=(\d*)-(\d*)$/);
  if (!match) return null;
  const start = match[1]
    ? Number(match[1])
    : Math.max(0, byteSize - Number(match[2]));
  const requestedEnd = match[2] && match[1] ? Number(match[2]) : byteSize - 1;
  const end = Math.min(requestedEnd, byteSize - 1);
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    start > end ||
    start >= byteSize
  ) return null;
  return { start, end };
}

function safeFileName(name: string, mediaType: string) {
  const extension = mediaType === "application/pdf" && !name.toLowerCase().endsWith(".pdf")
    ? ".pdf"
    : "";
  const displayName = `${name}${extension}`;
  return {
    ascii: displayName.replace(/[^\x20-\x7E]/g, "_").replace(/["\\\r\n]/g, "_"),
    encoded: encodeURIComponent(displayName),
  };
}

export function projectObjectContentUrl(projectId: string, objectId: string, requestUrl?: string) {
  const path = `/api/projects/${projectId}/objects/${objectId}/content`;
  return requestUrl ? new URL(path, requestUrl).toString() : path;
}

export async function storedObjectResponse(
  request: Request,
  input: { objectKey: string; mediaType: string; fileName: string },
) {
  const byteSize = await objectStorage.byteSize(input.objectKey);
  const range = requestedRange(request.headers.get("range"), byteSize);
  const body = range
    ? await objectStorage.readRange(input.objectKey, range.start, range.end)
    : await objectStorage.read(input.objectKey);
  const fileName = safeFileName(input.fileName, input.mediaType);

  return new NextResponse(body, {
    status: range ? 206 : 200,
    headers: {
      "content-type": input.mediaType,
      "content-disposition": `inline; filename="${fileName.ascii}"; filename*=UTF-8''${fileName.encoded}`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      "accept-ranges": "bytes",
      "content-length": String(body.byteLength),
      ...(range ? { "content-range": `bytes ${range.start}-${range.end}/${byteSize}` } : {}),
    },
  });
}
