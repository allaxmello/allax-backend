import express from "express";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

app.get("/", (_, res) => res.status(200).send("OK"));

app.post("/create-preference", async (req, res) => {
  try {
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
      notification_url: `${process.env.PUBLIC_BASE_URL}/mp-webhook`,
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
    if (!r.ok) return res.status(400).json({ error: data });

    await supabase
      .from("orders")
      .update({ mp_preference_id: data.id })
      .eq("external_reference", external_reference);

    return res.status(200).json({
      init_point: data.init_point,
      external_reference,
    });
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
});

app.post("/mp-webhook", async (req, res) => {
  try {
    const paymentId = req.body?.data?.id;
    if (!paymentId) return res.status(200).json({ ok: true });

    const pr = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        },
      }
    );

    const payment = await pr.json();

    await supabase
      .from("orders")
      .update({
        mp_payment_id: payment.id,
        mp_status: payment.status,
        mp_status_detail: payment.status_detail,
        status: payment.status,
      })
      .eq("external_reference", payment.external_reference);

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(200).json({ ok: true });
  }
});

app.get("/status", async (req, res) => {
  const ref = req.query.ref;
  if (!ref) return res.status(400).json({ error: "ref obrigatório" });

  const { data } = await supabase
    .from("orders")
    .select("*")
    .eq("external_reference", ref)
    .maybeSingle();

  res.status(200).json(data);
});

const port = process.env.PORT || 10000;
app.listen(port, () => console.log("Server running on port", port));
