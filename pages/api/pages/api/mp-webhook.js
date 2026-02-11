import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const paymentId = req.body?.data?.id;
  if (!paymentId) return res.status(200).end();

  const r = await fetch(
    `https://api.mercadopago.com/v1/payments/${paymentId}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
      },
    }
  );

  const payment = await r.json();

  await supabase
    .from("orders")
    .update({
      mp_payment_id: payment.id,
      mp_status: payment.status,
      mp_status_detail: payment.status_detail,
      status: payment.status,
    })
    .eq("external_reference", payment.external_reference);

  res.status(200).end();
}
