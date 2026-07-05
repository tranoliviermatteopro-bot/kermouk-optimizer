import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-06-24.dahlia" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error("[webhook] STRIPE_WEBHOOK_SECRET manquant — configuration serveur incomplète");
    return NextResponse.json({ error: "Webhook non configuré" }, { status: 500 });
  }
  if (!sig) {
    return NextResponse.json({ error: "Signature manquante" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("[webhook:verify]", err);
    return NextResponse.json({ error: "Signature invalide" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const plan = session.metadata?.plan || "monthly";
    const email = session.customer_email || session.customer_details?.email || "";
    const licenseKey = randomUUID();

    const { error: insertError } = await supabase.from("licenses").insert({
      key: licenseKey,
      plan,
      email,
      stripe_session_id: session.id,
      active: true,
      expires_at: plan === "monthly" ? new Date(Date.now() + 31 * 24 * 60 * 60 * 1000).toISOString() : null,
    });
    if (insertError) {
      console.error("[webhook:supabase]", insertError);
      return NextResponse.json({ error: "Échec enregistrement licence" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}

export const dynamic = "force-dynamic";
