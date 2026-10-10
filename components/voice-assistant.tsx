"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Anchor,
  ArrowUp,
  ArrowUpRight,
  Mic,
  MicOff,
  Square,
  Plus,
  Sparkles,
  X,
  AudioLines,
} from "lucide-react";
import { VoiceClient, type Transcript } from "@/lib/voice-client";
type Props = {
  demo: boolean;
  name: string;
  welcome: string;
  language: string;
  maxDuration: number;
  unavailable?: boolean;
};
export default function VoiceAssistant(props: Props) {
  const [language, setLanguage] = useState(props.language);
  const [state, setState] = useState("idle");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [voiceMode, setVoiceMode] = useState(true);
  const starting = useRef(false);
  const submitting = useRef(false);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState("");
  const [transcript, setTranscript] = useState<Transcript[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const questionInput = useRef<HTMLInputElement>(null);
  const client = useRef<VoiceClient | null>(null);
  const demoTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const started = useRef(0);
  const transcriptEnd = useRef<HTMLDivElement>(null);
  const running = ["connecting", "listening", "thinking", "speaking"].includes(
    state,
  );
  useEffect(() => {
    if (!running) return;
    const id = setInterval(
      () => setElapsed(Math.floor((Date.now() - started.current) / 1000)),
      1000,
    );
    return () => clearInterval(id);
  }, [running]);
  useEffect(() => {
    transcriptEnd.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [transcript]);
  useEffect(() => {
    const end = () => {
      void client.current?.stop("DISCONNECTED", "page_closed");
    };
    window.addEventListener("pagehide", end);
    return () => {
      end();
      demoTimers.current.forEach(clearTimeout);
      setState((s) =>
        ["connecting", "listening", "thinking", "speaking"].includes(s)
          ? "ended"
          : s,
      );
      window.removeEventListener("pagehide", end);
    };
  }, []);
  async function start(microphone = true) {
    if (running || starting.current || props.unavailable) return;
    starting.current = true;
    setVoiceMode(microphone);
    try {
      setError("");
      setTranscript([]);
      setMuted(false);
      setElapsed(0);
      started.current = Date.now();
      if (props.demo) {
        setState("listening");
        const messages: [number, Transcript["speaker"], string][] = [
          [1000, "user", "Hello! How can I arrange a visit?"],
          [
            3000,
            "assistant",
            "Hello, I’m the Mercantile Marine Academy assistant. Our admissions team can confirm campus visit availability. I don’t have verified visiting hours or contact details yet.",
          ],
          [6500, "user", "Can we speak in Bengali or Hindi?"],
          [
            8500,
            "assistant",
            "Of course. In a live conversation, you can speak naturally in English, বাংলা, or हिन्दी. This is a sample transcript; no microphone or Gemini connection is active.",
          ],
        ];
        for (const [delay, speaker, text] of messages)
          demoTimers.current.push(
            setTimeout(() => {
              setState(speaker === "user" ? "thinking" : "speaking");
              setTranscript((t) => [
                ...t,
                {
                  eventId: `demo-${delay}`,
                  speaker,
                  text,
                  sequence: t.length,
                  final: true,
                },
              ]);
            }, delay),
          );
        demoTimers.current.push(setTimeout(() => setState("ended"), 12000));
        return;
      }
      client.current = new VoiceClient(setState, setTranscript, setError);
      return await client.current.start(language, microphone);
    } finally {
      starting.current = false;
    }
  }
  async function sendQuestion() {
    const text = draft.trim();
    if (
      !text ||
      text.length > 4000 ||
      props.unavailable ||
      state === "connecting" ||
      submitting.current ||
      starting.current
    )
      return;
    submitting.current = true;
    setSending(true);
    try {
      if (props.demo) {
        setError(
          "Live answers are not enabled in this demo. Ask the administrator to enable live conversations.",
        );
        return;
      }
      if (!running && !(await start(false))) return;
      if (client.current?.sendText(text)) setDraft("");
    } finally {
      submitting.current = false;
      setSending(false);
    }
  }
  function end() {
    demoTimers.current.forEach(clearTimeout);
    demoTimers.current = [];
    void client.current?.stop();
    setState("ended");
  }
  const displayState =
    props.demo && running
      ? "Sample conversation"
      : state === "idle"
        ? "Ready when you are"
        : state === "ended"
          ? "Conversation ended"
          : muted
            ? "Microphone muted"
            : state === "connecting"
              ? "Connecting securely…"
              : state === "listening"
                ? voiceMode
                  ? "I’m listening…"
                  : "Ready for your next question"
                : state === "thinking"
                  ? "Thinking…"
                  : `${props.name} is speaking…`;
  const voiceLabel =
    state === "ended"
      ? "Start a new conversation"
      : props.demo
        ? "Try a sample conversation"
        : "Start conversation";
  const showWave =
    running && voiceMode && !muted && !draft && state !== "connecting";
  return (
    <div className="mma-chat">
      <header className="chat-topbar">
        <Link href="/" className="chat-wordmark">
          <Anchor size={21} />
          <span>Mercantile Marine Academy</span>
        </Link>
        <Link href="/admin" className="chat-admin">
          Admin dashboard <ArrowUpRight size={15} />
        </Link>
      </header>
      <main className={`chat-stage ${transcript.length ? "has-messages" : ""}`}>
        {!transcript.length && (
          <div className="chat-greeting">
            <h1>Where should we start?</h1>
            <p>Ask anything. Type a thought, or say it out loud.</p>
          </div>
        )}
        {transcript.length > 0 && (
          <section className="chat-history" aria-label="Conversation">
            <div className="chat-history-heading">
              <span>
                {props.demo ? "Sample conversation" : "Your conversation"}
              </span>
              {!running && (
                <button
                  type="button"
                  onClick={() => {
                    setTranscript([]);
                    setState("idle");
                    setDraft("");
                    questionInput.current?.focus();
                  }}
                >
                  New conversation <Plus size={15} />
                </button>
              )}
            </div>
            <div
              role="log"
              aria-label="Conversation transcript"
              aria-live="polite"
            >
              {transcript.map((message) => (
                <article
                  className={`chat-message ${message.speaker}`}
                  key={message.eventId}
                >
                  <span className="chat-speaker">
                    {message.speaker === "assistant" ? (
                      <>
                        <Sparkles size={16} />
                        {props.name}
                      </>
                    ) : (
                      "You"
                    )}
                  </span>
                  <p>{message.text}</p>
                </article>
              ))}
              <div ref={transcriptEnd} />
            </div>
          </section>
        )}
        <div className="chat-input-area">
          {props.unavailable && (
            <div className="chat-alert" role="alert">
              Conversations are temporarily unavailable. Please try again later.
            </div>
          )}
          {error && (
            <div className="chat-alert" role="alert">
              <span>{error}</span>
              <button
                type="button"
                onClick={() => setError("")}
                aria-label="Dismiss error"
              >
                <X size={17} />
              </button>
            </div>
          )}
          <form
            className="chat-composer"
            onSubmit={(event) => {
              event.preventDefault();
              void sendQuestion();
            }}
          >
            <div className="chat-options">
              <button
                type="button"
                className="chat-icon"
                aria-label="Conversation options"
                aria-expanded={optionsOpen}
                aria-controls="chat-options-panel"
                onClick={() => setOptionsOpen(!optionsOpen)}
              >
                <Plus size={25} />
              </button>
              {optionsOpen && (
                <div id="chat-options-panel" className="chat-options-panel">
                  <span>Try a question</span>
                  {[
                    "Why is the sky blue?",
                    "Help me write a friendly email",
                    "Explain artificial intelligence simply",
                  ].map((question) => (
                    <button
                      type="button"
                      key={question}
                      onClick={() => {
                        setDraft(question);
                        setOptionsOpen(false);
                        questionInput.current?.focus();
                      }}
                    >
                      {question}
                    </button>
                  ))}
                  <p>
                    Type a question or use the microphone. Answers are spoken
                    aloud and appear in your conversation.
                  </p>
                </div>
              )}
            </div>
            <div className={`chat-entry ${showWave ? "with-wave" : ""}`}>
              <label className="sr-only" htmlFor="question">
                Your question
              </label>
              <input
                ref={questionInput}
                id="question"
                value={draft}
                maxLength={4000}
                autoComplete="off"
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Ask the academy…"
                disabled={
                  props.unavailable || sending || state === "connecting"
                }
              />
              {showWave && (
                <div className="chat-wave" aria-hidden="true">
                  {Array.from({ length: 48 }, (_, i) => (
                    <i
                      key={i}
                      style={{
                        height: `${4 + (Math.sin(i * 0.7) + 1) * 7}px`,
                        animationDelay: `${i * -0.09}s`,
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
            {!running && (
              <div className="chat-language">
                <label className="sr-only" htmlFor="language">
                  Conversation language
                </label>
                <select
                  id="language"
                  value={language}
                  onChange={(event) => setLanguage(event.target.value)}
                >
                  <option value="English">English</option>
                  <option value="Bengali">বাংলা</option>
                  <option value="Hindi">हिन्दी</option>
                </select>
              </div>
            )}
            {running && (
              <>
                {voiceMode && (
                  <button
                    type="button"
                    className="chat-icon"
                    disabled={props.demo || state === "connecting"}
                    aria-label={muted ? "Unmute microphone" : "Mute microphone"}
                    aria-pressed={muted}
                    onClick={() => {
                      client.current?.mute(!muted);
                      setMuted(!muted);
                    }}
                  >
                    {muted ? <MicOff size={20} /> : <Mic size={20} />}
                  </button>
                )}
                <button
                  type="button"
                  className="chat-icon chat-stop"
                  onClick={end}
                  aria-label="End conversation"
                  title="End conversation"
                >
                  <Square size={14} fill="currentColor" />
                </button>
              </>
            )}
            {draft.trim() ? (
              <button
                type="submit"
                className="chat-icon chat-send"
                aria-label="Send question"
                disabled={
                  props.unavailable || sending || state === "connecting"
                }
              >
                <ArrowUp size={24} />
              </button>
            ) : (
              !running && (
                <button
                  type="button"
                  className="chat-icon chat-mic"
                  aria-label={voiceLabel}
                  title={voiceLabel}
                  disabled={props.unavailable || sending}
                  onClick={() => void start()}
                >
                  <Mic size={23} />
                </button>
              )
            )}
          </form>
          <div className="chat-status" role="status">
            {running ? (
              <>
                <AudioLines size={14} />
                <span>{displayState}</span>
                <span className="chat-timer">
                  {String(Math.floor(elapsed / 60)).padStart(2, "0")}:
                  {String(elapsed % 60).padStart(2, "0")} /{" "}
                  {Math.floor(props.maxDuration / 60)} min
                </span>
              </>
            ) : (
              <span>
                {props.demo
                  ? "Demo preview · sample conversation only"
                  : state === "ended"
                    ? "Conversation ended · start again whenever you’re ready"
                    : "English, বাংলা, हिन्दी · powered by Gemini"}
              </span>
            )}
          </div>
        </div>
      </main>
      <footer className="chat-footer">
        A little clarity, one conversation at a time.
      </footer>
    </div>
  );
}
