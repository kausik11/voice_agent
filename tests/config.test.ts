import { expect, it } from "vitest";
import { defaults, legacyInstructions, parseAgentConfig } from "../lib/config";

it("upgrades the original Foundation-only prompt in existing settings", () => {
  const result = parseAgentConfig({
    ...defaults,
    instructions: legacyInstructions,
  });
  expect(result.instructions).toBe(defaults.instructions);
  expect(result.instructions).toContain("any topic");
});
it("preserves administrator custom instructions and other settings", () => {
  const config = {
    ...defaults,
    name: "Helper",
    instructions: "Answer general questions using short, friendly sentences.",
  };
  expect(parseAgentConfig(config)).toEqual(config);
});
