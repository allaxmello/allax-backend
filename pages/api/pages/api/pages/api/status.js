import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const ref = req.query.ref;
  if (!ref) return res.status(400).json({ error: "ref obrigatório" });

  const { data } = await supabase
    .from("orders")
    .select("*")
    .eq("external_reference", ref)
    .maybeSingle();

  res.status(200).json(data);
}
