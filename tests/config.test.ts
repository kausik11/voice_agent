import { expect, it } from "vitest";
import { defaults, parseAgentConfig } from "../lib/config";
import {
  legacyInstructions,
  legacyGeneralInstructions,
  legacyName,
  legacyOrganization,
} from "../lib/legacy-branding";

it("upgrades the original organization-only prompt in existing settings", () => {
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

it("upgrades saved assistant branding and the previous general prompt", () => {
  const result = parseAgentConfig({
    ...defaults,
    name: legacyName,
    welcome: "Welcome to " + legacyOrganization,
    instructions: legacyGeneralInstructions,
  });
  expect(result.name).toBe("MMA Assistant");
  expect(result.welcome).toBe("Welcome to Mercantile Marine Academy");
  expect(result.instructions).toBe(defaults.instructions);
});
it("renames old branding in custom instructions without discarding customization", () => {
  const result = parseAgentConfig({
    ...defaults,
    instructions:
      "You represent " + legacyOrganization + ". Always answer in Bengali.",
  });
  expect(result.instructions).toBe(
    "You represent Mercantile Marine Academy. Always answer in Bengali.",
  );
});
