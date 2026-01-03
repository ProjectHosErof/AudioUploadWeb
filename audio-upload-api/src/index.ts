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

app.post("/create-submission", async (c) => {
  const body = await c.req.json<CreateAudioUpload>();
  const sb_url = c.env.SUPABASE_URL;
  const sb_key = c.env.SUPABASE_SERVICE_KEY;
  const supabase = initSupabase(sb_url, sb_key);
  if (!supabase) {
    return c.json({ error: "Failed to initialize Supabase client" }, 500);
  }
  try {
    const { data, error } = await supabase
      .from("audio_uploads")
      .insert(body)
      .select();
    if (error) {
      return c.json({ error: error.message }, 500);
    }
    return c.json({ message: "Uploaded Successfully" }, 200);
  } catch (error) {
    console.error(
      "An error occurred while uploading record to database:",
      error
    );
    return c.json({ error: "Upload Failed" }, 500);
  }
});

function initSupabase(sb_url: string, sb_key: string) {
  try {
    const supabase = createClient(sb_url, sb_key);
    return supabase;
  } catch (error) {
    console.error(
      "An error occurred while establishing database connection:",
      error
    );
  }
}
export default app;
