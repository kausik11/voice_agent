import { z } from "zod";
import {
  legacyName,
  legacyOrganization,
  legacyInstructions,
  legacyGeneralInstructions,
} from "./legacy-branding";
export const MODELS = ["gemini-3.8-live"] as const;
export const VOICES = ["Kore", "Puck", "Aoede", "Charon", "Fenrir"] as const;
export const settingsSchema = z.object({
  name: z.string().min(1).max(80),
  welcome: z.string().min(1).max(400),
  instructions: z.string().min(20).max(8000),
  language: z.enum(["English", "Bengali", "Hindi"]),
  model: z.enum(MODELS),
  voice: z.enum(VOICES),
  maxDuration: z.number().int().min(30).max(540),
  retentionDays: z.number().int().min(1).max(365),
  maxConcurrent: z.number().int().min(1).max(100),
  rateLimit: z.number().int().min(1).max(100),
  timezone: z.string().refine((v) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: v });
      return true;
    } catch {
      return false;
    }
  }, "Invalid timezone"),
});
export type AgentConfig = z.infer<typeof settingsSchema>;
export const defaults: AgentConfig = {
  name: "MMA Assistant",
  welcome: "A little guidance. A real conversation.",
  instructions:
    "You are MMA Assistant, the AI assistant for Mercantile Marine Academy. Help prospective students, students, and visitors with academy questions, maritime learning, and general questions. Answer the user’s spoken or typed question on any topic, including learning, science, technology, writing, and everyday life. Use conversation context for follow-up questions. Be warm, clear, and concise, expanding when asked. Respond in the user’s preferred language. Be honest about uncertainty and never claim real-time access or actions you cannot perform. For questions specifically about Mercantile Marine Academy, use the approved organizational reference information; ask staff to confirm missing organizational details. This restriction applies only to organization-specific facts, not general questions.",
  language: "English",
  model: MODELS[0],
  voice: "Kore",
  maxDuration: 300,
  retentionDays: 30,
  maxConcurrent: 5,
  rateLimit: 5,
  timezone: "Asia/Kolkata",
};
export const knowledgeSchema = z.object({
  question: z.string().min(3).max(200),
  answer: z.string().min(3).max(2000),
  category: z.string().min(1).max(60),
  enabled: z.boolean(),
  sample: z.boolean().default(false),
});
export const money = z
  .string()
  .regex(/^\d{1,9}(\.\d{1,9})?$/, "Use a non-negative decimal, up to 9 places");
export const pricingSchema = z.object({
  model: z.enum(MODELS),
  currency: z.literal("USD"),
  effectiveAt: z.string().datetime(),
  sourceUrl: z.string().url(),
  rates: z
    .record(
      z
        .string()
        .regex(
          /^(input|output|cache)\.(TEXT|AUDIO|IMAGE|VIDEO)$|^thoughts$|^tool$/,
        ),
      money,
    )
    .refine((v) => Object.keys(v).length > 0, "Enter at least one rate"),
});
export const budgetSchema = z
  .object({
    daily: money.nullable(),
    monthly: money.nullable(),
    blockNew: z.boolean(),
    inrRate: money.refine((v) => Number(v) > 0).nullable(),
    exchangeEffectiveAt: z.string().datetime().nullable(),
    hostingMonthly: money.nullable(),
    telephoneMonthly: money.nullable(),
  })
  .refine(
    (v) => !v.inrRate || !!v.exchangeEffectiveAt,
    "An exchange rate requires an effective date",
  );
export function isDemo() {
  return (
    process.env.DEMO_MODE === "true" ||
    (!process.env.DATABASE_URL && !process.env.GEMINI_API_KEY)
  );
}

// Upgrade the former brand while preserving unrelated administrator customizations.
export function parseAgentConfig(value: unknown): AgentConfig {
  const config = settingsSchema.parse(value);
  const rename = (text: string) =>
    text
      .replaceAll(legacyOrganization, "Mercantile Marine Academy")
      .replaceAll(legacyName, defaults.name);
  return {
    ...config,
    name: rename(config.name),
    welcome: rename(config.welcome),
    instructions: [legacyInstructions, legacyGeneralInstructions].includes(
      config.instructions,
    )
      ? defaults.instructions
      : rename(config.instructions),
  };
}
