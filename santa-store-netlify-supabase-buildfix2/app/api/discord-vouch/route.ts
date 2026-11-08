import { createClient } from "@supabase/supabase-js";

type OrderItem = {
  product_name: string;
  quantity: number;
  unit_price_cents: number;
};

type OrderRecord = {
  order_number: string;
  status: string;
  order_items: OrderItem[];
};

type VouchRecord = {
  id: string;
  user_id: string;
  rating: number;
  feedback: string;
  customer_discord_tag: string;
  discord_status: "pending" | "sending" | "sent" | "failed";
  photo_path: string;
  created_at: string;
  orders: OrderRecord;
};

export const runtime = "nodejs";

export async function POST(request: Request) {
  const webhookUrl = process.env.DISCORD_VOUCH_WEBHOOK_URL;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!webhookUrl) {
    return Response.json(
      { error: "Discord vouch delivery is not configured yet. Your vouch is saved and can be published after setup." },
      { status: 503 }
    );
  }
  if (!supabaseUrl || !supabaseKey) {
    return Response.json({ error: "Authentication service is not configured." }, { status: 500 });
  }

  const authorization = request.headers.get("authorization") ?? "";
  const accessToken = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) {
    return Response.json({ error: "Please sign in before publishing a vouch." }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as { vouchId?: string } | null;
  if (!body?.vouchId || !/^[0-9a-f-]{36}$/i.test(body.vouchId)) {
    return Response.json({ error: "A valid vouch ID is required." }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: "Bearer " + accessToken } },
  });
  const { data: userResult, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !userResult.user) {
    return Response.json({ error: "Your session expired. Please sign in again." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("order_vouches")
    .select("id,user_id,rating,feedback,customer_discord_tag,discord_status,photo_path,created_at,orders!inner(order_number,status,order_items(product_name,quantity,unit_price_cents))")
    .eq("id", body.vouchId)
    .eq("user_id", userResult.user.id)
    .single();

  if (error || !data) {
    return Response.json({ error: "That vouch could not be found for your account." }, { status: 404 });
  }

  const vouch = data as unknown as VouchRecord;
  const order = vouch.orders;
  if (!vouch.photo_path) {
    return Response.json({ error: "A purchase photo is required before this vouch can be published." }, { status: 422 });
  }
  if (order.status !== "completed") {
    return Response.json({ error: "Only completed purchases can be posted as verified buyer vouches." }, { status: 403 });
  }
  if (vouch.discord_status === "sent") {
    return Response.json({ success: true, alreadySent: true });
  }

  const { data: claimed, error: claimError } = await supabase
    .from("order_vouches")
    .update({ discord_status: "sending" })
    .eq("id", vouch.id)
    .eq("user_id", userResult.user.id)
    .in("discord_status", ["pending", "failed"])
    .select("id")
    .maybeSingle();

  if (claimError) {
    return Response.json({ error: "Could not prepare the vouch for Discord: " + claimError.message }, { status: 500 });
  }
  if (!claimed) {
    const { data: latest } = await supabase
      .from("order_vouches")
      .select("discord_status")
      .eq("id", vouch.id)
      .maybeSingle();
    if (latest?.discord_status === "sent") {
      return Response.json({ success: true, alreadySent: true });
    }
    return Response.json({ error: "This vouch is already being published. Try again in a moment." }, { status: 409 });
  }

  const itemLines = (order.order_items ?? []).map(item => {
    const total = (item.unit_price_cents * item.quantity / 100).toFixed(2);
    const quantity = item.quantity > 1 ? " × " + item.quantity : "";
    return item.product_name + quantity + " — $" + total;
  });
  const productSummary = itemLines.join("\n").slice(0, 1024) || "Completed store order";
  const orderNumber = String(order.order_number).replace(/^#/, "");
  const orderLabel = "#" + orderNumber;
  const vouchDate = new Date(vouch.created_at);
  const dateLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(vouchDate);

  const content = "🛍️ **New Marketplace Vouch (" + orderLabel + ")!**";
  const embed = {
    color: 0x22c55e,
    fields: [
      { name: "Customer", value: "@" + vouch.customer_discord_tag + "\n✅ Verified Buyer", inline: true },
      { name: "Rating", value: vouch.rating + "/5", inline: true },
      { name: "Product ID / Item", value: productSummary },
      { name: "Feedback", value: vouch.feedback.slice(0, 1024) },
    ],
    footer: { text: "Sumz Market • verified purchase • order " + orderLabel + " • " + dateLabel },
    timestamp: vouchDate.toISOString(),
  };

  const { data: photoSigned, error: photoError } = await supabase.storage
    .from("vouch-photos")
    .createSignedUrl(vouch.photo_path, 60 * 60);
  if (photoError || !photoSigned?.signedUrl) {
    await supabase.from("order_vouches").update({ discord_status: "failed" }).eq("id", vouch.id);
    return Response.json({ error: "The required vouch photo could not be loaded. Please contact support." }, { status: 500 });
  }

  let webhookResponse: Response;
  try {
    const target = new URL(webhookUrl);
    target.searchParams.set("wait", "true");
    webhookResponse = await fetch(target.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "Sumz Market",
        content,
        embeds: [{ ...embed, image: { url: photoSigned.signedUrl } }],
        allowed_mentions: { parse: [] },
      }),
      cache: "no-store",
    });
  } catch {
    await supabase.from("order_vouches").update({ discord_status: "failed" }).eq("id", vouch.id);
    return Response.json({ error: "Discord could not be reached. You can retry publishing this vouch." }, { status: 502 });
  }

  if (!webhookResponse.ok) {
    await supabase.from("order_vouches").update({ discord_status: "failed" }).eq("id", vouch.id);
    return Response.json({ error: "Discord rejected the vouch (HTTP " + webhookResponse.status + "). Check the channel webhook." }, { status: 502 });
  }

  const posted = await webhookResponse.json().catch(() => ({})) as { id?: string };
  const { error: updateError } = await supabase
    .from("order_vouches")
    .update({
      discord_status: "sent",
      discord_message_id: posted.id ?? null,
      discord_sent_at: new Date().toISOString(),
    })
    .eq("id", vouch.id)
    .eq("user_id", userResult.user.id);

  if (updateError) {
    return Response.json({ success: true, warning: "Vouch was posted, but its delivery status could not be saved." });
  }

  return Response.json({ success: true });
}
