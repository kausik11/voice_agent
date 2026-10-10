import { db } from "../lib/db";
import { defaults } from "../lib/config";
import { sampleKnowledge } from "../lib/demo";
async function main() {
  await db.agentSettings.upsert({
    where: { key: "default" },
    create: { key: "default", config: defaults },
    update: {},
  });
  for (const entry of sampleKnowledge) {
    if (
      !(await db.knowledgeEntry.findFirst({
        where: { question: entry.question, sample: true },
      }))
    ) {
      const { id, ...data } = entry;
      void id;
      await db.knowledgeEntry.create({ data });
    }
  }
  console.log(
    "Settings and disabled sample FAQs are ready. No live sessions or pricing were seeded.",
  );
}
main()
  .catch(() => {
    console.error("Seed failed. Check the MongoDB replica set connection.");
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
