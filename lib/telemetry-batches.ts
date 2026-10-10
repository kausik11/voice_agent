import type { Transcript } from "./voice-client";
type Usage = { eventId: string; raw: object };
export function telemetryBatches(messages: Transcript[], usage: Usage[]) {
  const encoder = new TextEncoder();
  const batches: { messages: Transcript[]; usage: Usage[] }[] = [];
  let current: { messages: Transcript[]; usage: Usage[] } = {
    messages: [],
    usage: [],
  };
  function size(value: unknown) {
    return encoder.encode(JSON.stringify(value)).byteLength;
  }
  for (const message of messages) {
    const next = { ...current, messages: [...current.messages, message] };
    if (current.messages.length >= 40 || size(next) > 60000) {
      batches.push(current);
      current = { messages: [], usage: [] };
    }
    current.messages.push(message);
  }
  for (const event of usage) {
    const next = { ...current, usage: [...current.usage, event] };
    if (current.usage.length >= 20 || size(next) > 60000) {
      batches.push(current);
      current = { messages: [], usage: [] };
    }
    if (size(event) > 59000)
      throw new Error("Provider telemetry exceeds the supported size");
    current.usage.push(event);
  }
  if (current.messages.length || current.usage.length || !batches.length)
    batches.push(current);
  return batches;
}
