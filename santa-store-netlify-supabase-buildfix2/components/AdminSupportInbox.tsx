"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import OrderSupportChat from "./OrderSupportChat";

type Conversation = {
  id: string;
  order_id: string;
  user_id: string;
  status: string;
  created_at: string;
  updated_at: string;
};
type Profile = { id: string; email: string | null; full_name: string | null };
type Order = {
  id: string;
  order_number: string;
  status: string;
  payment_method: string;
  payment_reported_at: string | null;
  total_cents: number;
};
type InboxItem = {
  conversation: Conversation;
  profile: Profile | undefined;
  order: Order | undefined;
};

const money = (cents: number) => "$" + (cents / 100).toFixed(2);

export default function AdminSupportInbox() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [statusBusy, setStatusBusy] = useState("");
  const [orderBusy, setOrderBusy] = useState("");

  const loadInbox = useCallback(async () => {
    setLoading(true);
    const { data: conversations, error } = await supabase
      .from("support_conversations")
      .select("id,order_id,user_id,status,created_at,updated_at")
      .order("updated_at", { ascending: false });

    if (error) {
      setMessage("Could not load support inbox: " + error.message);
      setItems([]);
      setLoading(false);
      return;
    }

    const rows = (conversations ?? []) as Conversation[];
    if (!rows.length) {
      setItems([]);
      setSelectedId("");
      setMessage("");
      setLoading(false);
      return;
    }

    const userIds = [...new Set(rows.map(row => row.user_id))];
    const orderIds = [...new Set(rows.map(row => row.order_id))];
    const [{ data: profiles }, { data: orders }] = await Promise.all([
      supabase.from("profiles").select("id,email,full_name").in("id", userIds),
      supabase.from("orders").select("id,order_number,status,payment_method,payment_reported_at,total_cents").in("id", orderIds),
    ]);
    const profileMap = new Map(((profiles ?? []) as Profile[]).map(row => [row.id, row]));
    const orderMap = new Map(((orders ?? []) as Order[]).map(row => [row.id, row]));
    setItems(rows.map(conversation => ({
      conversation,
      profile: profileMap.get(conversation.user_id),
      order: orderMap.get(conversation.order_id),
    })));
    setSelectedId(current => rows.some(row => row.id === current) ? current : rows[0].id);
    setMessage("");
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadInbox();
    const channel = supabase
      .channel("admin-support-inbox")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_conversations" }, () => { void loadInbox(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [loadInbox]);

  const selected = items.find(item => item.conversation.id === selectedId);

  async function markOrderCompleted(order: Order) {
    if (order.status === "completed") return;
    if (!window.confirm("Mark order " + order.order_number + " as Completed? This will unlock the customer's verified vouch form.")) return;

    setOrderBusy(order.id);
    setMessage("");
    const { data, error } = await supabase
      .from("orders")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", order.id)
      .select("id,status")
      .maybeSingle();
    setOrderBusy("");

    if (error) {
      setMessage("Could not mark order completed: " + error.message);
      return;
    }
    if (!data) {
      setMessage("Order was not updated. Check that your account has staff/admin permissions.");
      return;
    }

    setItems(current => current.map(item => item.order?.id === order.id
      ? { ...item, order: { ...item.order, status: "completed" } }
      : item
    ));
    setMessage("Order " + order.order_number + " marked Completed. The customer can now leave a verified vouch.");
  }

  async function deleteTicketForBoth(conversationId: string) {
    const target = items.find(item => item.conversation.id === conversationId);
    const orderLabel = target?.order?.order_number ?? "this ticket";
    if (!window.confirm("Delete " + orderLabel + " for both the customer and store staff? All chat messages will be permanently removed.")) return;

    setStatusBusy(conversationId);
    setMessage("");

    const { data: attachmentRows, error: attachmentReadError } = await supabase
      .from("chat_messages")
      .select("attachment_path")
      .eq("conversation_id", conversationId);

    if (attachmentReadError) {
      setStatusBusy("");
      setMessage("Could not prepare ticket deletion: " + attachmentReadError.message);
      return;
    }

    const attachmentPaths = (attachmentRows ?? [])
      .map(row => row.attachment_path as string | null)
      .filter((value): value is string => !!value);

    if (attachmentPaths.length) {
      const { error: removeError } = await supabase.storage
        .from("support-attachments")
        .remove(attachmentPaths);
      if (removeError) {
        setStatusBusy("");
        setMessage("Could not delete ticket attachments: " + removeError.message);
        return;
      }
    }

    const { data, error } = await supabase
      .from("support_conversations")
      .delete()
      .eq("id", conversationId)
      .select("id")
      .maybeSingle();
    setStatusBusy("");

    if (error) {
      setMessage("Could not delete ticket for both users: " + error.message);
      return;
    }
    if (!data) {
      setMessage("Ticket was already deleted or could not be found.");
      await loadInbox();
      return;
    }

    const remaining = items.filter(item => item.conversation.id !== conversationId);
    setItems(remaining);
    setSelectedId(remaining[0]?.conversation.id ?? "");
    setMessage("Ticket and its messages were deleted for both the customer and store staff.");
  }

  async function changeTicketStatus(conversationId: string, nextStatus: "open" | "closed") {
    setStatusBusy(conversationId);
    setMessage("");
    const { error } = await supabase
      .from("support_conversations")
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq("id", conversationId);
    setStatusBusy("");
    if (error) {
      setMessage("Could not " + (nextStatus === "closed" ? "close" : "reopen") + " ticket: " + error.message);
      return;
    }
    setItems(current => current.map(item => item.conversation.id === conversationId
      ? { ...item, conversation: { ...item.conversation, status: nextStatus, updated_at: new Date().toISOString() } }
      : item
    ));
    setMessage(nextStatus === "closed" ? "Ticket closed. The customer can no longer send messages." : "Ticket reopened. Messaging is available again.");
  }


  return (
    <section style={{ marginTop: 42 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div className="eyebrow">CUSTOMER SUPPORT</div>
          <h2 style={{ fontSize: 25, margin: "7px 0" }}>1-on-1 customer chats</h2>
          <p className="muted">Verify payments, reply to customers, and send their delivery details privately.</p>
        </div>
        <button className="btn secondary" type="button" onClick={() => void loadInbox()} disabled={loading}>
          {loading ? "Refreshing…" : "Refresh chats"}
        </button>
      </div>

      {message ? <div className="notice" role="status" style={{ marginTop: 12 }}>{message}</div> : null}

      <div className="grid" style={{ marginTop: 16, gridTemplateColumns: "minmax(220px,0.8fr) minmax(300px,1.5fr)", alignItems: "start" }}>
        <div className="product pbody" style={{ display: "grid", gap: 8 }}>
          <b>Inbox ({items.length})</b>
          {loading && items.length === 0 ? <div className="muted">Loading chats…</div> : items.length === 0 ? (
            <div className="muted">No customers have opened a payment chat yet. New conversations appear here.</div>
          ) : items.map(item => {
            const active = item.conversation.id === selectedId;
            const reported = !!item.order?.payment_reported_at;
            return (
              <button
                key={item.conversation.id}
                type="button"
                onClick={() => setSelectedId(item.conversation.id)}
                style={{
                  width: "100%", textAlign: "left", padding: 12, borderRadius: 10, cursor: "pointer",
                  border: active ? "1px solid #ef4444" : "1px solid #393940",
                  background: active ? "#351318" : "#111114", color: "#fff",
                }}
              >
                <b style={{ display: "block", overflowWrap: "anywhere" }}>{item.profile?.email ?? "Customer"}</b>
                <span className="muted" style={{ display: "block", marginTop: 4 }}>{item.order?.order_number ?? "Order"}</span>
                <span className="muted" style={{ display: "block", marginTop: 4 }}>
                  {item.order ? money(item.order.total_cents) + " · " + item.order.status.replaceAll("_", " ") : ""}
                </span>
                <span className="pill" style={{ marginTop: 8, display: "inline-block" }}>{item.conversation.status === "closed" ? "Closed" : "Open"} · {reported ? "Payment reported" : "Chat opened"}</span>
              </button>
            );
          })}
        </div>

        <div>
          {selected && selected.order ? (
            <>
              <div className="product pbody" style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div><b>{selected.order.order_number}</b><div className="muted">{selected.profile?.email ?? "Customer"}</div></div>
                  <b>{money(selected.order.total_cents)}</b>
                </div>
                <div className="muted" style={{ marginTop: 8 }}>
                  Payment: {selected.order.payment_method.replaceAll("_", " ")} · Status: {selected.order.status.replaceAll("_", " ")}
                </div>
                <div className="muted" style={{ marginTop: 4 }}>
                  {selected.order.payment_reported_at
                    ? "Customer reported payment " + new Date(selected.order.payment_reported_at).toLocaleString()
                    : "Customer has not clicked I Have Paid yet."}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                  {selected.order.status !== "completed" ? (
                    <button
                      className="btn"
                      type="button"
                      disabled={orderBusy === selected.order.id}
                      onClick={() => void markOrderCompleted(selected.order!)}
                    >
                      {orderBusy === selected.order.id ? "Marking Completed…" : "Mark Order Completed"}
                    </button>
                  ) : (
                    <span className="pill" style={{ alignSelf: "center" }}>Order Completed</span>
                  )}
                  {selected.conversation.status === "open" ? (
                    <button
                      className="btn secondary"
                      type="button"
                      disabled={statusBusy === selected.conversation.id}
                      onClick={() => void changeTicketStatus(selected.conversation.id, "closed")}
                    >
                      {statusBusy === selected.conversation.id ? "Closing…" : "Close Ticket"}
                    </button>
                  ) : (
                    <button
                      className="btn"
                      type="button"
                      disabled={statusBusy === selected.conversation.id}
                      onClick={() => void changeTicketStatus(selected.conversation.id, "open")}
                    >
                      {statusBusy === selected.conversation.id ? "Reopening…" : "Reopen Ticket"}
                    </button>
                  )}
                  <button
                    className="btn secondary"
                    type="button"
                    style={{ borderColor: "#7f1d1d", color: "#fca5a5" }}
                    disabled={statusBusy === selected.conversation.id}
                    onClick={() => void deleteTicketForBoth(selected.conversation.id)}
                  >
                    {statusBusy === selected.conversation.id ? "Deleting…" : "Delete Ticket for Both"}
                  </button>
                </div>
              </div>
              <OrderSupportChat
                key={selected.conversation.id}
                orderId={selected.order.id}
                orderNumber={selected.order.order_number}
                initialConversationId={selected.conversation.id}
                isAdmin
                customerEmail={selected.profile?.email ?? undefined}
              />
            </>
          ) : (
            <div className="product pbody muted">Select a customer conversation to open the private chat.</div>
          )}
        </div>
      </div>
    </section>
  );
}
