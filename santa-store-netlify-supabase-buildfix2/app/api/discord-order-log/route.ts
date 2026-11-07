import { createClient } from "@supabase/supabase-js";

type OrderItem = {
  product_name: string;
  quantity: number;
  unit_price_cents: number;
};

type OrderRecord = {
  id: string;
  user_id: string;
  order_number: string;
  status: string;
  payment_method: string;
  payment_reported_at: string | null;
  total_cents: number;
  order_items: OrderItem[];
};

export const runtime = "nodejs";

export async function POST(request: Request) {
  const webhookUrl = process.env.DISCORD_ORDER_LOG_WEBHOOK_URL;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!webhookUrl) {
    return Response.json(
      { error: "Payment was reported, but the Discord order-log webhook is not configured yet." },
      { status: 503 }
    );
  }

  if (!supabaseUrl || !supabaseKey) {
    return Response.json({ error: "Authentication service is not configured." }, { status: 500 });
  }

  const authorization = request.headers.get("authorization") ?? "";
  const accessToken = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) {
    return Response.json({ error: "Please sign in before sending a payment alert." }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as { orderId?: string } | null;
  if (!body?.orderId || !/^[0-9a-f-]{36}$/i.test(body.orderId)) {
    return Response.json({ error: "A valid order ID is required." }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: "Bearer " + accessToken } },
  });

  const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
  if (authError || !authData.user) {
    return Response.json({ error: "Your session expired. Please sign in again." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("orders")
    .select("id,user_id,order_number,status,payment_method,payment_reported_at,total_cents,order_items(product_name,quantity,unit_price_cents)")
    .eq("id", body.orderId)
    .eq("user_id", authData.user.id)
    .single();

  if (error || !data) {
    return Response.json({ error: "That order could not be found for your account." }, { status: 404 });
  }

  const order = data as unknown as OrderRecord;
  if (!order.payment_reported_at || ["cancelled", "refunded"].includes(order.status)) {
    return Response.json({ error: "This order does not have an active payment report." }, { status: 409 });
  }

  let target: URL;
  try {
    target = new URL(webhookUrl);
  } catch {
    return Response.json({ error: "The Discord order-log webhook URL is invalid." }, { status: 500 });
  }

  if (!["discord.com", "discordapp.com"].includes(target.hostname)) {
    return Response.json({ error: "The Discord order-log webhook must use a Discord URL." }, { status: 500 });
  }

  const items = (order.order_items ?? []).map(item => {
    const lineTotal = (item.unit_price_cents * item.quantity / 100).toFixed(2);
    return item.product_name + " × " + item.quantity + " — $" + lineTotal;
  });
  const itemSummary = items.join("\n").slice(0, 900) || "Order details unavailable";
  const customer = authData.user.email ?? "Customer email unavailable";
  const reportedAt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(order.payment_reported_at));

  target.searchParams.set("wait", "true");

  let response: Response;
  try {
    response = await fetch(target.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "Sumz Market Order Alerts",
        content: "🔔 **HEY SUMZ.BAN — CHECK THE WEBSITE!**\nA customer just clicked **I Have Paid**.\nAdmin panel: https://sumz.store/admin\nLogs channel: <#1533089638548377812>",
        embeds: [{
          color: 0xa855f7,
          title: "New payment reported",
          fields: [
            { name: "Order", value: order.order_number, inline: true },
            { name: "Amount", value: "$" + (order.total_cents / 100).toFixed(2), inline: true },
            { name: "Payment method", value: order.payment_method.replaceAll("_", " "), inline: true },
            { name: "Customer", value: customer },
            { name: "Items", value: itemSummary },
            { name: "Reported at", value: reportedAt },
          ],
          footer: { text: "Sumz Market • payment reported only — staff must verify payment" },
          timestamp: new Date(order.payment_reported_at).toISOString(),
        }],
        allowed_mentions: { parse: [] },
      }),
      cache: "no-store",
    });
  } catch {
    return Response.json({ error: "Payment was reported, but Discord could not be reached." }, { status: 502 });
  }

  if (!response.ok) {
    return Response.json(
      { error: "Payment was reported, but Discord rejected the alert (HTTP " + response.status + ")." },
      { status: 502 }
    );
  }

  return Response.json({ success: true });
}
