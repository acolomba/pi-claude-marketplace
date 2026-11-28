/**
 * D-SG-35: one `scheme://` token, as Claude Code's URL redaction reads it: a
 * scheme of at most 32 characters, `://`, then everything up to whitespace, a
 * quote, a backtick, or an angle bracket.
 */
const SCHEME_TOKEN = /[a-z][a-z0-9+.-]{0,31}:\/\/[^\s'"`<>]+/gi;

/** D-SG-35: a `?name=`, `&name=`, or `#name=` pair with a non-empty value. */
const URL_PAIR = /([?&#][^=?&#]*=)[^?&#]+/g;

/**
 * D-SG-35: the fixed-prefix provider rules of Claude Code 2.1.332's secret
 * table, each replaced whole by `***`. HashiCorp Terraform tokens have no
 * fixed prefix and stay out; the GitHub rows are the `githubToken` rule.
 * Upstream ends some rules with a consumed boundary character; here that
 * boundary is a `\b` or a lookahead, so the character after the token stays.
 */
const PROVIDER_TOKENS: readonly RegExp[] = [
  // aws-access-token
  /\b(?:A3T[A-Z0-9]|AKIA|ASIA|ABIA|ACCA)[A-Z2-7]{16}\b/g,
  // gcp-api-key
  /\bAIza[\w-]{35}(?![\w-])/g,
  // google-oauth-client-secret
  /\bGOCSPX-[\w-]{28}(?![\w-])/g,
  // digitalocean-pat, digitalocean-access-token
  /\bdop_v1_[a-f0-9]{64}\b/g,
  /\bdoo_v1_[a-f0-9]{64}\b/g,
  // anthropic-api-key, anthropic-admin-api-key, anthropic-oauth-token
  /sk-ant-api03-[\w-]{93}AA/g,
  /sk-ant-admin01-[\w-]{93}AA/g,
  /sk-ant-o(?:at|rt)\d{2}-[\w-]{20,}/g,
  // openai-api-key
  /sk-[\w-]{8,200}T3BlbkFJ[\w-]{8,200}/g,
  // huggingface-access-token
  /\bhf_[a-zA-Z]{34}\b/g,
  // supabase-secret-key, supabase-pat
  /\bsb_secret_[\w-]{20,}/g,
  /\bsbp_[a-z0-9]{40,}/g,
  // gitlab: glpat-, gldt-, glrt-, gloas-, glptt-, glagent-, glimt-, glsoat-,
  // glcbt-, glft-, glffct-
  /gl(?:pat|dt|rt|oas|ptt|agent|imt|soat|cbt|ft|ffct)-[\w=-]{20,}(?:\.[0-9a-z]{9})?/g,
  // slack-bot-token, slack-user-token, slack-config-token, slack-app-token,
  // slack-webhook-token
  /xoxb-\d{10,13}-\d{10,13}[a-zA-Z0-9-]*/g,
  /xox[a-z]-\d{10,13}-\d{10,13}-\d{10,13}-[a-zA-Z0-9-]{28,34}/g,
  /xoxe(?:\.xox[a-z])?-\d-[a-zA-Z0-9-]{28,}/g,
  /xapp-\d-[A-Z0-9]+-\d+-[a-z0-9]+/gi,
  /\bxwfp-[a-zA-Z0-9-]{20,}/g,
  // npm-access-token
  /\bnpm_[a-zA-Z0-9]{36}\b/g,
  // pypi-upload-token
  /pypi-AgEIcHlwaS5vcmc[\w-]{50,1000}/g,
  // sendgrid-api-token
  /\bSG\.[\w=.-]{66}(?![\w=.-])/g,
  // databricks-api-token
  /\bdapi[a-f0-9]{32}(?:-\d)?\b/g,
  // pulumi-api-token
  /\bpul-[a-f0-9]{40}\b/g,
  // postman-api-token
  /\bPMAK-[a-fA-F0-9]{24}-[a-fA-F0-9]{34}\b/g,
  // grafana-cloud-api-token, grafana-service-account-token
  /\bglc_[A-Za-z0-9+/]{32,400}={0,3}/g,
  /\bglsa_[A-Za-z0-9]{32}_[A-Fa-f0-9]{8}\b/g,
  // sentry-user-token
  /\bsntryu_[a-f0-9]{64}\b/g,
  // stripe-access-token
  /\b(?:sk|rk)_(?:test|live|prod)_[a-zA-Z0-9]{10,99}/g,
  // shopify-access-token, shopify-shared-secret
  /shpat_[a-fA-F0-9]{32}/g,
  /shpss_[a-fA-F0-9]{32}/g,
];

/**
 * PMOD-04 / D-05 / D-06 / D-SG-35: replaces the credentials a thrown message,
 * git's stderr, or a user-typed subject name can carry, and nothing else. The
 * rules run in this order:
 *
 * 1. URL userinfo becomes `***@`.
 * 2. Userinfo written with `%40` as its separator becomes `***%40`.
 * 3. The secret after `x-access-token:` becomes `***`.
 * 4. A token-shaped `Bearer` secret becomes `***`.
 * 5. Inside each `scheme://` token, the value of every `?name=value` and
 *    `&name=value` query pair, and of a `#name=value` fragment pair, becomes
 *    `***`. A query name and a bare fragment such as `#stable` stay, because a
 *    url source names its ref as `#<ref>`.
 * 6. The value of an `Authorization: Basic` header becomes `***`, at any
 *    length.
 * 7. A `Basic` value of 20 or more token characters becomes `***`, so
 *    `Basic realm="..."` prose stays.
 * 8. Each fixed-prefix provider token of Claude Code's secret table (AWS,
 *    Google, DigitalOcean, Anthropic, OpenAI, Hugging Face, Supabase, GitLab,
 *    Slack, npm, PyPI, SendGrid, Databricks, Pulumi, Postman, Grafana, Sentry,
 *    Stripe, Shopify) becomes `***`.
 * 9. A GitHub token with a `ghp_`, `gho_`, `ghu_`, `ghs_`, `ghr_`, or
 *    `github_pat_` prefix becomes `***`.
 *
 * D-07: the model calls this at every site that can carry a thrown message,
 * and on the subject names the user typed, so the text and JSON strategies
 * both read the redacted string.
 *
 * - Userinfo runs first, so a token inside userinfo collapses with it into
 *   one `***@`.
 * - Userinfo ends at the last `@` (or `%40`) before the host, as WHATWG URL
 *   parsing and git read it, so a password with an unencoded `@` is replaced
 *   whole.
 * - The `scheme://`, `x-access-token:`, `Bearer`, `Basic`, and query-name
 *   prefixes stay, so the reader still sees which credential form the message
 *   carried.
 * - A GitHub token needs a body of 16 or more characters, so a short
 *   identifier that happens to start with a prefix stays intact. A provider
 *   token keeps the length its upstream rule states.
 * - A GitHub token has no boundary anchor on either side. The userinfo
 *   patterns start at the first character of a run of scheme characters
 *   (letters, digits, `+.-`), which keeps their scan linear. Either way, a
 *   secret glued to a word character (`xghp_...`, `ghp_..._suffix`,
 *   `remote_https://u:tok@host`) is still replaced.
 * - A `Bearer` secret sits on the same line, ends on a word character or
 *   `=` padding, and is token-shaped (see `isTokenShaped`). Prose such as
 *   `Bearer token required`, `a Bearer token.`, or `Bearer realm="GitHub"`
 *   stays intact.
 * - The scp-style marketplace name `git@host:owner/repo` is a subject the user
 *   must see. It has no `scheme://`, so the userinfo patterns never match it.
 * - Every pattern is linear: an anchored literal prefix and one bounded
 *   character class, with no nested or adjacent overlapping quantifiers.
 *
 * Only the secret span changes; the text around it stays byte for byte.
 */
export function redactCredentials(text: string): string {
  const userinfo = /(?<![a-z0-9+.-])([a-z0-9+.-]+:\/\/)[^\s/?#]+@/gi;
  const encodedUserinfo = /(?<![a-z0-9+.-])([a-z0-9+.-]+:\/\/)[^\s/?#]*%40/gi;
  const accessToken = /\b(x-access-token:)[^\s@/]+/gi;
  const bearer = /\b(Bearer[ \t]+)([\w.~+/-]*\w=*)/gi;
  const authorizationBasic = /\b(Authorization:[ \t]*Basic[ \t]+)[^\s'"`]+/gi;
  const basicToken = /\b(Basic\s+)[\w+/=.~-]{20,}/g;
  const githubToken = /gh[pousr]_[A-Za-z0-9]{16,}|github_pat_\w{16,}/g;
  const redacted = text
    .replace(userinfo, "$1***@")
    .replace(encodedUserinfo, "$1***%40")
    .replace(accessToken, "$1***")
    .replace(bearer, (match: string, prefix: string, secret: string) =>
      isTokenShaped(secret) ? `${prefix}***` : match,
    )
    .replace(SCHEME_TOKEN, redactUrlPairs)
    .replace(authorizationBasic, "$1***")
    .replace(basicToken, "$1***");
  return PROVIDER_TOKENS.reduce(
    (current, pattern) => current.replace(pattern, "***"),
    redacted,
  ).replace(githubToken, "***");
}

/**
 * D-SG-35: replaces the value of each query or fragment pair of one
 * `scheme://` token. The pairs start at the first `?` or `#`, so a path
 * segment that holds `=` stays.
 */
function redactUrlPairs(token: string): string {
  const start = token.search(/[?#]/);
  if (start === -1) {
    return token;
  }

  return token.slice(0, start) + token.slice(start).replace(URL_PAIR, "$1***");
}

/**
 * PMOD-04 / D-05: a `Bearer` secret is token-shaped when it carries a digit or one of
 * `_.~+/-`, or runs 16 or more characters. A plain word after `Bearer` is
 * prose, so it stays.
 */
function isTokenShaped(secret: string): boolean {
  return secret.length >= 16 || /[\d_.~+/-]/.test(secret);
}
