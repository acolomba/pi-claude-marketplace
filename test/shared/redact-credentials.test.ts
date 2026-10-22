import assert from "node:assert/strict";
import { test } from "node:test";

import { redactAbsolutePaths } from "../../extensions/pi-claude-marketplace/shared/redact-absolute-paths.ts";
import { redactCredentials } from "../../extensions/pi-claude-marketplace/shared/redact-credentials.ts";

const BODY_36 = "0123456789abcdefghijklmnopqrstuvwxyz";
const BODY_16 = "0123456789abcdef";
const BODY_15 = "0123456789abcde";

for (const { name, input, expected } of [
  {
    name: "PMOD-04 / D-06 replaces user and password userinfo with ***@",
    input: "clone https://user:tok@host/x failed",
    expected: "clone https://***@host/x failed",
  },
  {
    name: "PMOD-04 / D-06 replaces userinfo up to the last @ when the password carries an @",
    input: "clone https://user:p@ss@host/x failed",
    expected: "clone https://***@host/x failed",
  },
  {
    name: "PMOD-04 / D-05 replaces the git userinfo of an ssh URL",
    input: "fetch ssh://git@host/x failed",
    expected: "fetch ssh://***@host/x failed",
  },
  {
    name: "PMOD-04 / D-06 keeps the x-access-token: prefix and replaces its secret",
    input: "sent x-access-token:abc123 to host",
    expected: "sent x-access-token:*** to host",
  },
  {
    name: "PMOD-04 / D-06 keeps the Bearer prefix and replaces its secret",
    input: "Authorization: Bearer abc.def-1 rejected",
    expected: "Authorization: Bearer *** rejected",
  },
  {
    name: "PMOD-04 / D-05 matches a lower-case bearer scheme",
    input: "authorization: bearer abc123 rejected",
    expected: "authorization: bearer *** rejected",
  },
  {
    name: "PMOD-04 / D-05 replaces a letters-only Bearer secret of 16 characters",
    input: "Authorization: Bearer abcdefghijklmnop rejected",
    expected: "Authorization: Bearer *** rejected",
  },
  {
    name: "PMOD-04 / D-05 keeps the sentence period after a Bearer secret",
    input: "sent Bearer abc.def-1.",
    expected: "sent Bearer ***.",
  },
  {
    name: "PMOD-04 leaves the prose word after Bearer unchanged",
    input: "Bearer token required",
    expected: "Bearer token required",
  },
  {
    name: "PMOD-04 leaves a sentence-final Bearer word unchanged",
    input: "the host wants a Bearer token.",
    expected: "the host wants a Bearer token.",
  },
  {
    name: "PMOD-04 leaves a Bearer challenge realm unchanged",
    input: 'WWW-Authenticate: Bearer realm="GitHub"',
    expected: 'WWW-Authenticate: Bearer realm="GitHub"',
  },
  {
    name: "PMOD-04 leaves the word on the line after bearer unchanged",
    input: "using bearer\nabc123 authentication",
    expected: "using bearer\nabc123 authentication",
  },
  {
    name: "PMOD-04 / D-05 replaces a ghp_ token",
    input: `token ghp_${BODY_36} bad`,
    expected: "token *** bad",
  },
  {
    name: "PMOD-04 / D-05 replaces a gho_ token with a 16-character body",
    input: `token gho_${BODY_16} bad`,
    expected: "token *** bad",
  },
  {
    name: "PMOD-04 / D-05 replaces a ghu_ token",
    input: `token ghu_${BODY_16} bad`,
    expected: "token *** bad",
  },
  {
    name: "PMOD-04 / D-05 replaces a ghs_ token",
    input: `token ghs_${BODY_16} bad`,
    expected: "token *** bad",
  },
  {
    name: "PMOD-04 / D-05 replaces a ghr_ token",
    input: `token ghr_${BODY_16} bad`,
    expected: "token *** bad",
  },
  {
    name: "PMOD-04 / D-05 replaces a github_pat_ token whose body carries underscores",
    input: `token github_pat_${BODY_16}_${BODY_16} bad`,
    expected: "token *** bad",
  },
  {
    name: "PMOD-04 / D-05 replaces a token glued to a leading word character",
    input: `token xghp_${BODY_36} bad`,
    expected: "token x*** bad",
  },
  {
    name: "PMOD-04 / D-05 replaces a token followed by an underscore suffix",
    input: `token ghp_${BODY_36}_suffix bad`,
    expected: "token ***_suffix bad",
  },
  {
    name: "PMOD-04 / D-06 replaces userinfo whose scheme is glued to a word character",
    input: "remote_https://u:tok@host/x failed",
    expected: "remote_https://***@host/x failed",
  },
  {
    name: "PMOD-04 / D-06 replaces userinfo whose scheme follows a digit",
    input: "remote 1https://u:tok@host/x failed",
    expected: "remote 1https://***@host/x failed",
  },
  {
    name: "PMOD-04 leaves the scp-style subject git@host:owner/repo unchanged",
    input: "marketplace git@github.com:foo/bar.git failed",
    expected: "marketplace git@github.com:foo/bar.git failed",
  },
  {
    name: "PMOD-04 leaves a token with a 15-character body unchanged",
    input: `token ghp_${BODY_15} bad`,
    expected: `token ghp_${BODY_15} bad`,
  },
  {
    name: "PMOD-04 leaves a URL without userinfo unchanged",
    input: "clone https://github.com/o/r.git failed",
    expected: "clone https://github.com/o/r.git failed",
  },
  {
    name: "PMOD-04 leaves a string without a credential unchanged",
    input: "marketplace update failed",
    expected: "marketplace update failed",
  },
  {
    name: "PMOD-04 empty edge: the empty string stays empty",
    input: "",
    expected: "",
  },
  {
    name: "PMOD-04 empty edge: a bare x-access-token: prefix stays unchanged",
    input: "header x-access-token: missing",
    expected: "header x-access-token: missing",
  },
  {
    name: "PMOD-04 empty edge: a Bearer with no secret stays unchanged",
    input: "Authorization: Bearer ",
    expected: "Authorization: Bearer ",
  },
  {
    name: "PMOD-04 empty edge: a scheme with no userinfo stays unchanged",
    input: "clone https:// failed",
    expected: "clone https:// failed",
  },
  {
    name: "PMOD-04 adjacency edge: a userinfo URL and a ghp_ token are both replaced",
    input: `clone https://u:p@host/x with ghp_${BODY_36} failed`,
    expected: "clone https://***@host/x with *** failed",
  },
  {
    name: "PMOD-04 adjacency edge: two tokens separated by a space are both replaced",
    input: `tokens ghp_${BODY_16} ghs_${BODY_16} end`,
    expected: "tokens *** *** end",
  },
  {
    name: "PMOD-04 adjacency edge: two tokens separated by punctuation are both replaced",
    input: `tokens (ghp_${BODY_16},ghs_${BODY_16}). end`,
    expected: "tokens (***,***). end",
  },
  {
    name: "PMOD-04 encoding edge: percent-encoded userinfo is replaced as one unit",
    input: "clone https://us%40er:p%3Ass@host/x failed",
    expected: "clone https://***@host/x failed",
  },
  {
    name: "PMOD-04 encoding edge: non-ASCII text around a credential passes through",
    input: `échec https://u:p@hôte/x -- ghp_${BODY_36} ✗`,
    expected: "échec https://***@hôte/x -- *** ✗",
  },
  {
    name: "PMOD-04 ordering edge: an x-access-token userinfo collapses into ***@",
    input: "clone https://x-access-token:tok@github.com/o/r failed",
    expected: "clone https://***@github.com/o/r failed",
  },
  {
    name: "PMOD-04 ordering edge: a token inside userinfo collapses into ***@",
    input: `clone https://ghp_${BODY_36}@github.com/o/r failed`,
    expected: "clone https://***@github.com/o/r failed",
  },
] as const) {
  test(name, () => {
    // arrange
    const text = input;

    // act
    const redacted = redactCredentials(text);

    // assert
    assert.strictEqual(redacted, expected);
  });
}

for (const { order, redact } of [
  {
    order: "credentials before paths",
    redact: (text: string) => redactAbsolutePaths(redactCredentials(text)),
  },
  {
    order: "paths before credentials",
    redact: (text: string) => redactCredentials(redactAbsolutePaths(text)),
  },
]) {
  test(`PMOD-04 ordering edge: redacting ${order} touches disjoint spans`, () => {
    // arrange
    const text = "fetch https://u:p@host/o/r failed at /srv/private/state.json";

    // act
    const redacted = redact(text);

    // assert
    assert.strictEqual(redacted, "fetch https://***@host/o/r failed at state.json");
  });
}
