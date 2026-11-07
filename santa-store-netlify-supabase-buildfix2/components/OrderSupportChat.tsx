"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type ChatMessage = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

export default function OrderSupportChat({
  orderId,
  orderNumber,
  initialConversationId,
  isAdmin = false,
  customerEmail,
}: {
  orderId: string;
  orderNumber: string;
  initialConversationId?: string | null;
  isAdmin?: boolean;
  customerEmail?: string;
}) {
  const [conversationId, setConversationId] = useState<string | null>(initialConversationId ?? null);
  const [conversationStatus, setConversationStatus] = useState<"open" | "closed">("open");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [draft, setDraft] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setConversationId(initialConversationId ?? null);
  }, [initialConversationId]);

  useEffect(() => {
    if (!conversationId) {
      setConversationStatus("open");
      return;
    }

    let active = true;
    const loadConversationStatus = async () => {
      const { data, error } = await supabase
        .from("support_conversations")
        .select("status")
        .eq("id", conversationId)
        .maybeSingle();
      if (active && !error && data) {
        setConversationStatus(data.status === "closed" ? "closed" : "open");
      }
    };

    void loadConversationStatus();
    const channel = supabase
      .channel("order-chat-status-" + conversationId)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "support_conversations", filter: "id=eq." + conversationId },
        payload => {
          const row = payload.new as { status?: string };
          setConversationStatus(row.status === "closed" ? "closed" : "open");
        }
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [conversationId]);

  const loadMessages = useCallback(async () => {
    if (!conversationId) return;
    const { data: authData } = await supabase.auth.getUser();
    if (authData.user) setCurrentUserId(authData.user.id);
    setLoading(true);
    const { data, error } = await supabase
      .from("chat_messages")
      .select("id,sender_id,body,created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    setLoading(false);
    if (error) setMessage(error.message);
    else setMessages((data ?? []) as ChatMessage[]);
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId) return;
    void loadMessages();
    const channel = supabase
      .channel("order-chat-" + conversationId)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_messages", filter: "conversation_id=eq." + conversationId },
        () => { void loadMessages(); }
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [conversationId, loadMessages]);

  async function reportPaid() {
    setBusy(true);
    setMessage("");
    const { data, error } = await supabase.rpc("report_order_payment", { p_order_id: orderId });
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    const result = data as { conversation_id?: string };
    if (result.conversation_id) setConversationId(result.conversation_id);
    setMessage("Payment reported. Your private support chat is open.");
  }

  async function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || !conversationId) return;
    setBusy(true);
    setMessage("");
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      setBusy(false);
      setMessage("Please sign in again to send a message.");
      return;
    }
    const { error } = await supabase.from("chat_messages").insert({
      conversation_id: conversationId,
      sender_id: authData.user.id,
      body,
    });
    setBusy(false);
    if (error) setMessage(error.message);
    else {
      setDraft("");
      await loadMessages();
    }
  }

  if (!conversationId && !isAdmin) {
    return (
      <div style={{ marginTop: 16 }}>
        <button className="btn" type="button" disabled={busy} onClick={reportPaid}>
          {busy ? "Opening chat…" : "I Have Paid"}
        </button>
        <p className="muted" style={{ marginTop: 7 }}>After you send payment, click this to notify the store and open your private order chat.</p>
        {message ? <div className="notice" role="status" style={{ marginTop: 8 }}>{message}</div> : null}
      </div>
    );
  }

  return (
    <section className="product pbody" style={{ marginTop: 16, textAlign: "left" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <b>1-on-1 order chat</b>
          <div className="muted">Order {orderNumber}{customerEmail ? " · " + customerEmail : ""}</div>
        </div>
        <span className="pill">{conversationStatus === "closed" ? "Closed" : "Open"} · Private</span>
      </div>
      <div
        aria-live="polite"
        style={{ display: "grid", gap: 9, marginTop: 14, maxHeight: 330, overflowY: "auto", padding: 4 }}
      >
        {loading ? <div className="muted">Loading messages…</div> : messages.length === 0 ? <div className="muted">No messages yet. Send a message to start the conversation.</div> : messages.map(item => {
          const mine = item.sender_id === currentUserId;
          return (
            <div key={item.id} style={{ justifySelf: mine ? "end" : "start", maxWidth: "88%", background: mine ? "#3a151b" : "#222228", border: "1px solid #393940", borderRadius: 12, padding: "10px 12px" }}>
              <div style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{item.body}</div>
              <div className="muted" style={{ fontSize: 10, marginTop: 6 }}>{mine ? (isAdmin ? "You · Staff" : "You") : (isAdmin ? "Customer" : "Sumz Market Support")} · {new Date(item.created_at).toLocaleString()}</div>
            </div>
          );
        })}
      </div>
{conversationStatus === "closed" ? (
        <div className="notice" role="status" style={{ marginTop: 12 }}>
          This ticket is closed. {isAdmin ? "Reopen the ticket from the admin inbox to send another message." : "Contact Sumz Market support if you need more help."}
        </div>
      ) : (
        <form onSubmit={sendMessage} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, marginTop: 12 }}>
          <textarea className="input" rows={2} maxLength={4000} placeholder={isAdmin ? "Reply to customer or send delivery details…" : "Message Sumz Market support…"} value={draft} onChange={event => setDraft(event.target.value)} />
          <button className="btn" type="submit" disabled={busy || !draft.trim()}>{busy ? "Sending…" : "Send"}</button>
        </form>
      )}
      {message ? <div className="muted" role="status" style={{ marginTop: 8 }}>{message}</div> : null}
      <p className="muted" style={{ marginTop: 8 }}>Messages are visible only to this customer and authorized store staff.</p>
    </section>
  );
}
