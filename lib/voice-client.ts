import { telemetryBatches } from "./telemetry-batches";
import {
  GoogleGenAI,
  Modality,
  type Session,
  type LiveServerMessage,
} from "@google/genai";
export type Transcript = {
  eventId: string;
  speaker: "user" | "assistant";
  text: string;
  sequence: number;
  final: boolean;
};
type State = "connecting" | "listening" | "thinking" | "speaking" | "ended";
export class VoiceClient {
  private session?: Session;
  private stream?: MediaStream;
  private input?: AudioContext;
  private output?: AudioContext;
  private worklet?: AudioWorkletNode;
  private source?: MediaStreamAudioSourceNode;
  private silent?: GainNode;
  private sources = new Set<AudioBufferSourceNode>();
  private nextPlay = 0;
  private stopped = false;
  private muted = false;
  private heartbeat?: ReturnType<typeof setInterval>;
  private expiry?: ReturnType<typeof setTimeout>;
  private connection?: {
    id: string;
    credential: string;
    expiresAt: string;
    token: string;
    model: string;
  };
  private messages: Transcript[] = [];
  private turn: Partial<Record<"user" | "assistant", Transcript>> = {};
  private usage: { eventId: string; raw: object }[] = [];
  private sentUsage = new Set<string>();
  private sentMessages = new Map<string, string>();
  private flushChain = Promise.resolve();
  constructor(
    private onState: (s: State) => void,
    private onTranscript: (t: Transcript[]) => void,
    private onError: (s: string) => void,
  ) {}
  async start(language: string, microphone = true) {
    try {
      this.onState("connecting");
      // Resume output from the user's gesture, including text-only sessions.
      this.output = new AudioContext({ sampleRate: 24000 });
      await this.output.resume();
      if (this.stopped) return;
      if (microphone) {
        if (!navigator.mediaDevices?.getUserMedia)
          throw new Error(
            "Microphone access requires HTTPS or localhost and a supported browser.",
          );
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        if (this.stopped) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        this.stream = stream;
        this.input = new AudioContext({ sampleRate: 16000 });
        await Promise.all([
          this.input.resume(),
          this.input.audioWorklet.addModule("/pcm-capture.js"),
        ]);
      }
      if (this.stopped) {
        this.cleanup();
        return;
      }
      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consent: true, language }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Unable to start a conversation.");
      this.connection = data;
      if (this.stopped) {
        await this.flush("COMPLETED", "user_ended");
        return;
      }
      const ai = new GoogleGenAI({
        apiKey: data.token,
        httpOptions: { apiVersion: "v1beta" },
      });
      const session = await ai.live.connect({
        model: data.model,
        config: { responseModalities: [Modality.AUDIO] },
        callbacks: {
          onmessage: (m) => this.receive(m),
          onerror: () => {
            if (!this.stopped) {
              this.onError(
                "The voice service disconnected. Please start a new conversation.",
              );
              void this.stop("FAILED", "provider_error");
            }
          },
          onclose: () => {
            if (!this.stopped) {
              this.onError(
                "The connection ended. Your microphone has been turned off.",
              );
              void this.stop("DISCONNECTED", "provider_closed");
            }
          },
        },
      });
      if (this.stopped) {
        session.close();
        return;
      }
      this.session = session;
      if (this.input && this.stream) {
        this.source = this.input.createMediaStreamSource(this.stream);
        this.worklet = new AudioWorkletNode(this.input, "pcm-capture");
        this.silent = this.input.createGain();
        this.silent.gain.value = 0;
        this.worklet.port.onmessage = (e) => {
          if (this.stopped || this.muted) return;
          const bytes = new Uint8Array(e.data);
          let binary = "";
          for (const b of bytes) binary += String.fromCharCode(b);
          try {
            session.sendRealtimeInput({
              audio: {
                data: btoa(binary),
                mimeType: `audio/pcm;rate=${this.input?.sampleRate ?? 16000}`,
              },
            });
          } catch {
            this.onError("Audio connection lost. Please try again.");
            void this.stop("DISCONNECTED", "network_lost");
          }
        };
        this.source.connect(this.worklet);
        this.worklet.connect(this.silent);
        this.silent.connect(this.input.destination);
      }
      this.onState("listening");
      await this.flush("ACTIVE");
      if (this.stopped) return;
      this.heartbeat = setInterval(() => {
        void this.flush().catch(() => {
          this.onError(
            "Session logging is unavailable. The conversation has been stopped.",
          );
          void this.stop("DISCONNECTED", "network_lost");
        });
      }, 10000);
      this.expiry = setTimeout(
        () => {
          this.onError(
            "You’ve reached the conversation time limit. You can start a new conversation.",
          );
          void this.stop("EXPIRED", "maximum_duration");
        },
        Math.max(0, new Date(data.expiresAt).getTime() - Date.now()),
      );
      return true;
    } catch (e) {
      if (!this.stopped) {
        this.onError(
          e instanceof DOMException && e.name === "NotAllowedError"
            ? "Microphone permission was denied. Allow microphone access in your browser, then try again."
            : e instanceof Error
              ? e.message
              : "Unable to connect. Please try again.",
        );
        await this.stop("FAILED", "provider_error");
      }
    }
  }
  sendText(value: string) {
    const text = value.trim();
    if (!this.session || this.stopped || !text || text.length > 4000)
      return false;
    try {
      this.session.sendClientContent({
        turns: [{ role: "user", parts: [{ text }] }],
        turnComplete: true,
      });
      this.cancelAudio();
      this.finishTurn();
      this.append("user", text, true);
      this.onState("thinking");
      return true;
    } catch {
      this.onError(
        "Your message could not be sent. Please start a new conversation.",
      );
      void this.stop("DISCONNECTED", "network_lost");
      return false;
    }
  }
  private receive(message: LiveServerMessage) {
    if (this.stopped) return;
    const content = message.serverContent;
    if (message.goAway) {
      this.onError(
        "The voice connection is expiring. Please start a new conversation.",
      );
      void this.stop("EXPIRED", "provider_closed");
      return;
    }
    if (message.usageMetadata)
      this.usage.push({
        eventId: crypto.randomUUID(),
        raw: JSON.parse(JSON.stringify(message.usageMetadata)),
      });
    if (content?.interrupted) {
      this.cancelAudio();
      this.finishTurn();
      this.onState("listening");
    }
    if (content?.inputTranscription?.text) {
      this.append(
        "user",
        content.inputTranscription.text,
        !!content.inputTranscription.finished,
      );
      this.onState("thinking");
    }
    if (content?.outputTranscription?.text)
      this.append(
        "assistant",
        content.outputTranscription.text,
        !!content.outputTranscription.finished,
      );
    for (const part of content?.modelTurn?.parts ?? []) {
      if (
        part.inlineData?.data &&
        part.inlineData.mimeType?.startsWith("audio/pcm")
      )
        this.play(part.inlineData.data);
    }
    if (content?.turnComplete) {
      this.finishTurn();
      if (!this.sources.size) this.onState("listening");
    }
  }
  private append(speaker: "user" | "assistant", text: string, final: boolean) {
    let current = this.turn[speaker];
    if (!current) {
      current = {
        eventId: crypto.randomUUID(),
        speaker,
        text: "",
        sequence: this.messages.length,
        final: false,
      };
      this.messages.push(current);
      this.turn[speaker] = current;
    }
    current.text = (current.text + text).slice(0, 16000);
    current.final = final;
    if (final) delete this.turn[speaker];
    this.onTranscript(this.messages.map((m) => ({ ...m })));
  }
  private finishTurn() {
    for (const message of Object.values(this.turn)) message.final = true;
    this.turn = {};
    this.onTranscript(this.messages.map((m) => ({ ...m })));
  }
  private play(base64: string) {
    const context = this.output;
    if (!context || this.stopped) return;
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const view = new DataView(bytes.buffer);
    const buffer = context.createBuffer(1, Math.floor(bytes.length / 2), 24000);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++)
      samples[i] = view.getInt16(i * 2, true) / 32768;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    this.sources.add(source);
    this.nextPlay = Math.max(context.currentTime, this.nextPlay);
    source.start(this.nextPlay);
    this.nextPlay += buffer.duration;
    this.onState("speaking");
    source.onended = () => {
      source.disconnect();
      this.sources.delete(source);
      if (!this.sources.size && !this.stopped) this.onState("listening");
    };
  }
  private cancelAudio() {
    for (const s of this.sources) {
      s.onended = null;
      try {
        s.stop();
      } catch {}
      s.disconnect();
    }
    this.sources.clear();
    this.nextPlay = 0;
  }
  mute(value: boolean) {
    this.muted = value;
    this.stream?.getAudioTracks().forEach((t) => {
      t.enabled = !value;
    });
    if (value) this.session?.sendRealtimeInput({ audioStreamEnd: true });
  }
  private flush(status?: string, reason?: string) {
    this.flushChain = this.flushChain
      .catch(() => {})
      .then(async () => {
        if (!this.connection) return;
        const connection = this.connection;
        const pending = this.usage.filter(
          (e) => !this.sentUsage.has(e.eventId),
        );
        const messages = this.messages
          .filter((m) => this.sentMessages.get(m.eventId) !== JSON.stringify(m))
          .map((m) => ({ ...m }));
        const batches = telemetryBatches(messages, pending);
        for (let i = 0; i < batches.length; i++) {
          const payload = {
            ...batches[i],
            ...(i === batches.length - 1 ? { status, reason } : {}),
          };
          let ok = false;
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              const res = await fetch(`/api/sessions/${connection.id}`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${connection.credential}`,
                },
                body: JSON.stringify(payload),
                keepalive: true,
              });
              if (res.ok) {
                const result = await res.json();
                ok = true;
                if (
                  ["EXPIRED", "FAILED"].includes(result.status) &&
                  !this.stopped
                ) {
                  this.onError(
                    "This session has ended. Please start a new conversation.",
                  );
                  this.stopped = true;
                  this.cleanup();
                  this.onState("ended");
                }
                break;
              }
              if (res.status < 500 && res.status !== 429) break;
            } catch {}
            await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
          }
          if (!ok) throw new Error("Telemetry could not be saved");
          for (const u of payload.usage) this.sentUsage.add(u.eventId);
          for (const m of payload.messages)
            this.sentMessages.set(m.eventId, JSON.stringify(m));
        }
      });
    return this.flushChain;
  }
  private cleanup() {
    clearInterval(this.heartbeat);
    clearTimeout(this.expiry);
    this.cancelAudio();
    this.worklet?.disconnect();
    this.source?.disconnect();
    this.silent?.disconnect();
    if (this.worklet) this.worklet.port.onmessage = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.session?.close();
    if (this.input?.state !== "closed") void this.input?.close();
    if (this.output?.state !== "closed") void this.output?.close();
  }
  async stop(status = "COMPLETED", reason = "user_ended") {
    if (this.stopped) return;
    this.stopped = true;
    this.cleanup();
    this.onState("ended");
    try {
      await this.flush(status, reason);
    } catch {
      this.onError(
        "Conversation ended. Some transcript updates could not be saved.",
      );
    }
  }
}
