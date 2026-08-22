/**
 * Set (and verify) the CORS policy on the R2 bucket so browsers can PUT audio
 * directly to presigned URLs. R2 buckets have NO CORS by default, so cross-origin
 * browser PUTs are blocked until this runs — curl/HEAD are unaffected, which is
 * why it only shows up in a real browser upload.
 *
 * This is idempotent: it REPLACES the whole policy, so pass every origin you
 * want allowed in one call (dev + prod).
 *
 * Requires a Cloudflare API token with **Workers R2 Storage: Edit** (the R2 S3
 * object token canNOT set CORS). Account + bucket come from .env.
 *
 *   CLOUDFLARE_API_TOKEN=... npm run cors:set -- "https://app.example.com,http://localhost:5173"
 */
import * as dotenv from 'dotenv';

dotenv.config();

const token = process.env.CLOUDFLARE_API_TOKEN;
const account = process.env.R2_ACCOUNT_ID;
const bucket = process.env.R2_BUCKET_NAME;

const originsArg = process.argv[2];
if (!token) {
  console.error('Missing CLOUDFLARE_API_TOKEN (needs Workers R2 Storage: Edit).');
  process.exit(1);
}
if (!account || !bucket) {
  console.error('Missing R2_ACCOUNT_ID / R2_BUCKET_NAME in .env.');
  process.exit(1);
}
if (!originsArg) {
  console.error('Usage: npm run cors:set -- "<origin1,origin2,...>"');
  process.exit(1);
}

const origins = originsArg
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const endpoint = `https://api.cloudflare.com/client/v4/accounts/${account}/r2/buckets/${bucket}/cors`;
const body = {
  rules: [
    {
      allowed: {
        origins,
        methods: ['PUT', 'GET', 'HEAD'],
        headers: ['*'],
      },
      exposeHeaders: ['ETag'],
      maxAgeSeconds: 3600,
    },
  ],
};

/** Shape of a Cloudflare API envelope (only the fields we read). */
interface CloudflareResponse {
  success?: boolean;
  errors?: unknown;
  result?: unknown;
}

async function main() {
  const put = await fetch(endpoint, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const putJson = (await put.json()) as CloudflareResponse;
  if (!put.ok || !putJson.success) {
    console.error('Failed to set CORS:', JSON.stringify(putJson.errors ?? putJson, null, 2));
    process.exit(1);
  }
  console.log(`CORS set on ${bucket} for origins:`, origins);

  const get = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}` } });
  const getJson = (await get.json()) as CloudflareResponse;
  console.log('Verified policy:', JSON.stringify(getJson.result, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
