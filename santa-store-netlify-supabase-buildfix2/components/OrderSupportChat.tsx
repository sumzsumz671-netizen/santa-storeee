"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

type ChatMessage = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
  attachment_path: string | null;
  attachment_name: string | null;
  attachment_mime_type: string | null;
  attachment_size_bytes: number | null;
  owner_only: boolean;
  attachment_url?: string | null;
};

export default function OrderSupportChat({
  orderId,
  orderNumber,
  initialConversationId,
  isAdmin = false,
  isOwner = false,
  customerEmail,
  canVouch = false,
  orderCompleted = false,
}: {
  orderId: string;
  orderNumber: string;
  initialConversationId?: string | null;
  isAdmin?: boolean;
  isOwner?: boolean;
  customerEmail?: string;
  canVouch?: boolean;
  orderCompleted?: boolean;
}) {
  const [conversationId, setConversationId] = useState<string | null>(initialConversationId ?? null);
  const [conversationStatus, setConversationStatus] = useState<"open" | "closed">("open");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [draft, setDraft] = useState("");
  const [ownerOnly, setOwnerOnly] = useState(isOwner);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deletingTicket, setDeletingTicket] = useState(false);
  const [vouchOpen, setVouchOpen] = useState(false);
  const [vouchLoading, setVouchLoading] = useState(true);
  const [vouchBusy, setVouchBusy] = useState(false);
  const [vouchRating, setVouchRating] = useState(5);
  const [vouchDiscordTag, setVouchDiscordTag] = useState("");
  const [vouchFeedback, setVouchFeedback] = useState("");
  const [vouchPhoto, setVouchPhoto] = useState<File | null>(null);
  const [vouchPhotoPreview, setVouchPhotoPreview] = useState("");
  const [existingVouchPhotoUrl, setExistingVouchPhotoUrl] = useState("");
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
        .select("id,rating,feedback,customer_discord_tag,discord_status,photo_path")
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
          if (data.photo_path) {
            const { data: signed } = await supabase.storage.from("vouch-photos").createSignedUrl(data.photo_path, 60 * 60);
            if (active) setExistingVouchPhotoUrl(signed?.signedUrl ?? "");
          }
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
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "support_conversations" },
        payload => {
          const deleted = payload.old as { id?: string };
          if (!active || deleted.id !== conversationId) return;
          setConversationId(null);
          setConversationStatus("open");
          setMessages([]);
          setDraft("");
          setMessage("This ticket was deleted. You can click I Have Paid again if you still need support.");
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
      .select("id,sender_id,body,created_at,attachment_path,attachment_name,attachment_mime_type,attachment_size_bytes,owner_only")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error) {
      setLoading(false);
      setMessage(error.message);
      return;
    }

    const withSignedUrls = await Promise.all(
      ((data ?? []) as ChatMessage[]).map(async item => {
        if (!item.attachment_path) return item;
        const { data: signed, error: signedError } = await supabase.storage
          .from("support-attachments")
          .createSignedUrl(item.attachment_path, 60 * 60);
        return {
          ...item,
          attachment_url: signedError ? null : signed?.signedUrl ?? null,
        };
      })
    );

    setLoading(false);
    setMessages(withSignedUrls);
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

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (sessionError || !accessToken) {
      setMessage("Payment reported and your private support chat is open. Sign in again to send the Discord alert.");
      return;
    }

    try {
      const alertResponse = await fetch("/api/discord-order-log", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + accessToken,
        },
        body: JSON.stringify({ orderId }),
      });
      const alertResult = await alertResponse.json().catch(() => ({}));
      if (!alertResponse.ok) {
        setMessage(
          "Payment reported and your private support chat is open. Discord alert failed: " +
          (alertResult.error ?? "Please contact Sumz Market support.")
        );
        return;
      }
      setMessage("Payment reported. Your private support chat is open, and Sumz Market has been notified in the Discord logs channel.");
    } catch {
      setMessage("Payment reported and your private support chat is open, but the Discord alert could not be sent.");
    }
  }

  async function deleteTicket() {
    if (!conversationId || isAdmin) return;
    const confirmed = window.confirm("Delete this support ticket and its chat messages? This cannot be undone.");
    if (!confirmed) return;

    setDeletingTicket(true);
    setMessage("");

    const { data: attachmentRows, error: attachmentReadError } = await supabase
      .from("chat_messages")
      .select("attachment_path")
      .eq("conversation_id", conversationId);

    if (attachmentReadError) {
      setDeletingTicket(false);
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
        setDeletingTicket(false);
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
    setDeletingTicket(false);

    if (error) {
      setMessage("Could not delete your ticket: " + error.message);
      return;
    }
    if (!data) {
      setMessage("Ticket was not found or does not belong to your account.");
      return;
    }

    setConversationId(null);
    setConversationStatus("open");
    setMessages([]);
    setDraft("");
    setMessage("Your ticket was deleted. Click I Have Paid to open a new support chat.");
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
    if (!vouchPhoto) {
      setVouchMessage("Upload a photo or screenshot of your purchase before submitting your vouch.");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(vouchPhoto.type) || vouchPhoto.size > 8 * 1024 * 1024) {
      setVouchMessage("Choose a JPG, PNG, or WEBP image no larger than 8 MB.");
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

    const photoPath = authData.user.id + "/" + orderId + "/" + crypto.randomUUID() + "-" + vouchPhoto.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
    const { error: photoUploadError } = await supabase.storage.from("vouch-photos").upload(photoPath, vouchPhoto, {
      cacheControl: "3600", contentType: vouchPhoto.type, upsert: false,
    });
    if (photoUploadError) {
      setVouchBusy(false);
      setVouchMessage("Photo upload failed: " + photoUploadError.message);
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
        photo_path: photoPath,
      })
      .select("id,rating,feedback,customer_discord_tag,discord_status,photo_path")
      .single();

    if (error || !data) {
      await supabase.storage.from("vouch-photos").remove([photoPath]);
      setVouchBusy(false);
      setVouchMessage(error?.code === "23505"
        ? "A vouch has already been submitted for this order."
        : error?.message ?? "Your vouch could not be saved. Make sure the order is completed.");
      if (error?.code === "23505") {
        const { data: saved } = await supabase
          .from("order_vouches")
          .select("id,rating,feedback,customer_discord_tag,discord_status,photo_path")
          .eq("order_id", orderId)
          .maybeSingle();
        if (saved) setExistingVouch(saved as typeof existingVouch);
      }
      return;
    }

    setExistingVouch(data as NonNullable<typeof existingVouch>);
    setVouchDiscordTag(discordTag);
    setVouchFeedback(feedback);
    setVouchPhoto(null);
    setVouchPhotoPreview("");
    await postVouchToDiscord(data.id);
  }

  async function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if ((!body && selectedFiles.length === 0) || !conversationId) return;

    const allowedTypes = new Set([
      "image/jpeg", "image/png", "image/webp", "image/gif",
      "video/mp4", "video/webm", "video/quicktime",
    ]);
    const maxFileSize = 25 * 1024 * 1024;

    if (selectedFiles.length > 5) {
      setMessage("You can attach up to 5 files per message.");
      return;
    }
    for (const file of selectedFiles) {
      if (!allowedTypes.has(file.type)) {
        setMessage("Only JPG, PNG, WEBP, GIF, MP4, WEBM, and MOV files are supported.");
        return;
      }
      if (file.size > maxFileSize) {
        setMessage("Each attachment must be 25 MB or smaller: " + file.name);
        return;
      }
    }

    setBusy(true);
    setMessage("");
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      setBusy(false);
      setMessage("Please sign in again to send a message.");
      return;
    }

    if (selectedFiles.length === 0) {
      const { error } = await supabase.from("chat_messages").insert({
        conversation_id: conversationId,
        sender_id: authData.user.id,
        body,
        owner_only: isOwner && ownerOnly,
      });
      setBusy(false);
      if (error) setMessage(error.message);
      else {
        setDraft("");
        setOwnerOnly(isOwner);
        await loadMessages();
      }
      return;
    }

    try {
      for (let index = 0; index < selectedFiles.length; index++) {
        const file = selectedFiles[index];
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100) || "attachment";
        const storagePath = conversationId + "/" + authData.user.id + "/" + crypto.randomUUID() + "-" + safeName;

        const { error: uploadError } = await supabase.storage
          .from("support-attachments")
          .upload(storagePath, file, {
            cacheControl: "3600",
            contentType: file.type,
            upsert: false,
          });

        if (uploadError) throw new Error("Could not upload " + file.name + ": " + uploadError.message);

        const messageBody = index === 0 && body
          ? body
          : "Shared an attachment: " + file.name;

        const { error: insertError } = await supabase.from("chat_messages").insert({
          conversation_id: conversationId,
          sender_id: authData.user.id,
          body: messageBody,
          attachment_path: storagePath,
          attachment_name: file.name.slice(0, 255),
          attachment_mime_type: file.type,
          attachment_size_bytes: file.size,
          owner_only: isOwner && ownerOnly,
        });

        if (insertError) {
          await supabase.storage.from("support-attachments").remove([storagePath]);
          throw new Error("Could not save " + file.name + " to the chat: " + insertError.message);
        }
      }

      setDraft("");
      setSelectedFiles([]);
      setOwnerOnly(isOwner);
      if (uploadInputRef.current) uploadInputRef.current.value = "";
      setMessage("Message and attachment(s) sent.");
      await loadMessages();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not send your attachment.");
    } finally {
      setBusy(false);
    }
  }

  const vouchPanel = canVouch && !isAdmin ? (
    <div style={{ marginTop: 18, borderTop: "1px solid #393940", paddingTop: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div>
          <b>Marketplace vouch</b>
          <p className="muted" style={{ margin: "5px 0 0" }}>
            {orderCompleted
              ? "Your order is completed. Leave feedback to be posted as a verified purchase in our Discord."
              : "The vouch button becomes available after your order is marked completed."}
          </p>
        </div>
        {!vouchLoading && !existingVouch ? (
          <button
            className="btn"
            type="button"
            title={!orderCompleted ? "Available after the order is completed" : "Leave a vouch"}
            onClick={() => {
              if (!orderCompleted) {
                setVouchMessage("Your vouch unlocks after Sumz Market marks this order as Completed.");
                return;
              }
              setVouchMessage("");
              setVouchOpen(value => !value);
            }}
          >
            {vouchOpen ? "Cancel Vouch" : "Leave a Vouch"}
          </button>
        ) : null}
      </div>

      {vouchLoading ? <div className="muted" style={{ marginTop: 10 }}>Checking vouch status…</div> : null}

      {existingVouch ? (
        <div className="notice" style={{ marginTop: 12 }}>
          <b>Your vouch: {existingVouch.rating}/5</b>
          <p style={{ margin: "6px 0" }}>{existingVouch.feedback}</p>
          {existingVouchPhotoUrl ? <a href={existingVouchPhotoUrl} target="_blank" rel="noopener noreferrer"><img src={existingVouchPhotoUrl} alt="Your submitted purchase proof" style={{ maxWidth: 220, maxHeight: 180, objectFit: "contain", borderRadius: 10, border: "1px solid #477d35", marginTop: 8 }} /></a> : null}
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

      {vouchOpen && !existingVouch && orderCompleted ? (
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
          <label className="muted" style={{ display: "grid", gap: 8 }}>
            Purchase photo <strong style={{ color: "#a5ff52" }}>REQUIRED</strong>
            <span>Upload a screenshot or photo showing your purchase. JPG, PNG, or WEBP · up to 8 MB.</span>
            <input className="input" type="file" accept="image/jpeg,image/png,image/webp" required onChange={event => {
              const file = event.target.files?.[0] ?? null;
              setVouchPhoto(file);
              setVouchPhotoPreview(file ? URL.createObjectURL(file) : "");
              setVouchMessage("");
            }} />
            {vouchPhotoPreview ? <img src={vouchPhotoPreview} alt="Vouch photo preview" style={{ maxWidth: 220, maxHeight: 180, objectFit: "contain", borderRadius: 10, border: "1px solid #477d35" }} /> : null}
          </label>
          <button className="btn" type="submit" disabled={vouchBusy || vouchLoading || !vouchPhoto}>
            {vouchBusy ? "Submitting…" : "Submit Vouch"}
          </button>
        </form>
      ) : null}
      {vouchMessage ? <div className="muted" role="status" style={{ marginTop: 9 }}>{vouchMessage}</div> : null}
    </div>
  ) : null;

  if (!conversationId && !isAdmin) {
    return (
      <div style={{ marginTop: 16 }}>
        <button className="btn" type="button" disabled={busy} onClick={reportPaid}>
          {busy ? "Opening chat…" : "I Have Paid"}
        </button>
        <p className="muted" style={{ marginTop: 7 }}>After you send payment, click this to notify the store and open your private order chat.</p>
        {message ? <div className="notice" role="status" style={{ marginTop: 8 }}>{message}</div> : null}
        {vouchPanel}
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
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span className="pill">{conversationStatus === "closed" ? "Closed" : "Open"} · Private</span>
          {!isAdmin ? (
            <button className="btn secondary" type="button" disabled={deletingTicket} onClick={() => void deleteTicket()}>
              {deletingTicket ? "Deleting…" : "Delete Ticket"}
            </button>
          ) : null}
        </div>
      </div>
      <div
        aria-live="polite"
        style={{ display: "grid", gap: 9, marginTop: 14, maxHeight: 330, overflowY: "auto", padding: 4 }}
      >
        {loading ? <div className="muted">Loading messages…</div> : messages.length === 0 ? <div className="muted">No messages yet. Send a message to start the conversation.</div> : messages.map(item => {
          const mine = item.sender_id === currentUserId;
          return (
            <div key={item.id} style={{ justifySelf: mine ? "end" : "start", maxWidth: "88%", background: mine ? "#3a151b" : "#222228", border: "1px solid #393940", borderRadius: 12, padding: "10px 12px" }}>
              {isOwner && item.owner_only ? <div className="pill" style={{ marginBottom: 7 }}>Owner-only · hidden from staff</div> : null}
              <div style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{item.body}</div>
              {item.attachment_path ? (
                <div style={{ marginTop: 9, display: "grid", gap: 6 }}>
                  {item.attachment_url && item.attachment_mime_type?.startsWith("image/") ? (
                    <a href={item.attachment_url} target="_blank" rel="noopener noreferrer">
                      <img
                        src={item.attachment_url}
                        alt={item.attachment_name ?? "Customer attachment"}
                        style={{ display: "block", maxWidth: "100%", maxHeight: 260, borderRadius: 9, objectFit: "contain", background: "#08060d" }}
                      />
                    </a>
                  ) : item.attachment_url && item.attachment_mime_type?.startsWith("video/") ? (
                    <video
                      src={item.attachment_url}
                      controls
                      preload="metadata"
                      style={{ display: "block", width: "min(100%, 460px)", maxHeight: 280, borderRadius: 9, background: "#08060d" }}
                    />
                  ) : (
                    <div className="muted">Attachment preview unavailable. Refresh the chat to try again.</div>
                  )}
                  {item.attachment_url ? (
                    <a href={item.attachment_url} target="_blank" rel="noopener noreferrer" style={{ color: "#d8a8ff", fontSize: 12, textDecoration: "underline", overflowWrap: "anywhere" }}>
                      {item.attachment_name ?? "Open attachment"}
                    </a>
                  ) : null}
                  {typeof item.attachment_size_bytes === "number" ? (
                    <span className="muted" style={{ fontSize: 10 }}>
                      {(item.attachment_size_bytes / (1024 * 1024)).toFixed(2)} MB
                    </span>
                  ) : null}
                </div>
              ) : null}
              <div className="muted" style={{ fontSize: 10, marginTop: 6 }}>{mine ? (isAdmin ? (isOwner ? "You · Owner" : "You · Staff") : "You") : (isAdmin ? "Customer" : "Sumz Market Support")} · {new Date(item.created_at).toLocaleString()}</div>
            </div>
          );
        })}
      </div>
{conversationStatus === "closed" ? (
        <div className="notice" role="status" style={{ marginTop: 12 }}>
          This ticket is closed. {isAdmin ? "Reopen the ticket from the admin inbox to send another message." : "Contact Sumz Market support if you need more help."}
        </div>
      ) : (
        <form onSubmit={sendMessage} style={{ display: "grid", gap: 9, marginTop: 12 }}>
          {isOwner ? (
            <label className="muted" style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 11px", border: "1px solid #704191", borderRadius: 10, background: "#1b1025" }}>
              <input type="checkbox" checked={ownerOnly} onChange={event => setOwnerOnly(event.target.checked)} disabled={busy} />
              <span><b style={{ color: "#e4c6ff" }}>Private delivery details</b> — only you and the customer can see this message or its attachments. Staff cannot view it.</span>
            </label>
          ) : null}
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "stretch" }}>
            <textarea
              className="input"
              rows={2}
              maxLength={4000}
              placeholder={isAdmin ? "Reply to customer or send delivery details…" : "Message Sumz Market support…"}
              value={draft}
              onChange={event => setDraft(event.target.value)}
              disabled={busy}
            />
            <button className="btn" type="submit" disabled={busy || (!draft.trim() && selectedFiles.length === 0)}>
              {busy ? "Sending…" : "Send"}
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <input
              ref={uploadInputRef}
              id={"support-attachments-" + orderId}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
              multiple
              style={{ display: "none" }}
              disabled={busy}
              onChange={event => {
                const incoming = Array.from(event.target.files ?? []);
                setSelectedFiles(current => [...current, ...incoming].slice(0, 5));
                event.target.value = "";
              }}
            />
            <label
              className="btn secondary"
              htmlFor={"support-attachments-" + orderId}
              style={{ cursor: busy ? "not-allowed" : "pointer", opacity: busy ? .6 : 1 }}
            >
              📎 Attach screenshots/videos
            </label>
            <span className="muted" style={{ fontSize: 11 }}>Up to 5 files · 25 MB each</span>
          </div>
          {selectedFiles.length ? (
            <div style={{ display: "grid", gap: 6 }}>
              {selectedFiles.map((file, index) => (
                <div key={file.name + file.size + index} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "7px 9px", background: "#171021", border: "1px solid #3b2a4a", borderRadius: 8 }}>
                  <span className="muted" style={{ overflowWrap: "anywhere" }}>{file.name} · {(file.size / (1024 * 1024)).toFixed(2)} MB</span>
                  <button className="btn secondary" type="button" disabled={busy} onClick={() => setSelectedFiles(current => current.filter((_, i) => i !== index))}>Remove</button>
                </div>
              ))}
            </div>
          ) : null}
        </form>
      )}
      {message ? <div className="muted" role="status" style={{ marginTop: 8 }}>{message}</div> : null}
      <p className="muted" style={{ marginTop: 8 }}>Customers and authorized staff can see regular chat messages. Private delivery details sent by the owner are visible only to the owner and that customer.</p>
      {vouchPanel}
    </section>
  );
}
