import { createHash } from "node:crypto";
import { db } from "../lib/db";
import { knowledgeSchema } from "../lib/config";
import { approvedKnowledge } from "../lib/services";
import dataset from "../data/academy-faqs.json";

async function main() {
  const entries = dataset.entries.map((entry) => ({
    id: createHash("sha256")
      .update("mma-website-faq:" + entry.question)
      .digest("hex")
      .slice(0, 24),
    ...knowledgeSchema.parse({
      question: entry.question,
      answer: `${entry.answer}\n\nSource: ${entry.sourceUrl}\nReviewed: ${dataset.reviewedAt}.`,
      category: entry.category,
      enabled: true,
      sample: false,
    }),
  }));
  const counts = await db.$transaction(
    async (tx) => {
      let added = 0;
      let skipped = 0;
      for (const entry of entries) {
        // Stable IDs prevent repeat imports; matching questions preserve admin-owned entries.
        const existing = await tx.knowledgeEntry.findFirst({
          where: { OR: [{ id: entry.id }, { question: entry.question }] },
        });
        if (existing) {
          skipped++;
          continue;
        }
        await tx.knowledgeEntry.create({ data: entry });
        added++;
      }
      return { added, skipped };
    },
    { timeout: 60000, maxWait: 10000 },
  );
  console.log(JSON.stringify(counts));
  const context = await approvedKnowledge();
  const included = entries.filter((entry) =>
    context.includes(entry.question),
  ).length;
  console.log(
    `Website FAQs in current assistant context: ${included}/${entries.length}; context characters: ${context.length}.`,
  );
  if (included !== entries.length)
    console.log(
      "Some entries are disabled, edited, or outside the latest-20 retrieval limit. Review the admin knowledge base.",
    );
}
main()
  .catch((error: unknown) => {
    console.error(
      "FAQ import failed. Check database connectivity and schema; credentials were not logged.",
    );
    console.error(
      "Error code:",
      typeof error === "object" && error && "code" in error
        ? String(error.code)
        : "unknown",
    );
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
