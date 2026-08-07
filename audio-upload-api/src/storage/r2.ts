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

export interface R2Object {
  key: string;
  lastModified: Date;
  size: number;
}

function bucketUrl(env: Env): string {
  return `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_BUCKET_NAME}`;
}

// Keys we generate are safe chars only, but decode the handful of XML entities
// S3 could still emit, so the janitor never mistakes an encoded key for a miss.
function unescapeXml(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

/**
 * List objects under a prefix via the S3 ListObjectsV2 API, following
 * continuation tokens. Used by the scheduled janitor to reconcile the bucket
 * against the DB. Parses the ListBucketResult XML with regex (no DOMParser in
 * Workers); our keys contain no XML-special chars.
 */
export async function listRawObjects(
  env: Env,
  opts: { prefix?: string } = {},
): Promise<R2Object[]> {
  const prefix = opts.prefix ?? 'raw/';
  const c = client(env);
  const out: R2Object[] = [];
  let token: string | undefined;

  do {
    const url = new URL(bucketUrl(env));
    url.searchParams.set('list-type', '2');
    url.searchParams.set('prefix', prefix);
    url.searchParams.set('max-keys', '1000');
    if (token) url.searchParams.set('continuation-token', token);

    const res = await c.fetch(url.toString(), { method: 'GET' });
    if (!res.ok) {
      throw new Error(`R2 list failed: ${res.status} ${res.statusText}`);
    }
    const xml = await res.text();

    for (const m of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
      const block = m[1];
      const key = block.match(/<Key>([\s\S]*?)<\/Key>/)?.[1];
      if (!key) continue;
      const lm = block.match(/<LastModified>([\s\S]*?)<\/LastModified>/)?.[1];
      const size = block.match(/<Size>([\s\S]*?)<\/Size>/)?.[1];
      out.push({
        key: unescapeXml(key),
        lastModified: lm ? new Date(lm) : new Date(0),
        size: size ? Number(size) : 0,
      });
    }

    const truncated = /<IsTruncated>true<\/IsTruncated>/.test(xml);
    token = truncated
      ? xml.match(/<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/)?.[1]
      : undefined;
  } while (token);

  return out;
}

/** Signed DELETE. Treats 404 as success (already gone). */
export async function deleteObject(env: Env, key: string): Promise<void> {
  const res = await client(env).fetch(objectUrl(env, key), { method: 'DELETE' });
  if (!res.ok && res.status !== 404) {
    throw new Error(`R2 DELETE failed: ${res.status} ${res.statusText}`);
  }
}
