import { Suspense } from "react";
import { connection } from "next/server";
import VoiceAssistant from "@/components/voice-assistant";
import { defaults, isDemo } from "@/lib/config";
import { settings } from "@/lib/services";

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="loading-state" role="status">
          Loading MMA Assistant…
        </div>
      }
    >
      <ConfiguredAssistant />
    </Suspense>
  );
}

async function ConfiguredAssistant() {
  await connection();
  const demo = isDemo();
  let config = defaults;
  let unavailable = false;
  if (!demo) {
    try {
      config = await settings();
      unavailable = !process.env.GEMINI_API_KEY;
    } catch {
      unavailable = true;
    }
  }
  return (
    <VoiceAssistant
      demo={demo}
      name={config.name}
      welcome={config.welcome}
      language={config.language}
      maxDuration={config.maxDuration}
      unavailable={unavailable}
    />
  );
}
