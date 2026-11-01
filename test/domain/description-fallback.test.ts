import assert from "node:assert/strict";
import { test } from "node:test";

import { descriptionFallback } from "../../extensions/pi-claude-marketplace/domain/description-fallback.ts";

import type { DescriptionFallbackLabel } from "../../extensions/pi-claude-marketplace/domain/description-fallback.ts";

interface FallbackRow {
  readonly behavior: string;
  readonly body: string;
  readonly label: DescriptionFallbackLabel;
  readonly description: string;
}

const HUNDRED = "0123456789".repeat(10);

const ROWS: readonly FallbackRow[] = [
  {
    behavior: "skips blank lines and trims the first non-blank line",
    body: "\n\n  Greet the user.  \nMore.",
    label: "Plugin skill",
    description: "Greet the user.",
  },
  {
    behavior: "gives the text of a Markdown heading",
    body: "## Greet the user",
    label: "Plugin skill",
    description: "Greet the user",
  },
  {
    behavior: "keeps a hash line with no space after the marks as it is",
    body: "#NoSpace",
    label: "Plugin command",
    description: "#NoSpace",
  },
  {
    behavior: "cuts a 101-character line to 97 characters and an ellipsis",
    body: `${HUNDRED}A`,
    label: "Plugin skill",
    description: `${"0123456789".repeat(9)}0123456...`,
  },
  {
    behavior: "keeps a 100-character line whole",
    body: HUNDRED,
    label: "Plugin skill",
    description: HUNDRED,
  },
  {
    behavior: "cuts the heading text, not the heading line, at 100 characters",
    body: `# ${HUNDRED}A`,
    label: "Plugin command",
    description: `${"0123456789".repeat(9)}0123456...`,
  },
  {
    behavior: "drops the carriage returns of CRLF line ends",
    body: "\r\nFirst\r\n",
    label: "Plugin command",
    description: "First",
  },
  {
    behavior: "gives the skill label for an empty body",
    body: "",
    label: "Plugin skill",
    description: "Plugin skill",
  },
  {
    behavior: "gives the command label for a body of only whitespace",
    body: "   \n\t\n",
    label: "Plugin command",
    description: "Plugin command",
  },
];

for (const { behavior, body, label, description } of ROWS) {
  test(`D-CF1-04: ${behavior}`, () => {
    // arrange
    const expectedDescription = description;

    // act
    const fallback = descriptionFallback(body, label);

    // assert
    assert.strictEqual(fallback, expectedDescription);
  });
}
