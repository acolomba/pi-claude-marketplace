import assert from "node:assert/strict";
import test from "node:test";

import {
  assertSafeName,
  generatedAgentName,
  generatedCommandName,
  generatedSkillName,
} from "../../extensions/pi-claude-marketplace/domain/name.ts";

// ──────────────────────────────────────────────────────────────────────────
// RN-2: assertSafeName
// ──────────────────────────────────────────────────────────────────────────

test("RN-2 assertSafeName accepts valid simple name", () => {
  assert.doesNotThrow(() => {
    assertSafeName("foo");
  });
});

test("RN-2 assertSafeName accepts dashes and digits", () => {
  assert.doesNotThrow(() => {
    assertSafeName("foo-bar-123");
  });
});

test("RN-2 assertSafeName accepts colon (used by command names)", () => {
  assert.doesNotThrow(() => {
    assertSafeName("acme:foo");
  });
});

test("RN-2 assertSafeName accepts long pi-namespaced agent name", () => {
  assert.doesNotThrow(() => {
    assertSafeName("pi-claude-marketplace-acme-bot");
  });
});

test("RN-2 assertSafeName rejects empty string", () => {
  assert.throws(() => {
    assertSafeName("");
  }, /non-empty/);
});

test("RN-2 assertSafeName rejects whitespace-only", () => {
  assert.throws(() => {
    assertSafeName("   ");
  }, /non-empty/);
});

test('RN-2 assertSafeName rejects "."', () => {
  assert.throws(() => {
    assertSafeName(".");
  }, /must not be/);
});

test('RN-2 assertSafeName rejects ".."', () => {
  assert.throws(() => {
    assertSafeName("..");
  }, /must not be/);
});

test("RN-2 assertSafeName rejects forward slash", () => {
  assert.throws(() => {
    assertSafeName("foo/bar");
  }, /path separator/);
});

test("RN-2 assertSafeName rejects backslash", () => {
  assert.throws(() => {
    assertSafeName("foo\\bar");
  }, /path separator/);
});

test("RN-2 assertSafeName rejects tab", () => {
  assert.throws(() => {
    assertSafeName("foo\tbar");
  }, /control character/);
});

test("RN-2 assertSafeName rejects null byte", () => {
  assert.throws(() => {
    assertSafeName("foo\x00bar");
  }, /control character/);
});

test("RN-2 assertSafeName rejects DEL (0x7f)", () => {
  assert.throws(() => {
    assertSafeName("foo\x7fbar");
  }, /control character/);
});

// ──────────────────────────────────────────────────────────────────────────
// RN-1 / SK-2: generatedSkillName -- "<plugin>-<skill>" with prefix elision
// ──────────────────────────────────────────────────────────────────────────

test("SK-2 generatedSkillName basic case", () => {
  assert.equal(generatedSkillName("acme", "foo"), "acme-foo");
});

test("SK-2 generatedSkillName elides plugin prefix when source starts with it", () => {
  assert.equal(generatedSkillName("acme", "acme-foo"), "acme-foo");
});

test("SK-2 generatedSkillName does NOT elide when source merely contains plugin substring", () => {
  // 'ab' is a strict prefix of 'abc', but 'abc' source doesn't start with 'ab-'.
  assert.equal(generatedSkillName("ab", "abc"), "ab-abc");
});

test("SK-2 generatedSkillName does NOT double-elide (only one layer of prefix removed)", () => {
  // Verifies that we don't strip TWO prefixes; only one.
  assert.equal(generatedSkillName("acme", "acme-acme-foo"), "acme-acme-foo");
});

test("SK-2 generatedSkillName keeps plugin-name source as skill name", () => {
  assert.equal(generatedSkillName("foo", "foo"), "foo");
});

test("SK-2 generatedSkillName throws when elision yields empty string", () => {
  assert.throws(() => generatedSkillName("acme", "acme-"), /non-empty/);
});

// ──────────────────────────────────────────────────────────────────────────
// RN-1 / CM-2: generatedCommandName -- "<plugin>:<command>" with prefix elision
// ──────────────────────────────────────────────────────────────────────────

test("CM-2 generatedCommandName basic case", () => {
  assert.equal(generatedCommandName("acme", "foo"), "acme:foo");
});

test("CM-2 generatedCommandName elides plugin- prefix from source", () => {
  assert.equal(generatedCommandName("acme", "acme-foo"), "acme:foo");
});

test("CM-2 generatedCommandName uses COLON separator (not dash)", () => {
  const result = generatedCommandName("acme", "foo");
  assert.ok(result.includes(":"), `expected colon in "${result}"`);
  assert.ok(!result.startsWith("acme-"), `expected colon-form, got "${result}"`);
});

test("D-141-02 generatedCommandName keeps a head the elision would empty", () => {
  // 'acme-' would elide to '', so the elision does not fire and the head
  // stays verbatim -- the name Claude Code registers for commands/acme-.md.
  assert.equal(generatedCommandName("acme", "acme-"), "acme:acme-");
});

test("D-141-02 generatedCommandName keeps an emptied head of a nested source", () => {
  assert.equal(generatedCommandName("acme", "acme-/lint"), "acme:acme-:lint");
});

test("D-141-02 generatedCommandName still rejects a head that strips to a dot", () => {
  // The elision fires here (the remainder is non-empty) and leaves '.',
  // which RN-2 forbids.
  assert.throws(() => generatedCommandName("acme", "acme-."), /must not be/);
});

// ──────────────────────────────────────────────────────────────────────────
// CM-4: nested command paths -- "/"-separated source joins with ":"
// ──────────────────────────────────────────────────────────────────────────

test("CM-4 generatedCommandName maps a nested source path to colon-separated segments", () => {
  assert.equal(generatedCommandName("acme", "build/web"), "acme:build:web");
});

test("CM-4 generatedCommandName maps deeper nesting with one colon per segment", () => {
  assert.equal(generatedCommandName("acme", "build/web/prod"), "acme:build:web:prod");
});

test("CM-4 generatedCommandName elides plugin prefix from the first segment only", () => {
  assert.equal(generatedCommandName("acme", "acme-build/web"), "acme:build:web");
});

test("CM-4 generatedCommandName rejects a path with an empty segment", () => {
  assert.throws(() => generatedCommandName("acme", "build//web"), /non-empty/);
});

test("CM-4 generatedCommandName rejects a backslash in a segment (OS sep must be normalized upstream)", () => {
  assert.throws(() => generatedCommandName("acme", "build\\web"), /path separators/);
});

// ──────────────────────────────────────────────────────────────────────────
// D-141-01: the CM-2 elision applies to the HEAD of the source path, and the
// head is the first path segment when the source is nested.
// ──────────────────────────────────────────────────────────────────────────

test("D-141-01 generatedCommandName elides the plugin prefix from a directory head", () => {
  // Deliberate divergence: Claude Code 2.1.228 registers this source as
  // "acme:acme-tools:lint" because it performs no elision at all. CM-2
  // already diverged the same way for flat files ("acme-flat.md" is
  // "acme:flat" here, "acme:acme-flat" upstream).
  assert.equal(generatedCommandName("acme", "acme-tools/lint"), "acme:tools:lint");
});

test("D-141-01 generatedCommandName does not elide a non-head segment", () => {
  assert.equal(generatedCommandName("acme", "build/acme-web"), "acme:build:acme-web");
});

// ──────────────────────────────────────────────────────────────────────────
// RN-1 / AG-1: generatedAgentName -- "pi-claude-marketplace-<plugin>-<agent>"
// ──────────────────────────────────────────────────────────────────────────

test("AG-1 generatedAgentName basic case", () => {
  assert.equal(generatedAgentName("acme", "bot"), "pi-claude-marketplace-acme-bot");
});

test("AG-1 generatedAgentName elides plugin- prefix from source", () => {
  assert.equal(generatedAgentName("acme", "acme-bot"), "pi-claude-marketplace-acme-bot");
});

test("AG-1 generatedAgentName always starts with pi-claude-marketplace- (AG-5 marker discipline)", () => {
  const result = generatedAgentName("acme", "bot");
  assert.ok(result.startsWith("pi-claude-marketplace-"));
});

// ──────────────────────────────────────────────────────────────────────────
// B-02: assertSafeName accepts an optional `label` argument used in error
// messages (bridges pass it for human-readable context).
// ──────────────────────────────────────────────────────────────────────────

test("B-02 assertSafeName(name) single-arg call still accepts valid names (back-compat)", () => {
  assert.doesNotThrow(() => {
    assertSafeName("foo");
  });
});

test("B-02 assertSafeName(name, label) prepends label to error message", () => {
  assert.throws(() => {
    assertSafeName("../bad", "skill name");
  }, /skill name "\.\.\/bad" must not contain path separators/);
});

test("B-02 assertSafeName(name, label) labels empty-string error", () => {
  assert.throws(() => {
    assertSafeName("", "generated command name");
  }, /generated command name must be a non-empty string/);
});

test("B-02 assertSafeName(name, label) labels control-char error", () => {
  assert.throws(() => {
    assertSafeName("foo\tbar", "agent name");
  }, /agent name "foo\tbar" must not contain ASCII control characters/);
});

test("B-02 assertSafeName(name) without label keeps legacy message form", () => {
  // Regression guard: the no-label message form uses "Name " as the prefix.
  // Existing tests rely on this exact text.
  assert.throws(() => {
    assertSafeName("");
  }, /Name must be a non-empty string/);
});
