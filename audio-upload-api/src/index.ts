import { Hono } from "hono";
import { createClient } from "@supabase/supabase-js";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
}

const app = new Hono<{ Bindings: Env }>();

interface CreateAudioUpload {
  service: string;
  season: string;
  hymn_title: string;
  language: string[];
  audio_object_key: string;
  checked_updates: boolean;
  email: string;
  status: string;
}

// app.get("/", (c) => {
//   // return c.text("Hello Hono!");
//   const sb_url = c.env.SUPABASE_URL
// });

app.post("/create-submission", async (c) => {
  const body = await c.req.json<CreateAudioUpload>();
  const sb_url = c.env.SUPABASE_URL;
  const sb_key = c.env.SUPABASE_SERVICE_KEY;
  const supabase = initSupabase(sb_url, sb_key);
  if (!supabase) {
    return c.json({ error: "Failed to initialize Supabase client" }, 500);
  }
  const { data, error } = await supabase
    .from("audio_uploads")
    .insert(body)
    .select();
});

function initSupabase(sb_url: string, sb_key: string) {
  try {
    const supabase = createClient(sb_url, sb_key);
    return supabase;
  } catch (error) {
    console.error("An error occurred while connecting to Supabase:", error);
  }
}
export default app;