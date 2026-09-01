import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, open, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { CreateBucketCommand, DeleteObjectCommand, GetObjectCommand, HeadBucketCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/lib/env";

export interface StoredObject { objectKey: string; sha256: string; byteSize: number; mediaType: string }
export interface PutObjectInput { tenantId: string; projectId: string; bytes: Uint8Array; mediaType: string; fileName: string }

function safeExtension(fileName: string) {
  const candidate = basename(fileName).split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "");
  return candidate && candidate.length <= 10 ? `.${candidate}` : "";
}

function signingKey() {
  return env.AUTH_ENCRYPTION_KEY ?? "development-object-url-key-not-for-production";
}

function assertSafeKey(key: string) {
  if (!/^[a-zA-Z0-9/_-]+\.[a-zA-Z0-9]+$/.test(key) || key.includes("..")) throw new Error("Object key is invalid.");
}

class LocalStorage {
  async put(input: PutObjectInput): Promise<StoredObject> {
    const sha256 = createHash("sha256").update(input.bytes).digest("hex");
    const objectKey = `${input.tenantId}/${input.projectId}/${sha256}${safeExtension(input.fileName)}`;
    assertSafeKey(objectKey);
    const path = resolve(env.LOCAL_UPLOAD_DIR, objectKey);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, input.bytes, { flag: "wx" }).catch((error: NodeJS.ErrnoException) => { if (error.code !== "EEXIST") throw error; });
    return { objectKey, sha256, byteSize: input.bytes.byteLength, mediaType: input.mediaType };
  }
  async read(objectKey: string) { assertSafeKey(objectKey); return readFile(resolve(env.LOCAL_UPLOAD_DIR, objectKey)); }
  async byteSize(objectKey: string) { assertSafeKey(objectKey); return (await stat(resolve(env.LOCAL_UPLOAD_DIR, objectKey))).size; }
  async readRange(objectKey: string, start: number, end: number) {
    assertSafeKey(objectKey);
    const handle = await open(resolve(env.LOCAL_UPLOAD_DIR, objectKey), "r");
    try {
      const body = Buffer.alloc(end - start + 1);
      const { bytesRead } = await handle.read(body, 0, body.length, start);
      return body.subarray(0, bytesRead);
    } finally {
      await handle.close();
    }
  }
  async remove(objectKey: string) { assertSafeKey(objectKey); await unlink(resolve(env.LOCAL_UPLOAD_DIR, objectKey)).catch(() => undefined); }
  async signedReadUrl(objectKey: string, expiresInSeconds = 300) {
    const expires = Math.floor(Date.now() / 1000) + Math.min(Math.max(expiresInSeconds, 30), 900);
    const token = createHmac("sha256", signingKey()).update(`${objectKey}:${expires}`).digest("base64url");
    return `${env.APP_BASE_URL}/api/objects/${objectKey}?expires=${expires}&token=${token}`;
  }
  verify(objectKey: string, expires: number, token: string) {
    if (expires < Math.floor(Date.now() / 1000)) return false;
    const expected = createHmac("sha256", signingKey()).update(`${objectKey}:${expires}`).digest();
    const received = Buffer.from(token, "base64url");
    return received.length === expected.length && timingSafeEqual(received, expected);
  }
  async health() { await mkdir(resolve(env.LOCAL_UPLOAD_DIR), { recursive: true }); return { status: "ok" as const, driver: "local" as const }; }
}

class S3Storage {
  private client = new S3Client({ region: env.S3_REGION, endpoint: env.S3_ENDPOINT, forcePathStyle: true, credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY } });
  async ensureBucket() { try { await this.client.send(new HeadBucketCommand({ Bucket: env.S3_BUCKET })); } catch { await this.client.send(new CreateBucketCommand({ Bucket: env.S3_BUCKET })); } }
  async put(input: PutObjectInput): Promise<StoredObject> { const sha256 = createHash("sha256").update(input.bytes).digest("hex"); const objectKey = `${input.tenantId}/${input.projectId}/${sha256}${safeExtension(input.fileName)}`; await this.ensureBucket(); await this.client.send(new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: objectKey, Body: input.bytes, ContentType: input.mediaType, Metadata: { sha256, project: input.projectId } })); return { objectKey, sha256, byteSize: input.bytes.byteLength, mediaType: input.mediaType }; }
  async remove(objectKey: string) { await this.client.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: objectKey })); }
  async read(objectKey: string) { const result = await this.client.send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: objectKey })); if (!result.Body) throw new Error("Object body is unavailable."); return Buffer.from(await result.Body.transformToByteArray()); }
  async byteSize(objectKey: string) { const result = await this.client.send(new HeadObjectCommand({ Bucket: env.S3_BUCKET, Key: objectKey })); if (result.ContentLength == null) throw new Error("Object size is unavailable."); return result.ContentLength; }
  async readRange(objectKey: string, start: number, end: number) { const result = await this.client.send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: objectKey, Range: `bytes=${start}-${end}` })); if (!result.Body) throw new Error("Object body is unavailable."); return Buffer.from(await result.Body.transformToByteArray()); }
  async signedReadUrl(objectKey: string, expiresInSeconds = 300) { return getSignedUrl(this.client, new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: objectKey }), { expiresIn: Math.min(Math.max(expiresInSeconds, 30), 900) }); }
  async health() { try { await this.ensureBucket(); return { status: "ok" as const, driver: "s3" as const }; } catch (error) { return { status: "unavailable" as const, driver: "s3" as const, reason: error instanceof Error ? error.message : "Object storage unavailable" }; } }
}

export const localStorage = new LocalStorage();
export const objectStorage = env.OBJECT_STORAGE_DRIVER === "s3" ? new S3Storage() : localStorage;
