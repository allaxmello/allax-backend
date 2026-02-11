import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { title, amount } = req.body || {};
  const parsedAmount = Number(amount);

  if (!title || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ error: "title/amount inválidos" });
  }

  const external_reference = crypto.randomUUID();

  await supabase.from("orders").insert({
    external_reference,
    amount: parsedAmount,
    status: "created",
  });

  const preference = {
    items: [{ title, quantity: 1, unit_price: parsedAmount, currency_id: "BRL" }],
    external_reference,
    notification_url: `${process.env.PUBLIC_BASE_URL}/api/mp-webhook`,
    back_urls: {
      success: `${process.env.MOCHA_BASE_URL}/pagamento/sucesso?ref=${external_reference}`,
      pending: `${process.env.MOCHA_BASE_URL}/pagamento/pendente?ref=${external_reference}`,
      failure: `${process.env.MOCHA_BASE_URL}/pagamento/erro?ref=${external_reference}`,
    },
    auto_return: "approved",
  };

  const r = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(preference),
  });

  const data = await r.json();

  await supabase
    .from("orders")
    .update({ mp_preference_id: data.id })
    .eq("external_reference", external_reference);

  res.status(200).json({
    init_point: data.init_point,
    external_reference,
  });
}
