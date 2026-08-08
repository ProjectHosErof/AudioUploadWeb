import { AwsClient } from 'aws4fetch';

/**
 * R2 accessed over its S3-compatible API. We use presigned PUT URLs so raw
 * audio goes browser → R2 directly (never through the Worker), and a signed
 * HEAD to confirm the object at completion. Identical in dev and prod.
 */

function client(env: Env): AwsClient {
  return new AwsClient({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    service: 's3',
    region: 'auto',
  });
}

function objectUrl(env: Env, key: string): string {
  // Keys are built from safe chars only (see buildObjectKey), so no escaping needed.
  return `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_BUCKET_NAME}/${key}`;
}

/** Deterministic, collision-free object key. */
export function buildObjectKey(recordingId: string, ext: string): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `raw/${yyyy}/${mm}/${recordingId}.${ext}`;
}

/**
 * Presigned PUT URL, ~ttlSeconds lifetime. Only `host` is signed (aws4fetch's
 * signQuery mode), so the browser may send its own Content-Type freely.
 * Notes:
 *  - Content-Type is NOT pinned by the signature; the declared value is stored
 *    at initiate and the true value is confirmed by enrichment (ffprobe).
 *  - Presigned PUT cannot enforce a max object size (only presigned POST
 *    policies can); size is bounded by the declared-size check at initiate and
 *    verified authoritatively via HEAD at completion.
 */
export async function presignPut(env: Env, key: string, ttlSeconds: number): Promise<string> {
  const url = new URL(objectUrl(env, key));
  url.searchParams.set('X-Amz-Expires', String(ttlSeconds));
  const signed = await client(env).sign(url.toString(), {
    method: 'PUT',
    aws: { signQuery: true },
  });
  return signed.url;
}

export interface HeadResult {
  sizeBytes: number | null;
  etag: string | null;
}

/** Signed HEAD. Returns null if the object does not exist yet. */
export async function headObject(env: Env, key: string): Promise<HeadResult | null> {
  const res = await client(env).fetch(objectUrl(env, key), { method: 'HEAD' });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`R2 HEAD failed: ${res.status} ${res.statusText}`);
  }
  const len = res.headers.get('content-length');
  return {
    sizeBytes: len ? Number(len) : null,
    etag: res.headers.get('etag'),
  };
}
