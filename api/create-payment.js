import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    const { type, data } = req.body;

    // só pagamento
    if (type !== "payment") {
      return res.status(200).json({ ok: true });
    }

    const paymentId = data.id;

    // 🔎 consulta pagamento no MP
    const mpRes = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        },
      }
    );

    const payment = await mpRes.json();

    if (payment.status !== "approved") {
      return res.status(200).json({ status: payment.status });
    }

    const referencia = payment.external_reference;

    // 🔎 busca pagamento interno
    const { data: pagamento } = await sb
      .from("pagamentos")
      .select("*")
      .eq("referencia", referencia)
      .single();

    if (!pagamento || pagamento.processado) {
      return res.status(200).json({ ok: true });
    }

    // 🟢 MARCA COMO APROVADO
    await sb.from("pagamentos").update({
      status: "approved",
      processado: true,
      updated_at: new Date(),
    }).eq("id", pagamento.id);

    // 🪙 APEX
    if (pagamento.tipo === "apex") {
      const apex = pagamento.valor * 15;

      const { data: carteira } = await sb
        .from("carteiras")
        .select("saldo")
        .eq("user_id", pagamento.user_id)
        .single();

      const novoSaldo =
        Number(carteira?.saldo || 0) + Number(pagamento.valor);

      await sb.from("carteiras").update({
        saldo: novoSaldo,
      }).eq("user_id", pagamento.user_id);
    }

    // 📦 ASSINATURA
    if (pagamento.tipo === "assinatura") {
      await sb.from("usuarios").update({
        tipo_assinatura: pagamento.plano_id,
        status: "ativo",
      }).eq("id", pagamento.user_id);
    }

    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error("Webhook erro:", err);
    return res.status(500).json({ error: "Erro webhook" });
  }
}
