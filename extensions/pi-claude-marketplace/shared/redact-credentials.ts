/**
 * PMOD-04 / D-05 / D-06: replaces the credentials a thrown message or a
 * user-typed subject name can carry, and nothing else. URL userinfo becomes
 * `***@`. The secret after `x-access-token:` or `Bearer` becomes `***`. A
 * GitHub token with a `ghp_`, `gho_`, `ghu_`, `ghs_`, `ghr_`, or `github_pat_`
 * prefix becomes `***`.
 *
 * D-07: the model calls this at every site that can carry a thrown message,
 * and on the subject names the user typed, so the text and JSON strategies
 * both read the redacted string.
 *
 * - Userinfo runs first, so a token inside userinfo collapses with it into
 *   one `***@`.
 * - Userinfo ends at the last `@` before the host, as WHATWG URL parsing and
 *   git read it, so a password with an unencoded `@` is replaced whole.
 * - The `scheme://`, `x-access-token:`, and `Bearer` prefixes stay, so the
 *   reader still sees which credential form the message carried.
 * - A prefixed token needs a body of 16 or more characters, so a short
 *   identifier that happens to start with a prefix stays intact.
 * - A prefixed token has no boundary anchor on either side. The userinfo
 *   pattern starts at the first character of a run of scheme characters
 *   (letters, digits, `+.-`), which keeps its scan linear. Either way, a
 *   secret glued to a word character (`xghp_...`, `ghp_..._suffix`,
 *   `remote_https://u:tok@host`) is still replaced.
 * - A `Bearer` secret sits on the same line, ends on a word character or
 *   `=` padding, and is token-shaped (see `isTokenShaped`). Prose such as
 *   `Bearer token required`, `a Bearer token.`, or `Bearer realm="GitHub"`
 *   stays intact.
 * - The scp-style marketplace name `git@host:owner/repo` is a subject the user
 *   must see. It has no `scheme://`, so the userinfo pattern never matches it.
 *
 * Only the secret span changes; the text around it stays byte for byte.
 */
export function redactCredentials(text: string): string {
  const userinfo = /(?<![a-z0-9+.-])([a-z0-9+.-]+:\/\/)[^\s/?#]+@/gi;
  const accessToken = /\b(x-access-token:)[^\s@/]+/gi;
  const bearer = /\b(Bearer[ \t]+)([\w.~+/-]*\w=*)/gi;
  const githubToken = /gh[pousr]_[A-Za-z0-9]{16,}|github_pat_\w{16,}/g;
  return text
    .replace(userinfo, "$1***@")
    .replace(accessToken, "$1***")
    .replace(bearer, (match: string, prefix: string, secret: string) =>
      isTokenShaped(secret) ? `${prefix}***` : match,
    )
    .replace(githubToken, "***");
}

/**
 * PMOD-04 / D-05: a `Bearer` secret is token-shaped when it carries a digit or one of
 * `_.~+/-`, or runs 16 or more characters. A plain word after `Bearer` is
 * prose, so it stays.
 */
function isTokenShaped(secret: string): boolean {
  return secret.length >= 16 || /[\d_.~+/-]/.test(secret);
}
