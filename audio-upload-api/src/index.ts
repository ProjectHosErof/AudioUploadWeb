import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { uploads } from './routes/uploads';
import { me } from './routes/me';
import { scheduled } from './scheduled';

const app = new Hono<{ Bindings: Env }>();

// CORS — allow the configured browser origins (comma-separated in ALLOWED_ORIGINS).
app.use('*', async (c, next) => {
  const allowed = c.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim());
  return cors({
    origin: (origin) => (allowed.includes(origin) ? origin : allowed[0]),
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    // Authorization is required for the signed-in endpoints (/me/*) and for
    // attributing an upload to a logged-in contributor.
    allowHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  })(c, next);
});

app.get('/health', (c) => c.json({ ok: true, service: 'audio-upload-api' }));

app.route('/uploads', uploads);
app.route('/me', me);

app.onError((err, c) => {
  console.error('Unhandled error', err);
  return c.json({ error: 'Internal error' }, 500);
});

app.notFound((c) => c.json({ error: 'Not found' }, 404));

// Export both the fetch handler (Hono app) and the scheduled handler (Cron Trigger janitor).
export default {
  fetch: app.fetch,
  scheduled,
};
