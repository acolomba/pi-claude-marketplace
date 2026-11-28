import assert from "node:assert/strict";
import { test } from "node:test";

import { redactAbsolutePaths } from "../../extensions/pi-claude-marketplace/shared/redact-absolute-paths.ts";
import { redactCredentials } from "../../extensions/pi-claude-marketplace/shared/redact-credentials.ts";

const BODY_36 = "0123456789abcdefghijklmnopqrstuvwxyz";
const BODY_16 = "0123456789abcdef";
const BODY_15 = "0123456789abcde";
const HEX_64 = "0123456789abcdef".repeat(4);
const WORD_93 = BODY_36.repeat(3).slice(0, 93);
const BASIC_BODY = "dXNlcjpwYXNzd29yZC0xMjM0NTY=";

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
    name: "D-SG-35 replaces userinfo that uses %40 as its separator with ***%40",
    input: "clone https://alice:pw%40host/x failed",
    expected: "clone https://***%40host/x failed",
  },
  {
    name: "D-SG-35 replaces userinfo up to the last %40 before the host",
    input: "clone https://alice:p%40ss%40host/x failed",
    expected: "clone https://***%40host/x failed",
  },
  {
    name: "D-SG-35 replaces the value of every query pair and keeps each name",
    input: "clone https://host/x.git?private_token=tok&ref=main failed",
    expected: "clone https://host/x.git?private_token=***&ref=*** failed",
  },
  {
    name: "D-SG-35 replaces a query value as git prints it, through the trailing slash",
    input: "fatal: repository 'https://127.0.0.1:1/acme/tools.git?private_token=word/' not found",
    expected: "fatal: repository 'https://127.0.0.1:1/acme/tools.git?private_token=***' not found",
  },
  {
    name: "D-SG-35 replaces the query value and the userinfo of one URL",
    input: "clone https://alice:pw@host/x.git?private_token=tok failed",
    expected: "clone https://***@host/x.git?private_token=*** failed",
  },
  {
    name: "D-SG-35 replaces the value of a name=value fragment pair",
    input: "clone https://host/x.git#access_token=tok failed",
    expected: "clone https://host/x.git#access_token=*** failed",
  },
  {
    name: "D-SG-35 keeps a bare fragment ref",
    input: "clone https://host/x.git#stable failed",
    expected: "clone https://host/x.git#stable failed",
  },
  {
    name: "D-SG-35 keeps a query name with no value",
    input: "clone https://host/x.git?private_token= failed",
    expected: "clone https://host/x.git?private_token= failed",
  },
  {
    name: "D-SG-35 keeps a query name with no equals sign",
    input: "clone https://host/x.git?private_token failed",
    expected: "clone https://host/x.git?private_token failed",
  },
  {
    name: "D-SG-35 keeps an equals sign in a path segment",
    input: "clone https://host/a=b/x.git failed",
    expected: "clone https://host/a=b/x.git failed",
  },
  {
    name: "D-SG-35 keeps a query pair outside a scheme:// token",
    input: "read ./tools.json?v=2 failed",
    expected: "read ./tools.json?v=2 failed",
  },
  {
    name: "D-SG-35 replaces a short Authorization: Basic value",
    input: "sent Authorization: Basic dXNlcjpwYXNz to host",
    expected: "sent Authorization: Basic *** to host",
  },
  {
    name: "D-SG-35 matches a lower-case authorization: basic header",
    input: "sent authorization: basic dXNlcjpwYXNz to host",
    expected: "sent authorization: basic *** to host",
  },
  {
    name: "D-SG-35 replaces a Basic value of 20 or more token characters",
    input: `sent Basic ${BASIC_BODY} to host`,
    expected: "sent Basic *** to host",
  },
  {
    name: "D-SG-35 keeps a short Basic value outside an Authorization header",
    input: "sent Basic dXNlcjpwYXNz to host",
    expected: "sent Basic dXNlcjpwYXNz to host",
  },
  {
    name: "D-SG-35 keeps a Basic challenge realm",
    input: 'WWW-Authenticate: Basic realm="git host"',
    expected: 'WWW-Authenticate: Basic realm="git host"',
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

for (const { provider, prefix, body } of [
  { provider: "aws-access-token", prefix: "AKIA", body: "ABCDEFGHIJKLMNOP" },
  { provider: "gcp-api-key", prefix: "AIza", body: BODY_36.slice(0, 35) },
  { provider: "google-oauth-client-secret", prefix: "GOCSPX-", body: BODY_36.slice(0, 28) },
  { provider: "digitalocean-pat", prefix: "dop_v1_", body: HEX_64 },
  { provider: "digitalocean-access-token", prefix: "doo_v1_", body: HEX_64 },
  { provider: "anthropic-api-key", prefix: "sk-ant-api03-", body: `${WORD_93}AA` },
  { provider: "anthropic-admin-api-key", prefix: "sk-ant-admin01-", body: `${WORD_93}AA` },
  { provider: "anthropic-oauth-token", prefix: "sk-ant-oat01-", body: BODY_36 },
  { provider: "openai-api-key", prefix: "sk-", body: "abcdefghT3BlbkFJijklmnop" },
  {
    provider: "huggingface-access-token",
    prefix: "hf_",
    body: "abcdefghijklmnopqrstuvwxyzABCDEFGH",
  },
  { provider: "supabase-secret-key", prefix: "sb_secret_", body: BODY_36 },
  { provider: "supabase-pat", prefix: "sbp_", body: `${BODY_36}abcd` },
  { provider: "gitlab glpat-", prefix: "glpat-", body: BODY_36 },
  {
    provider: "gitlab glpat- with its routing suffix",
    prefix: "glpat-",
    body: `${BODY_36}.0123abcde`,
  },
  { provider: "gitlab gldt-", prefix: "gldt-", body: BODY_36 },
  { provider: "gitlab glrt-", prefix: "glrt-", body: BODY_36 },
  { provider: "gitlab gloas-", prefix: "gloas-", body: BODY_36 },
  { provider: "gitlab glptt-", prefix: "glptt-", body: BODY_36 },
  { provider: "gitlab glagent-", prefix: "glagent-", body: BODY_36 },
  { provider: "gitlab glimt-", prefix: "glimt-", body: BODY_36 },
  { provider: "gitlab glsoat-", prefix: "glsoat-", body: BODY_36 },
  { provider: "gitlab glcbt-", prefix: "glcbt-", body: BODY_36 },
  { provider: "gitlab glft-", prefix: "glft-", body: BODY_36 },
  { provider: "gitlab glffct-", prefix: "glffct-", body: BODY_36 },
  { provider: "slack-bot-token", prefix: "xoxb-", body: "1234567890-1234567890abcDEF" },
  {
    provider: "slack-user-token",
    prefix: "xoxp-",
    body: `1234567890-1234567890-1234567890-${BODY_36.slice(0, 28)}`,
  },
  { provider: "slack-config-token", prefix: "xoxe.xoxp-", body: `1-${BODY_36.slice(0, 28)}` },
  { provider: "slack-app-token", prefix: "xapp-", body: "1-A0123BCD-1234-abc123" },
  { provider: "slack-webhook-token", prefix: "xwfp-", body: BODY_36.slice(0, 20) },
  { provider: "npm-access-token", prefix: "npm_", body: BODY_36 },
  { provider: "pypi-upload-token", prefix: "pypi-AgEIcHlwaS5vcmc", body: `${BODY_36}${BODY_36}` },
  { provider: "sendgrid-api-token", prefix: "SG.", body: `${BODY_36}${BODY_36}`.slice(0, 66) },
  { provider: "databricks-api-token", prefix: "dapi", body: HEX_64.slice(0, 32) },
  { provider: "pulumi-api-token", prefix: "pul-", body: HEX_64.slice(0, 40) },
  {
    provider: "postman-api-token",
    prefix: "PMAK-",
    body: `${HEX_64.slice(0, 24)}-${HEX_64.slice(0, 34)}`,
  },
  { provider: "grafana-cloud-api-token", prefix: "glc_", body: `${BODY_36}==` },
  {
    provider: "grafana-service-account-token",
    prefix: "glsa_",
    body: `${BODY_36.slice(0, 32)}_0123abcd`,
  },
  { provider: "sentry-user-token", prefix: "sntryu_", body: HEX_64 },
  { provider: "stripe-access-token", prefix: "sk_live_", body: BODY_36 },
  { provider: "shopify-access-token", prefix: "shpat_", body: HEX_64.slice(0, 32) },
  { provider: "shopify-shared-secret", prefix: "shpss_", body: HEX_64.slice(0, 32) },
] as const) {
  test(`D-SG-35 replaces a token of the ${provider} shape and keeps the text around it`, () => {
    // arrange
    const text = `token ${prefix}${body}; bad`;

    // act
    const redacted = redactCredentials(text);

    // assert
    assert.strictEqual(redacted, "token ***; bad");
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
