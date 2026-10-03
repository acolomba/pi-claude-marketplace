/**
 * PMOD-04 / D-05 / D-06: replaces the credentials a thrown message can carry,
 * and nothing else. URL userinfo becomes `***@`. The secret after
 * `x-access-token:` or `Bearer` becomes `***`. A GitHub token with a `ghp_`,
 * `gho_`, `ghu_`, `ghs_`, `ghr_`, or `github_pat_` prefix becomes `***`.
 *
 * D-07: the model calls this at every site that can carry a thrown message,
 * so the text and JSON strategies both read the redacted string.
 *
 * - Userinfo runs first, so a token inside userinfo collapses with it into
 *   one `***@`.
 * - Userinfo ends at the last `@` before the host, as WHATWG URL parsing and
 *   git read it, so a password with an unencoded `@` is replaced whole.
 * - The `scheme://`, `x-access-token:`, and `Bearer` prefixes stay, so the
 *   reader still sees which credential form the message carried.
 * - A prefixed token needs a body of 16 or more characters, so a short
 *   identifier that happens to start with a prefix stays intact.
 * - The scp-style marketplace name `git@host:owner/repo` is a subject the user
 *   must see. It has no `scheme://`, so the userinfo pattern never matches it.
 *
 * Only the secret span changes; the text around it stays byte for byte.
 */
export function redactCredentials(text: string): string {
  const userinfo = /\b([a-z][a-z0-9+.-]*:\/\/)[^\s/?#]+@/gi;
  const accessToken = /\b(x-access-token:)[^\s@/]+/gi;
  const bearer = /\b(Bearer\s+)[\w.~+/=-]+/gi;
  const githubToken = /\b(?:gh[pousr]_[A-Za-z0-9]{16,}|github_pat_\w{16,})\b/g;
  return text
    .replace(userinfo, "$1***@")
    .replace(accessToken, "$1***")
    .replace(bearer, "$1***")
    .replace(githubToken, "***");
}
