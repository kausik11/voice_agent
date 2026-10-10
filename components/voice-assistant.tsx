"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  ArrowRight,
  Mic,
  MicOff,
  Square,
  MessageSquareText,
  ShieldCheck,
  Globe2,
  HeartHandshake,
  Sparkles,
  Headphones,
  ChevronRight,
  RotateCcw,
  CircleHelp,
  AudioLines,
  Check,
  Send,
} from "lucide-react";
import { Brand } from "./brand";
import { Button } from "./ui/button";
import { VoiceClient, type Transcript } from "@/lib/voice-client";
type Props = {
  demo: boolean;
  name: string;
  welcome: string;
  language: string;
  maxDuration: number;
  retentionDays: number;
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
  const [consent, setConsent] = useState(false);
  const [topic, setTopic] = useState<string | null>(null);
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
    if (running || starting.current || !consent || props.unavailable) return;
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
            "Hello, I’m Medha. A staff member will need to confirm appointment availability and the booking procedure. I don’t have approved contact information yet.",
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
      !consent ||
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
  const topics = [
    {
      icon: Sparkles,
      title: "Learn something new",
      description: "Science, technology, and everyday questions",
      text: "Try asking: Why is the sky blue? You can also ask for writing help, explanations, or ideas on any topic.",
    },
    {
      icon: HeartHandshake,
      title: "Services & support",
      description: "Find the right information",
      text: "Ask about the support you are looking for. For Foundation services, Medha uses approved information and refers missing details to a staff member.",
    },
    {
      icon: Globe2,
      title: "Our centres",
      description: "Plan your next visit",
      text: "Ask about centre locations and visiting hours. Addresses and timings must be confirmed by staff until approved information is added.",
    },
    {
      icon: Headphones,
      title: "Appointments",
      description: "Understand the next steps",
      text: "Ask how to arrange an appointment. A staff member needs to confirm the booking procedure and availability.",
    },
  ];
  return (
    <div className="public-app">
      <header className="public-header">
        <Brand />
        <nav>
          <a href="#how-it-works">How it works</a>
          <Link href="/admin">
            Admin dashboard <ArrowUpRight size={15} />
          </Link>
        </nav>
      </header>
      <main className="public-main">
        <div className="public-intro">
          <span className="eyebrow">
            <span className="red-dot" /> HERE TO LISTEN. HERE TO HELP.
          </span>
          <h1>{props.welcome}</h1>
          <p>
            Meet {props.name}, your AI companion for questions on any topic.
            <br className="desktop-break" /> Speak naturally or type a question.
            Get a spoken answer and follow along in the conversation.
          </p>
        </div>
        {props.demo && (
          <div className="demo-note">
            <Sparkles size={15} />
            <span>
              <strong>You’re exploring a demo.</strong> Try a sample
              conversation. No audio is recorded or sent.
            </span>
            <Link href="/admin/login">
              Explore dashboard <ArrowRight size={14} />
            </Link>
          </div>
        )}
        {props.unavailable && (
          <div className="notice error" role="alert">
            Conversations are temporarily unavailable. Please try again later.
          </div>
        )}
        <div className="conversation-layout">
          <section className="voice-card">
            <div className="card-topline">
              <span className="mini-label">
                <AudioLines size={16} /> YOUR VOICE ASSISTANT
              </span>
              <span className={`status-pill ${running ? "online" : ""}`}>
                <i />
                {running ? "In conversation" : "Available"}
              </span>
            </div>
            <div
              className={`orb-scene ${running ? "orb-active" : ""}`}
              aria-hidden="true"
            >
              <div className="orbit orbit-one" />
              <div className="orbit orbit-two" />
              <div className="orb">
                <div className="orb-shine" />
                <div className="waveform">
                  {[19, 35, 49, 30, 61, 43, 26, 45, 22].map((h, i) => (
                    <span
                      key={i}
                      style={{ height: h, animationDelay: `${i * 0.13}s` }}
                    />
                  ))}
                </div>
              </div>
              <span className="orb-spark spark-one">✦</span>
              <span className="orb-spark spark-two">✧</span>
            </div>
            <div className="voice-title">
              <h2>
                Hi, I’m {props.name}
                <span>✳</span>
              </h2>
              <p aria-live="polite">{displayState}</p>
            </div>
            <div className="language-select">
              <Globe2 size={15} />
              <label className="sr-only" htmlFor="language">
                Conversation language
              </label>
              <select
                id="language"
                value={language}
                disabled={running}
                onChange={(e) => setLanguage(e.target.value)}
              >
                <option value="English">English</option>
                <option value="Bengali">বাংলা · Bengali</option>
                <option value="Hindi">हिन्दी · Hindi</option>
              </select>
            </div>
            <div className="voice-actions">
              {!running ? (
                <Button
                  onClick={() => void start()}
                  disabled={!consent || props.unavailable || sending}
                  className="start-button"
                >
                  <Mic size={19} />
                  {state === "ended"
                    ? "Start a new conversation"
                    : props.demo
                      ? "Try a sample conversation"
                      : "Start conversation"}
                  <ArrowRight size={17} />
                </Button>
              ) : (
                <>
                  <Button onClick={end}>
                    <Square size={16} fill="currentColor" />
                    End conversation
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={
                      props.demo || !voiceMode || state === "connecting"
                    }
                    onClick={() => {
                      client.current?.mute(!muted);
                      setMuted(!muted);
                    }}
                    aria-label={muted ? "Unmute microphone" : "Mute microphone"}
                    aria-pressed={muted}
                  >
                    {muted ? <MicOff size={19} /> : <Mic size={19} />}
                  </Button>
                </>
              )}
            </div>
            <p className="voice-hint">
              {running
                ? `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")} · ${props.demo ? "Scripted preview · no audio" : `Up to ${Math.floor(props.maxDuration / 60)} minutes`}`
                : "Speak or type. Typed questions don’t need microphone access."}
            </p>
            <div className="consent-area">
              <ShieldCheck size={17} />
              <label>
                <input
                  type="checkbox"
                  checked={consent}
                  disabled={running}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                <span>
                  I understand that live conversations are transcribed and kept
                  for up to {props.retentionDays} days. Raw audio is not stored
                  by this app.
                </span>
              </label>
            </div>
            {error && (
              <div className="notice error" role="alert">
                {error}
                <button onClick={() => setError("")} aria-label="Dismiss error">
                  ×
                </button>
              </div>
            )}
          </section>
          <section className="transcript-card">
            <div className="transcript-header">
              <div>
                <MessageSquareText size={19} />
                <h2>Conversation</h2>
              </div>
              <span className="mini-label">
                {props.demo ? "SAMPLE TRANSCRIPT" : "LIVE TRANSCRIPT"}
              </span>
            </div>
            <div
              className="transcript-body"
              role="log"
              aria-label="Conversation transcript"
              aria-live="polite"
            >
              {transcript.length === 0 ? (
                <div className="transcript-empty">
                  <span className="empty-icon">
                    <MessageSquareText size={27} />
                    <span className="small-spark">✦</span>
                  </span>
                  <h3>A conversation starts with hello.</h3>
                  <p>
                    Your words and {props.name}’s responses will
                    <br />
                    appear here as you speak or type.
                  </p>
                  <span className="empty-line" />
                  <span className="empty-line short" />
                </div>
              ) : (
                <div className="messages">
                  {transcript.map((m) => (
                    <div key={m.eventId} className={`message ${m.speaker}`}>
                      <div className="message-avatar">
                        {m.speaker === "assistant" ? (
                          <AudioLines size={17} />
                        ) : (
                          "Y"
                        )}
                      </div>
                      <div>
                        <span className="message-name">
                          {m.speaker === "assistant" ? props.name : "You"}
                          <small>{m.final ? "" : " · speaking"}</small>
                        </span>
                        <p>{m.text}</p>
                      </div>
                    </div>
                  ))}
                  <div ref={transcriptEnd} />
                </div>
              )}
            </div>
            <form
              className="question-composer"
              onSubmit={(event) => {
                event.preventDefault();
                void sendQuestion();
              }}
            >
              <label className="sr-only" htmlFor="question">
                Your question
              </label>
              <input
                id="question"
                value={draft}
                maxLength={4000}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Ask about anything…"
                disabled={
                  props.unavailable || sending || state === "connecting"
                }
              />
              <Button
                type="submit"
                size="icon"
                aria-label="Send question"
                disabled={
                  !draft.trim() ||
                  !consent ||
                  props.unavailable ||
                  sending ||
                  state === "connecting"
                }
              >
                <Send size={18} />
              </Button>
              <p>
                {!consent
                  ? "Accept the conversation notice to speak or send a question."
                  : props.demo
                    ? "Demo preview · live answers are not enabled."
                    : "Answers are spoken aloud and shown above. Enter to send."}
              </p>
            </form>
            <div className="transcript-footer">
              <span className="red-dot" />
              <span>
                {props.demo
                  ? "Sample content · not a live Gemini conversation"
                  : "A little clarity, one conversation at a time."}
              </span>
              {state === "ended" && (
                <button
                  onClick={() => setTranscript([])}
                  title="Clear local transcript"
                >
                  <RotateCcw size={14} />
                </button>
              )}
            </div>
          </section>
        </div>
        <section className="topics">
          <div className="section-heading">
            <h2>A few things we can talk about</h2>
            <span>Not sure where to start? Try one of these.</span>
          </div>
          <div className="topic-grid">
            {topics.map((t) => (
              <button
                className={`topic-card ${topic === t.title ? "selected" : ""}`}
                key={t.title}
                onClick={() => {
                  setTopic(topic === t.title ? null : t.title);
                  if (t.title === "Learn something new")
                    setDraft("Why is the sky blue?");
                }}
                aria-expanded={topic === t.title}
              >
                <span className="topic-icon">
                  <t.icon size={22} />
                </span>
                <span>
                  <strong>{t.title}</strong>
                  <small>{t.description}</small>
                </span>
                <ChevronRight size={17} />
              </button>
            ))}
          </div>
          {topic && (
            <div className="topic-answer">
              <CircleHelp size={18} />
              <p>{topics.find((t) => t.title === topic)?.text}</p>
            </div>
          )}
        </section>
        <section id="how-it-works" className="how-strip">
          <div>
            <span className="check-icon">
              <Check size={15} />
            </span>{" "}
            Speak or type in English, বাংলা or हिन्दी
          </div>
          <div>
            <span className="check-icon">
              <Check size={15} />
            </span>{" "}
            Interrupt anytime, just like a real conversation
          </div>
          <div>
            <ShieldCheck size={16} /> Your privacy comes first
          </div>
        </section>
      </main>
      <footer className="public-footer">
        <span>Made for meaningful conversations.</span>
        <span>
          Save Medha Foundation <span className="footer-separator">/</span>{" "}
          Powered by Gemini
        </span>
        <span className="footer-heart">
          With care, always. <HeartHandshake size={15} />
        </span>
      </footer>
    </div>
  );
}
