import { defaults } from "./config";
export const sampleKnowledge = [
  {
    id: "sample-1",
    question: "How can I arrange a visit?",
    answer:
      "Sample guidance: A staff member needs to confirm appointment availability and the booking procedure. This sample does not provide verified contact details.",
    category: "Appointments",
    enabled: false,
    sample: true,
  },
  {
    id: "sample-2",
    question: "Where are your centres?",
    answer:
      "Sample guidance: Centre addresses and opening hours have not been approved yet. Please ask a staff member to confirm before travelling.",
    category: "Our centres",
    enabled: false,
    sample: true,
  },
  {
    id: "sample-3",
    question: "Can you recommend a treatment?",
    answer:
      "Sample guidance: Patient-specific treatment decisions must be discussed with qualified clinical staff. This assistant cannot diagnose or recommend a treatment.",
    category: "General information",
    enabled: false,
    sample: true,
  },
];
export function demoSessions() {
  return Array.from({ length: 36 }, (_, i) => ({
    id: `demo-${String(i + 1).padStart(3, "0")}`,
    startedAt: new Date(Date.now() - i * 5 * 3600000).toISOString(),
    endedAt: new Date(Date.now() - i * 5 * 3600000 + 132000).toISOString(),
    lastActivityAt: new Date().toISOString(),
    status: i === 0 ? "ACTIVE" : i % 9 === 0 ? "FAILED" : "COMPLETED",
    duration: 132 + ((i * 37) % 290),
    model: defaults.model,
    language: ["English", "Bengali", "Hindi"][i % 3],
    demo: true,
    estimatedCost: i % 8 === 0 ? null : (0.008 + i * 0.0013).toFixed(5),
    costStatus: i % 8 === 0 ? "INCOMPLETE" : "DEMO",
    usageTotals: { "input.AUDIO": 780 + i * 20, "output.AUDIO": 420 + i * 15 },
    settingsSnapshot: defaults,
    pricingVersionId: null,
    reason: i % 9 === 0 && i > 0 ? "Example network disconnection" : null,
  }));
}
export function demoDetail(id: string) {
  const session = demoSessions().find((s) => s.id === id);
  if (!session) return null;
  return {
    ...session,
    transcripts: [
      {
        id: "1",
        speaker: "user",
        text: "Hello, how can I arrange a visit?",
        timestamp: session.startedAt,
        sequence: 0,
        final: true,
      },
      {
        id: "2",
        speaker: "assistant",
        text: "Hello! A staff member will need to confirm appointment availability and the booking procedure. I don’t have approved contact information yet.",
        timestamp: session.startedAt,
        sequence: 1,
        final: true,
      },
    ],
    usageEvents: [],
    pricing: null,
  };
}
