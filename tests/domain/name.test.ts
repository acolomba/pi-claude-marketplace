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

test("CM-2 generatedCommandName throws when elision yields empty string", () => {
  // source 'acme-' elides to '' which fails assertSafeName
  assert.throws(() => generatedCommandName("acme", "acme-"), /non-empty/);
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
