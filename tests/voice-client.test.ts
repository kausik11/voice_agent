import { beforeEach, afterEach, it, expect, vi } from "vitest";
import type { LiveServerMessage } from "@google/genai";
const sdk = vi.hoisted(() => ({
  callbacks: null as null | { onmessage: (m: LiveServerMessage) => void },
  sendRealtimeInput: vi.fn(),
  sendClientContent: vi.fn(),
  close: vi.fn(),
}));
vi.mock("@google/genai", () => ({
  Modality: { AUDIO: "AUDIO" },
  GoogleGenAI: class {
    live = {
      connect: async ({
        callbacks,
      }: {
        callbacks: { onmessage: (m: LiveServerMessage) => void };
      }) => {
        sdk.callbacks = callbacks;
        return {
          sendRealtimeInput: sdk.sendRealtimeInput,
          sendClientContent: sdk.sendClientContent,
          close: sdk.close,
        };
      },
    };
  },
}));
import { VoiceClient } from "../lib/voice-client";
const track = { stop: vi.fn(), enabled: true };
const stream = { getTracks: () => [track], getAudioTracks: () => [track] };
const audioSources: {
  stop: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
}[] = [];
const contexts: { close: ReturnType<typeof vi.fn> }[] = [];
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  audioSources.length = 0;
  contexts.length = 0;
  sdk.callbacks = null;
  vi.stubGlobal("navigator", {
    mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(stream) },
  });
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(
      async (url: string) =>
        new Response(
          JSON.stringify(
            url === "/api/sessions"
              ? {
                  id: "test",
                  credential: "scoped",
                  expiresAt: new Date(Date.now() + 300000).toISOString(),
                  token: "auth_tokens/example",
                  model: "gemini-3.8-live",
                }
              : { status: "ACTIVE" },
          ),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    ),
  );
  vi.stubGlobal(
    "AudioContext",
    class {
      sampleRate = 16000;
      currentTime = 0;
      state = "running";
      destination = {};
      audioWorklet = { addModule: vi.fn().mockResolvedValue(undefined) };
      close = vi.fn().mockImplementation(() => {
        this.state = "closed";
      });
      constructor() {
        contexts.push(this);
      }
      resume = vi.fn().mockResolvedValue(undefined);
      createMediaStreamSource() {
        return { connect: vi.fn(), disconnect: vi.fn() };
      }
      createGain() {
        return { gain: { value: 0 }, connect: vi.fn(), disconnect: vi.fn() };
      }
      createBuffer(_channels: number, length: number) {
        return {
          duration: length / 24000,
          getChannelData: () => new Float32Array(length),
        };
      }
      createBufferSource() {
        const source = {
          buffer: undefined,
          onended: null,
          start: vi.fn(),
          stop: vi.fn(),
          connect: vi.fn(),
          disconnect: vi.fn(),
        };
        audioSources.push(source);
        return source;
      }
    },
  );
  vi.stubGlobal(
    "AudioWorkletNode",
    class {
      port = { onmessage: null };
      connect = vi.fn();
      disconnect = vi.fn();
    },
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it("handles permission denial without creating a provider session", async () => {
  vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValue(
    new DOMException("Permission denied", "NotAllowedError"),
  );
  const error = vi.fn();
  const client = new VoiceClient(vi.fn(), vi.fn(), error);
  await client.start("English");
  expect(error).toHaveBeenCalledWith(
    expect.stringContaining("permission was denied"),
  );
  expect(fetch).not.toHaveBeenCalled();
});
it("stops microphone tracks if permission resolves after the user ends", async () => {
  let resolve!: (s: MediaStream) => void;
  vi.mocked(navigator.mediaDevices.getUserMedia).mockReturnValue(
    new Promise((r) => {
      resolve = r;
    }),
  );
  const client = new VoiceClient(vi.fn(), vi.fn(), vi.fn());
  const start = client.start("English");
  await Promise.resolve();
  await client.stop();
  resolve(stream as unknown as MediaStream);
  await start;
  expect(track.stop).toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
});
it("immediately cancels all queued audio on interruption", async () => {
  const client = new VoiceClient(vi.fn(), vi.fn(), vi.fn());
  await client.start("English");
  for (let i = 0; i < 3; i++)
    sdk.callbacks!.onmessage({
      serverContent: {
        modelTurn: {
          parts: [
            {
              inlineData: {
                data: btoa("\0\0\0\0"),
                mimeType: "audio/pcm;rate=24000",
              },
            },
          ],
        },
      },
    } as LiveServerMessage);
  sdk.callbacks!.onmessage({
    serverContent: { interrupted: true },
  } as LiveServerMessage);
  expect(audioSources).toHaveLength(3);
  for (const source of audioSources) {
    expect(source.stop).toHaveBeenCalledOnce();
    expect(source.disconnect).toHaveBeenCalledOnce();
  }
  await client.stop();
});
it("mute flushes provider audio and end cleans all resources without reconnecting", async () => {
  const client = new VoiceClient(vi.fn(), vi.fn(), vi.fn());
  await client.start("Bengali");
  client.mute(true);
  expect(track.enabled).toBe(false);
  expect(sdk.sendRealtimeInput).toHaveBeenCalledWith({ audioStreamEnd: true });
  await client.stop();
  expect(track.stop).toHaveBeenCalled();
  expect(sdk.close).toHaveBeenCalled();
  expect(contexts.every((c) => c.close.mock.calls.length > 0)).toBe(true);
  await vi.advanceTimersByTimeAsync(400000);
  expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledOnce();
});

it("answers typed questions without requesting a microphone and persists both sides", async () => {
  const transcript = vi.fn();
  const client = new VoiceClient(vi.fn(), transcript, vi.fn());
  expect(await client.start("English", false)).toBe(true);
  expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
  expect(client.sendText("  Why is the sky blue?  ")).toBe(true);
  expect(sdk.sendClientContent).toHaveBeenCalledWith({
    turns: [{ role: "user", parts: [{ text: "Why is the sky blue?" }] }],
    turnComplete: true,
  });
  sdk.callbacks!.onmessage({
    serverContent: {
      outputTranscription: {
        text: "Air scatters blue light more strongly.",
        finished: true,
      },
      turnComplete: true,
    },
  } as LiveServerMessage);
  expect(transcript).toHaveBeenLastCalledWith([
    expect.objectContaining({
      speaker: "user",
      text: "Why is the sky blue?",
      final: true,
    }),
    expect.objectContaining({
      speaker: "assistant",
      text: "Air scatters blue light more strongly.",
      final: true,
    }),
  ]);
  await client.stop();
  const payloads = vi
    .mocked(fetch)
    .mock.calls.filter(([url]) => url === "/api/sessions/test")
    .map(([, init]) => JSON.parse(init!.body as string));
  expect(JSON.stringify(payloads)).toContain("Why is the sky blue?");
  expect(JSON.stringify(payloads)).toContain("Air scatters blue light");
  expect(client.sendText("Another question")).toBe(false);
});
it("rejects empty and oversized text and accepts text during a voice session", async () => {
  const client = new VoiceClient(vi.fn(), vi.fn(), vi.fn());
  expect(client.sendText("Before connection")).toBe(false);
  await client.start("English");
  expect(client.sendText("  ")).toBe(false);
  expect(client.sendText("x".repeat(4001))).toBe(false);
  expect(sdk.sendClientContent).not.toHaveBeenCalled();
  expect(client.sendText("Explain gravity")).toBe(true);
  expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledOnce();
  await client.stop();
});
