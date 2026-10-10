"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Trash2,
  MessageSquareText,
  AudioLines,
  RefreshCw,
  Info,
} from "lucide-react";
import { api, duration, Status, type SessionRow } from "./admin-dashboard";
import { Button } from "./ui/button";
type Detail = SessionRow & {
  reason: string | null;
  settingsSnapshot: Record<string, unknown>;
  usageTotals: Record<string, unknown>;
  transcripts: {
    id: string;
    speaker: string;
    text: string;
    final: boolean;
    timestamp: string;
  }[];
  usageEvents: {
    id: string;
    raw: unknown;
    normalized: unknown;
    counterMode: string;
    trust: string;
    timestamp: string;
  }[];
  pricing: unknown;
};
export default function SessionDetail({ id }: { id: string }) {
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  useEffect(() => {
    api<Detail>(`sessions?id=${id}`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [id]);
  async function remove() {
    setBusy(true);
    try {
      await api("sessions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      router.push("/admin/sessions");
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <>
      <Link className="back-link" href="/admin/sessions">
        <ArrowLeft size={16} />
        All conversations
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">CONVERSATION DETAILS</span>
          <h1>A closer listen.</h1>
          <p>Session {id}</p>
        </div>
        {data && (
          <Button
            variant="outline"
            disabled={
              data.demo ||
              ["ACTIVE", "CONNECTING", "CREATED"].includes(data.status)
            }
            onClick={() => setConfirm(true)}
          >
            <Trash2 size={16} />
            Delete session
          </Button>
        )}
      </div>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      {confirm && (
        <div className="notice error">
          Delete this session, its transcript, and all usage events? This cannot
          be undone.
          <Button size="sm" disabled={busy} onClick={remove}>
            Delete permanently
          </Button>
          <Button size="sm" variant="outline" onClick={() => setConfirm(false)}>
            Cancel
          </Button>
        </div>
      )}
      {!data && !error ? (
        <div className="loading-state">
          <RefreshCw className="spin" />
          Loading conversation…
        </div>
      ) : (
        data && (
          <>
            <div className="detail-stats">
              <div>
                <small>Status</small>
                <Status status={data.status} />
              </div>
              <div>
                <small>Duration</small>
                <strong>{duration(data.duration)}</strong>
              </div>
              <div>
                <small>Language</small>
                <strong>{data.language}</strong>
              </div>
              <div>
                <small>Estimated API Cost</small>
                <strong>
                  {data.estimatedCost
                    ? `$${data.estimatedCost}`
                    : data.costStatus === "PRICING_UNAVAILABLE"
                      ? "Pricing unavailable"
                      : "Incomplete"}
                </strong>
              </div>
            </div>
            {data.reason && (
              <div className="notice">
                <Info size={16} />
                {data.reason}
              </div>
            )}
            <div className="detail-columns">
              <section className="panel">
                <div className="panel-heading">
                  <h2>
                    <MessageSquareText size={19} />
                    Conversation transcript
                  </h2>
                  <span className="subtle-tag">
                    {data.demo ? "SAMPLE" : "RECORDED TEXT"}
                  </span>
                </div>
                <div className="messages detail-messages">
                  {data.transcripts.length ? (
                    data.transcripts.map((m) => (
                      <div className={`message ${m.speaker}`} key={m.id}>
                        <span className="message-avatar">
                          {m.speaker === "assistant" ? (
                            <AudioLines size={17} />
                          ) : (
                            "V"
                          )}
                        </span>
                        <div>
                          <span className="message-name">
                            {m.speaker === "assistant"
                              ? "MMA Assistant"
                              : "Visitor"}
                            <small>{m.final ? "" : " · partial"}</small>
                          </span>
                          <p>{m.text}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="empty-state">
                      <MessageSquareText />
                      <h3>No transcript available</h3>
                      <p>
                        No text was recorded, or the retention period has
                        passed.
                      </p>
                    </div>
                  )}
                </div>
              </section>
              <section className="panel form-panel">
                <h2>Session snapshot</h2>
                <dl className="snapshot">
                  <dt>Model</dt>
                  <dd>{data.model}</dd>
                  <dt>Started</dt>
                  <dd>
                    {new Date(data.startedAt).toLocaleString("en-GB", {
                      timeZone: String(
                        data.settingsSnapshot.timezone ?? "Asia/Kolkata",
                      ),
                    })}
                  </dd>
                  <dt>Timezone</dt>
                  <dd>
                    {String(data.settingsSnapshot.timezone ?? "Asia/Kolkata")}
                  </dd>
                  <dt>Cost completeness</dt>
                  <dd>{data.costStatus}</dd>
                  <dt>Source</dt>
                  <dd>
                    {data.demo ? "Demo example" : "Browser · provisional"}
                  </dd>
                </dl>
                <details>
                  <summary>Settings at session start</summary>
                  <pre>{JSON.stringify(data.settingsSnapshot, null, 2)}</pre>
                </details>
                <details>
                  <summary>Pricing version</summary>
                  <pre>
                    {data.pricing
                      ? JSON.stringify(data.pricing, null, 2)
                      : "Pricing unavailable"}
                  </pre>
                </details>
                <details open>
                  <summary>Available usage snapshot</summary>
                  <pre>{JSON.stringify(data.usageTotals, null, 2)}</pre>
                </details>
              </section>
            </div>
            <section className="panel form-panel usage-events">
              <h2>Provider usage events</h2>
              <p className="muted-text">
                Raw metadata is retained. Browser events are provisional;
                unknown counter periods are not summed.
              </p>
              {data.usageEvents.length ? (
                data.usageEvents.map((event, i) => (
                  <details key={event.id}>
                    <summary>
                      Event {i + 1} · {event.counterMode} · {event.trust}
                    </summary>
                    <pre>{JSON.stringify(event.raw, null, 2)}</pre>
                  </details>
                ))
              ) : (
                <p className="muted-text">
                  No provider usage events are available for this session.
                </p>
              )}
            </section>
          </>
        )
      )}
    </>
  );
}
