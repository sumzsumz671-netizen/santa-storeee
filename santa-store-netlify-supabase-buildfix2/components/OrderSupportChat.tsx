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
  canVouch = false,
}: {
  orderId: string;
  orderNumber: string;
  initialConversationId?: string | null;
  isAdmin?: boolean;
  customerEmail?: string;
  canVouch?: boolean;
}) {
  const [conversationId, setConversationId] = useState<string | null>(initialConversationId ?? null);
  const [conversationStatus, setConversationStatus] = useState<"open" | "closed">("open");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [draft, setDraft] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [vouchOpen, setVouchOpen] = useState(false);
  const [vouchLoading, setVouchLoading] = useState(true);
  const [vouchBusy, setVouchBusy] = useState(false);
  const [vouchRating, setVouchRating] = useState(5);
  const [vouchDiscordTag, setVouchDiscordTag] = useState("");
  const [vouchFeedback, setVouchFeedback] = useState("");
  const [vouchMessage, setVouchMessage] = useState("");
  const [existingVouch, setExistingVouch] = useState<{
    id: string;
    rating: number;
    feedback: string;
    customer_discord_tag: string;
    discord_status: "pending" | "sending" | "sent" | "failed";
  } | null>(null);

  useEffect(() => {
    setConversationId(initialConversationId ?? null);
  }, [initialConversationId]);

  useEffect(() => {
    let active = true;
    if (!canVouch || isAdmin) {
      setVouchLoading(false);
      return () => { active = false; };
    }

    const loadExistingVouch = async () => {
      setVouchLoading(true);
      const { data, error } = await supabase
        .from("order_vouches")
        .select("id,rating,feedback,customer_discord_tag,discord_status")
        .eq("order_id", orderId)
        .maybeSingle();

      if (active) {
        if (!error && data) {
          setExistingVouch(data as {
            id: string;
            rating: number;
            feedback: string;
            customer_discord_tag: string;
            discord_status: "pending" | "sending" | "sent" | "failed";
          });
        }
        setVouchLoading(false);
      }
    };

    void loadExistingVouch();
    return () => { active = false; };
  }, [canVouch, isAdmin, orderId]);

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

  async function postVouchToDiscord(vouchId: string) {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (sessionError || !accessToken) {
      setVouchMessage("Please sign in again before publishing your vouch.");
      return;
    }

    setVouchBusy(true);
    setVouchMessage("");
    try {
      const response = await fetch("/api/discord-vouch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + accessToken,
        },
        body: JSON.stringify({ vouchId }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setVouchMessage(result.error ?? "Your vouch was saved, but Discord could not receive it yet.");
        return;
      }
      setExistingVouch(current => current ? { ...current, discord_status: "sent" } : current);
      setVouchMessage(result.alreadySent ? "Your vouch is already published in Discord." : "Your verified vouch was posted to the Sumz Market Discord channel!");
      setVouchOpen(false);
    } catch {
      setVouchMessage("Your vouch was saved, but Discord could not be reached. You can retry publishing it.");
    } finally {
      setVouchBusy(false);
    }
  }

  async function submitVouch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const discordTag = vouchDiscordTag.trim().replace(/^@/, "");
    const feedback = vouchFeedback.trim();

    if (!/^[A-Za-z0-9_.#-]{2,80}$/.test(discordTag)) {
      setVouchMessage("Enter your Discord username (2–80 letters, numbers, dots, underscores, or hyphens).");
      return;
    }
    if (feedback.length < 5 || feedback.length > 1000) {
      setVouchMessage("Your feedback must be between 5 and 1,000 characters.");
      return;
    }

    setVouchBusy(true);
    setVouchMessage("");
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      setVouchBusy(false);
      setVouchMessage("Please sign in again before leaving a vouch.");
      return;
    }

    const { data, error } = await supabase
      .from("order_vouches")
      .insert({
        order_id: orderId,
        user_id: authData.user.id,
        customer_discord_tag: discordTag,
        rating: vouchRating,
        feedback,
      })
      .select("id,rating,feedback,customer_discord_tag,discord_status")
      .single();

    if (error || !data) {
      setVouchBusy(false);
      setVouchMessage(error?.code === "23505"
        ? "A vouch has already been submitted for this order."
        : error?.message ?? "Your vouch could not be saved. Make sure the order is completed.");
      if (error?.code === "23505") {
        const { data: saved } = await supabase
          .from("order_vouches")
          .select("id,rating,feedback,customer_discord_tag,discord_status")
          .eq("order_id", orderId)
          .maybeSingle();
        if (saved) setExistingVouch(saved as typeof existingVouch);
      }
      return;
    }

    setExistingVouch(data as NonNullable<typeof existingVouch>);
    setVouchDiscordTag(discordTag);
    setVouchFeedback(feedback);
    await postVouchToDiscord(data.id);
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
      {canVouch && !isAdmin ? (
        <div style={{ marginTop: 18, borderTop: "1px solid #393940", paddingTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div>
              <b>Marketplace vouch</b>
              <p className="muted" style={{ margin: "5px 0 0" }}>Your order is completed. Leave feedback to be posted as a verified purchase in our Discord.</p>
            </div>
            {!vouchLoading && !existingVouch ? (
              <button className="btn" type="button" onClick={() => setVouchOpen(value => !value)}>
                {vouchOpen ? "Cancel Vouch" : "Leave a Vouch"}
              </button>
            ) : null}
          </div>

          {vouchLoading ? <div className="muted" style={{ marginTop: 10 }}>Checking vouch status…</div> : null}

          {existingVouch ? (
            <div className="notice" style={{ marginTop: 12 }}>
              <b>Your vouch: {existingVouch.rating}/5</b>
              <p style={{ margin: "6px 0" }}>{existingVouch.feedback}</p>
              <div className="muted">
                {existingVouch.discord_status === "sent"
                  ? "Published to Discord."
                  : existingVouch.discord_status === "sending"
                    ? "Publishing to Discord…"
                    : "Saved, but not published to Discord yet."}
              </div>
              {existingVouch.discord_status !== "sent" ? (
                <button className="btn secondary" type="button" style={{ marginTop: 10 }} disabled={vouchBusy} onClick={() => void postVouchToDiscord(existingVouch.id)}>
                  {vouchBusy ? "Publishing…" : "Retry Discord Post"}
                </button>
              ) : null}
            </div>
          ) : null}

          {vouchOpen && !existingVouch ? (
            <form onSubmit={submitVouch} style={{ display: "grid", gap: 10, marginTop: 12 }}>
              <label className="muted">
                Discord username
                <input className="input" style={{ width: "100%", marginTop: 6 }} maxLength={80} placeholder="e.g. Aramo" value={vouchDiscordTag} onChange={event => setVouchDiscordTag(event.target.value)} />
              </label>
              <div>
                <div className="muted" style={{ marginBottom: 7 }}>Rating</div>
                <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                  {[1, 2, 3, 4, 5].map(rating => (
                    <button key={rating} className={vouchRating === rating ? "btn" : "btn secondary"} type="button" aria-pressed={vouchRating === rating} onClick={() => setVouchRating(rating)}>
                      {rating} ★
                    </button>
                  ))}
                </div>
              </div>
              <label className="muted">
                Feedback
                <textarea className="input" style={{ width: "100%", marginTop: 6 }} rows={3} maxLength={1000} placeholder="Tell everyone about your purchase…" value={vouchFeedback} onChange={event => setVouchFeedback(event.target.value)} />
              </label>
              <button className="btn" type="submit" disabled={vouchBusy || vouchLoading}>
                {vouchBusy ? "Submitting…" : "Submit Vouch"}
              </button>
            </form>
          ) : null}
          {vouchMessage ? <div className="muted" role="status" style={{ marginTop: 9 }}>{vouchMessage}</div> : null}
        </div>
      ) : null}
    </section>
  );
}
