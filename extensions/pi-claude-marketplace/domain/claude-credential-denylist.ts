// domain/claude-credential-denylist.ts
//
// Claude Code 2.1.291's credential deny-list for plugin MCP variables
// (AVAR-05). This module is a domain-tier static snapshot: pure data and name
// predicates, no I/O and no imports. Each list is copied verbatim from the
// 2.1.291 binary, in Claude's order, and each exported set is built the way
// Claude builds it, so the lists can be compared with the binary's text. The
// comment above each list names Claude's minified identifier.
//
// Claude also blanks names from sets that depend on how Claude itself runs: a
// host-managed provider (`Gqe`), a bridge child (`Voo`), the HIPAA tier
// (`Gur`) and the subprocess-scrub value heuristics (`tRe`). Pi never runs in
// those modes, so this snapshot leaves them out. The test that pins the
// snapshot names the Claude Code version.

const INPUT_PREFIX = "INPUT_";

function withInputVariants(names: readonly string[]): string[] {
  return names.flatMap((name) => [name, `${INPUT_PREFIX}${name}`]);
}

function upperCased(names: readonly string[]): string[] {
  return names.map((name) => name.toUpperCase());
}

// `X5t`: file-descriptor credential names.
const CLAUDE_FILE_DESCRIPTOR_NAMES = [
  "CLAUDE_CODE_OAUTH_TOKEN_FILE_DESCRIPTOR",
  "CLAUDE_CODE_GATEWAY_TOKEN_FILE_DESCRIPTOR",
  "CLAUDE_CODE_API_KEY_FILE_DESCRIPTOR",
  "CLAUDE_CODE_WEBSOCKET_AUTH_FILE_DESCRIPTOR",
  "CCR_AGENT_PROXY_TOKEN_FILE_DESCRIPTOR",
];

// `J5t`: Claude's own credentials.
const CLAUDE_CREDENTIAL_NAMES = [
  "CLAUDE_CODE_OAUTH_TOKEN",
  ...CLAUDE_FILE_DESCRIPTOR_NAMES,
  "CLAUDE_CODE_ARTIFACTS_API_TOKEN",
  "CLAUDE_CODE_SLACK_TAG_TOKEN",
  "CLAUDE_CODE_HFI_BEARER_TOKEN",
  "CLAUDE_BRIDGE_OAUTH_TOKEN",
  "CLAUDE_TRUSTED_DEVICE_TOKEN",
  "AGENT_PROXY_AUTH_TOKEN",
  "CLAUDE_CODE_MCP_SERVE_AUTH_TOKEN",
  "CLAUDE_BG_AUTH_SNAPSHOT_PATH",
  "CLAUDE_BG_SOCKET_TOKENS_PATH",
  "CLAUDE_BG_RV_AUTH",
  "CLAUDE_BG_PTY_AUTH",
  "CLAUDE_BG_CLAIM_AUTH",
];

// The ten literal names `qur()` adds.
const CLAUDE_SESSION_LITERAL_NAMES = [
  "CLAUDE_CODE_SUBSCRIPTION_TYPE",
  "CLAUDE_CODE_RATE_LIMIT_TIER",
  "CLAUDE_CODE_PLUGIN_ATTRIBUTION",
  "CLAUDE_CODE_SKILL_ATTRIBUTION",
  "CLAUDE_CODE_BRIDGE_CHILD_AUTO_DEFAULT",
  "CLAUDE_CODE_BRIDGE_CHILD_ARTIFACT",
  "CLAUDE_CODE_BRIDGE_CHILD_MACHINE_SETTINGS",
  "CLAUDE_CODE_CONFIG_PROBE",
  "CLAUDE_CODE_HOST_PROMPT_SUPERSEDES_RECORD",
  "CLAUDE_CODE_MCP_SERVE_SETTINGS",
];

// `mrt`: background dispatcher state.
const CLAUDE_DISPATCHER_NAMES = [
  "CLAUDE_BG_DISPATCHER_SUBSCRIPTION_TYPE",
  "CLAUDE_BG_DISPATCHER_RATE_LIMIT_TIER",
];

// `mqe`: session state.
const CLAUDE_SESSION_STATE_NAMES = [
  "CLAUDE_CODE_SESSION_KIND",
  "CLAUDE_BG_SOURCE",
  "CLAUDE_BG_ISOLATION",
  "CLAUDE_BG_BACKEND",
  "CLAUDE_CODE_SESSION_NAME",
  "CLAUDE_CODE_RESUME_INTERRUPTED_TURN",
  "CLAUDE_CODE_RESUME_INTERRUPTED_TURN_MAX_AGE_MS",
  "CLAUDE_CODE_RESUME_PROMPT",
  "CLAUDE_CODE_RESUME_REASON",
  "CLAUDE_CODE_RESUME_SOURCE_ALIVE",
  "CLAUDE_BG_POST_CLEAR_RESPAWN",
  "CLAUDE_BG_SESSION_PERMISSION_RULES",
  "CLAUDE_BG_MEMORY_TOGGLED_OFF",
  "CLAUDE_BG_AUTO_MEMORY_OFF",
  "CLAUDE_BG_WORKSPACE_TRUSTED",
  "CLAUDE_CODE_RELAUNCH_HOME_TRUST",
  ...CLAUDE_DISPATCHER_NAMES,
];

// `ANn`: secrets blanked with their `INPUT_` variants (`Wit`).
const CLAUDE_SECRET_NAMES = [
  "CLAUDE_CODE_OAUTH_REFRESH_TOKEN",
  "CLAUDE_SESSION_INGRESS_TOKEN_FILE",
  "CLAUDE_CODE_HOST_CREDS_FILE",
  "CLAUDE_CODE_MESSAGING_TOKEN",
  "MCP_CLIENT_SECRET",
  "MCP_XAA_IDP_CLIENT_SECRET",
  "ENVIRONMENT_SERVICE_KEY",
  "SELF_HOSTED_RUNNER_POOL_SECRET",
  "SELF_HOSTED_RUNNER_ENVIRONMENT_SECRET",
];

// `No`: cloud, CI, registry, webhook and Anthropic credentials.
const REMOTE_CREDENTIAL_NAMES = [
  "ANTHROPIC_API_KEY",
  "CLAUDE_CODE_OAUTH_TOKEN",
  "CLAUDE_CODE_ARTIFACTS_API_TOKEN",
  "CLAUDE_CODE_MEMORY_API_TOKEN",
  "CLAUDE_CODE_SLACK_TAG_TOKEN",
  "ANTHROPIC_AUTH_TOKEN",
  "ANTHROPIC_FOUNDRY_API_KEY",
  "ANTHROPIC_FOUNDRY_AUTH_TOKEN",
  "ANTHROPIC_AWS_API_KEY",
  "ANTHROPIC_CUSTOM_HEADERS",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_SESSION_TOKEN",
  "AWS_BEARER_TOKEN_BEDROCK",
  "GOOGLE_APPLICATION_CREDENTIALS",
  "GOOGLE_GHA_CREDS_PATH",
  "AZURE_CLIENT_SECRET",
  "IDENTITY_HEADER",
  "MSI_SECRET",
  "AZURE_CLIENT_CERTIFICATE_PATH",
  "AZURE_CLIENT_CERTIFICATE_PASSWORD",
  "AZURE_PASSWORD",
  "AZURE_FEDERATED_TOKEN_FILE",
  "AWS_WEB_IDENTITY_TOKEN_FILE",
  "AWS_CONTAINER_CREDENTIALS_RELATIVE_URI",
  "AWS_CONTAINER_CREDENTIALS_FULL_URI",
  "AWS_CONTAINER_AUTHORIZATION_TOKEN",
  "AWS_CONTAINER_AUTHORIZATION_TOKEN_FILE",
  "CLOUDSDK_AUTH_ACCESS_TOKEN",
  "GOOGLE_OAUTH_ACCESS_TOKEN",
  "CLAUDE_CODE_OAUTH_REFRESH_TOKEN",
  "HF_TOKEN",
  "HUGGING_FACE_HUB_TOKEN",
  "HUGGINGFACEHUB_API_TOKEN",
  "NODE_AUTH_TOKEN",
  "NUGET_AUTH_TOKEN",
  "CARGO_REGISTRY_TOKEN",
  "TWINE_PASSWORD",
  "TWINE_USERNAME",
  "PYPI_TOKEN",
  "PYPI_API_TOKEN",
  "UV_PUBLISH_TOKEN",
  "UV_PUBLISH_PASSWORD",
  "UV_PUBLISH_USERNAME",
  "FLIT_PASSWORD",
  "FLIT_USERNAME",
  "HATCH_INDEX_AUTH",
  "HATCH_INDEX_USER",
  "GEM_HOST_API_KEY",
  "MATURIN_PYPI_TOKEN",
  "MATURIN_PASSWORD",
  "MATURIN_USERNAME",
  "CONAN_LOGIN_USERNAME",
  "CONAN_PASSWORD",
  "ANACONDA_API_TOKEN",
  "BINSTAR_API_TOKEN",
  "VAULT_TOKEN",
  "VAULT_AUTH_TOKEN",
  "VAULT_ROLE_ID",
  "VAULT_SECRET_ID",
  "CONSUL_HTTP_TOKEN",
  "CONSUL_HTTP_AUTH",
  "NOMAD_TOKEN",
  "NOMAD_HTTP_AUTH",
  "CI_REGISTRY_USER",
  "CI_DEPLOY_USER",
  "JF_USER",
  "FASTLANE_SESSION",
  "MATCH_GIT_BASIC_AUTHORIZATION",
  "SONAR_TOKEN",
  "SONARQUBE_SCANNER_PARAMS",
  "SONAR_SCANNER_JSON_PARAMS",
  "SLACK_WEBHOOK_URL",
  "SLACK_WEBHOOK",
  "DISCORD_WEBHOOK",
  "DISCORD_WEBHOOK_URL",
  "TEAMS_WEBHOOK_URL",
  "MS_TEAMS_WEBHOOK_URI",
  "ANTHROPIC_IDENTITY_TOKEN",
  "ANTHROPIC_IDENTITY_TOKEN_FILE",
  "CLOUDSDK_AUTH_ACCESS_TOKEN_FILE",
  "CLOUDSDK_AUTH_AUTHORIZATION_TOKEN_FILE",
  "AZURE_AUTH_LOCATION",
  "ACTIONS_ID_TOKEN_REQUEST_TOKEN",
  "ACTIONS_ID_TOKEN_REQUEST_URL",
  "ACTIONS_RUNTIME_TOKEN",
  "ACTIONS_RUNTIME_URL",
  "ALL_INPUTS",
  "VSS_NUGET_EXTERNAL_FEED_ENDPOINTS",
  "ARTIFACTS_CREDENTIALPROVIDER_EXTERNAL_FEED_ENDPOINTS",
  "VSS_NUGET_ACCESSTOKEN",
  "ARTIFACTS_CREDENTIALPROVIDER_ACCESSTOKEN",
  "COMPOSER_AUTH",
  "OVERRIDE_GITHUB_TOKEN",
  "DEFAULT_WORKFLOW_TOKEN",
  "SSH_SIGNING_KEY",
];

// `MNn`: names Claude removes from the remote-sink list.
const REMOTE_SINK_EXEMPT_NAMES: ReadonlySet<string> = new Set([
  "GH_ENTERPRISE_TOKEN",
  "GITHUB_ENTERPRISE_TOKEN",
  "HF_TOKEN",
  "HUGGING_FACE_HUB_TOKEN",
  "HUGGINGFACEHUB_API_TOKEN",
]);

// `PNn`: proxy, package-index and further cloud credential names.
const REMOTE_PROXY_AND_INDEX_NAMES = [
  "AWS_CONTAINER_AUTHORIZATION_TOKEN",
  "ANTHROPIC_IDENTITY_TOKEN",
  "CLOUDSDK_AUTH_ACCESS_TOKEN",
  "GOOGLE_OAUTH_ACCESS_TOKEN",
  "AZURE_CLIENT_CERTIFICATE_PASSWORD",
  "AZURE_PASSWORD",
  "CLAUDE_CODE_CLIENT_KEY_PASSPHRASE",
  "CLAUDE_CODE_CLIENT_KEY",
  "CLAUDE_CODE_CLIENT_CERT",
  "HTTPS_PROXY",
  "HTTP_PROXY",
  "ALL_PROXY",
  "https_proxy",
  "http_proxy",
  "all_proxy",
  "CARGO_REGISTRY_TOKEN",
  "NPM_TOKEN",
  "CODEARTIFACT_AUTH_TOKEN",
  "PIP_INDEX_URL",
  "PIP_EXTRA_INDEX_URL",
  "UV_INDEX_URL",
  "UV_EXTRA_INDEX_URL",
  "UV_DEFAULT_INDEX",
  "UV_INDEX",
  "GOPROXY",
  "GOAUTH",
  "PYPI_TOKEN",
  "TWINE_PASSWORD",
];

// `br`: the memory API names.
const MEMORY_API_NAMES = new Set([
  "CLAUDE_CODE_MEMORY_API_BASE_URL",
  "CLAUDE_CODE_MEMORY_API_TOKEN",
]);

// `ON`: Claude's provider and service endpoints.
const CLAUDE_ENDPOINT_NAMES = [
  "ANTHROPIC_BASE_URL",
  "_CLAUDE_CODE_ASSUME_FIRST_PARTY_BASE_URL",
  "ANTHROPIC_BEDROCK_BASE_URL",
  "ANTHROPIC_VERTEX_BASE_URL",
  "ANTHROPIC_FOUNDRY_BASE_URL",
  "ANTHROPIC_AWS_BASE_URL",
  "ANTHROPIC_GOOGLE_CLOUD_BASE_URL",
  "ANTHROPIC_BEDROCK_MANTLE_BASE_URL",
  "CLAUDE_CODE_ARTIFACTS_API_BASE_URL",
  "CLAUDE_CODE_ARTIFACTS_API_TOKEN",
  "CLAUDE_CODE_ARTIFACT_ASSET_BASE_URL",
  "CLAUDE_CODE_ARTIFACT_LIVE_BASE_URL",
  "CLAUDE_CODE_ARTIFACT_SYNC_BASE_URL",
  "CLAUDE_CODE_ARTIFACT_VIEWER_BASE_URL",
  ...MEMORY_API_NAMES,
];

/**
 * AVAR-05: the names Claude blanks in every field (`U4().plain`), uppercase:
 * Claude's own credentials, its session state and its secrets with their
 * `INPUT_` variants. A name matching {@link matchesPlainNamePattern} is
 * blanked too.
 */
export const PLAIN_DENIED_NAMES: ReadonlySet<string> = new Set([
  ...upperCased([
    ...CLAUDE_CREDENTIAL_NAMES,
    ...CLAUDE_SESSION_LITERAL_NAMES,
    ...CLAUDE_SESSION_STATE_NAMES,
  ]),
  ...upperCased(withInputVariants(CLAUDE_SECRET_NAMES)),
]);

/**
 * AVAR-05: the names Claude blanks in a remote server's `url` and `headers`
 * (`U4().remoteSink`), uppercase: the plain names plus cloud, CI, registry,
 * proxy and package-index credentials with their `INPUT_` variants. A name
 * matching {@link matchesRemoteSinkNamePattern} is blanked too.
 */
export const REMOTE_SINK_DENIED_NAMES: ReadonlySet<string> = new Set([
  ...PLAIN_DENIED_NAMES,
  ...upperCased([
    ...withInputVariants(REMOTE_CREDENTIAL_NAMES).filter(
      (name) => !REMOTE_SINK_EXEMPT_NAMES.has(name.replace(/^INPUT_/, "")),
    ),
    ...withInputVariants(REMOTE_PROXY_AND_INDEX_NAMES),
  ]),
]);

/**
 * AVAR-05: the endpoint names whose value Claude checks for an embedded
 * credential in `url` and `headers` (`FNn`).
 */
export const CREDENTIAL_BASE_URL_NAMES: ReadonlySet<string> = new Set(
  withInputVariants([
    ...CLAUDE_ENDPOINT_NAMES.filter((name) => name.endsWith("_BASE_URL")),
    "CLAUDE_CODE_API_BASE_URL",
  ]),
);

// `Wur`: the artifact service endpoints.
function isArtifactBaseUrlName(name: string): boolean {
  return name.startsWith("CLAUDE_CODE_ARTIFACT") && name.endsWith("_BASE_URL");
}

/**
 * AVAR-05: Claude's `NDe` over an uppercase name. After one leading `INPUT_`
 * is removed, the name is an artifact `*_BASE_URL`, a memory API name, an
 * `OTEL_*` name or `CLAUDE_CODE_OTEL_DIAG_STDERR`.
 */
export function matchesPlainNamePattern(upper: string): boolean {
  const name = upper.replace(/^INPUT_/, "");
  return (
    isArtifactBaseUrlName(name) ||
    MEMORY_API_NAMES.has(name) ||
    name.startsWith("OTEL_") ||
    name === "CLAUDE_CODE_OTEL_DIAG_STDERR"
  );
}

// `mn`, `Sn`, `En` and `hn`: the secret words of Claude's `tn`.
const SECRET_WORDS = [
  "TOKEN",
  "SECRET",
  "PASSWORD",
  "PASSWD",
  "PASSPHRASE",
  "KEY",
  "AUTH",
  "COOKIE",
  "PAT",
  "DSN",
  "WEBHOOK",
  "CREDENTIAL",
  "CREDENTIALS",
  "CREDS",
  "APIKEY",
  "ACCESSKEY",
  "SECRETKEY",
  "ACCOUNTKEY",
  "PRIVATEKEY",
  "AUTHKEY",
  "SSHKEY",
  "SIGNINGKEY",
  "MASTERKEY",
  "DEPLOYKEY",
  "ENCRYPTIONKEY",
  "PGPASSWORD",
  "SSHPASS",
];
const SHORT_SECRET_WORDS = ["PWD", "PASS", "JWT"];
const UNBOUNDED_SECRET_WORDS = ["TOKEN", "SECRET", "PASSWORD", "PASSWD", "PASSPHRASE"];
const PLURAL_SECRET_WORDS = ["KEY", "SECRET", "PASSWORD", "CREDENTIAL"];

// `tn`: Claude's secret-name word rule.
const SECRET_NAME = new RegExp(
  `((^|_)(${SECRET_WORDS.join("|")}|(${PLURAL_SECRET_WORDS.join("|")})S)|_(${SHORT_SECRET_WORDS.join("|")})|(${UNBOUNDED_SECRET_WORDS.join("|")}))(?=$|[_0-9])`,
  "i",
);

// `st`: a connection string.
const CONNECTION_STRING_NAME = /CONN(ECT(ION)?)?_?STR(ING)?S?(?=$|[_0-9])/i;

// `gn`: camel-case words Claude splits as one word.
const CAMEL_CASE_WORDS = ["OAuth", "NextAuth"];

// `fn`: Claude's camel-case splitter.
function splitCamelCase(name: string): string {
  return CAMEL_CASE_WORDS.reduce(
    (text, word) => text.replaceAll(word, word.charAt(0) + word.slice(1).toLowerCase()),
    name,
  )
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1_$2");
}

// `hso`.
function isConnectionStringName(name: string): boolean {
  return CONNECTION_STRING_NAME.test(name) || CONNECTION_STRING_NAME.test(splitCamelCase(name));
}

// `Nn` and `li`: Bundler setting words, and the host form that may follow one.
const BUNDLER_SETTING_WORDS = [
  "BUILD",
  "LOCAL",
  "MIRROR",
  "PATH",
  "WITH",
  "WITHOUT",
  "CACHE",
  "DISABLE",
  "IGNORE",
  "ONLY",
];
const BUNDLER_HOST = "(?:[A-Za-z0-9]+(?:___[A-Za-z0-9]+)*__)+[A-Za-z]{2,}";

// `w5t`: a Bundler host credential.
const BUNDLER_CREDENTIAL_NAME = new RegExp(
  String.raw`^(?:INPUT_)?BUNDLE_(?!(?:${BUNDLER_SETTING_WORDS.join("|")})__(?!${BUNDLER_HOST}$))\w*__`,
  "i",
);

// `si` and `Uo`.
const AUTH0_PREFIX = /^AUTH0_/i;
// eslint-disable-next-line sonarjs/concise-regex -- verbatim Claude Code 2.1.291 Uo
const GIT_CONFIG_KEY_NAME = /^GIT_CONFIG_KEY_[0-9][A-Za-z0-9_]*$/;

// `Fae`: Claude's secret-looking-name heuristic.
function looksLikeSecretName(name: string): boolean {
  const normalized = name.replace(AUTH0_PREFIX, "").replaceAll("-", "_");
  return (
    (SECRET_NAME.test(normalized) ||
      SECRET_NAME.test(splitCamelCase(normalized)) ||
      isConnectionStringName(normalized) ||
      BUNDLER_CREDENTIAL_NAME.test(normalized)) &&
    !GIT_CONFIG_KEY_NAME.test(name)
  );
}

// `bn` and `ut`: tool prefixes that carry per-registry credentials.
const REGISTRY_CREDENTIAL_PREFIXES = [
  "INPUT_",
  "ORG_GRADLE_PROJECT_",
  "POETRY_PYPI_TOKEN_",
  "POETRY_HTTP_BASIC_",
  "CARGO_REGISTRIES_",
  "CONAN_LOGIN_USERNAME_",
  "CONAN_PASSWORD_",
];
const REGISTRY_USER_PREFIXES = ["POETRY_HTTP_BASIC_", "CONAN_LOGIN_USERNAME_"];

// `gi` and `fi`.
const REGISTRY_CREDENTIAL_PREFIX = new RegExp(
  `^(?:${REGISTRY_CREDENTIAL_PREFIXES.join("|")})`,
  "i",
);
const REGISTRY_USER_PREFIX = new RegExp(`^(?:INPUT_)?(?:${REGISTRY_USER_PREFIXES.join("|")})`, "i");

// `v5t`: a per-registry credential name.
function isRegistryCredentialName(name: string): boolean {
  const normalized = name.replaceAll("-", "_");
  return (
    REGISTRY_CREDENTIAL_PREFIX.test(normalized) &&
    (REGISTRY_USER_PREFIX.test(normalized) ||
      // eslint-disable-next-line sonarjs/concise-regex -- verbatim Claude Code 2.1.291 v5t
      /USER(?:_?NAME)?_?[0-9]*$/i.test(normalized) ||
      looksLikeSecretName(normalized))
  );
}

/**
 * AVAR-05: Claude's `ZEe` over an uppercase name: {@link matchesPlainNamePattern},
 * or, after one leading `INPUT_` is removed, a `GIT_CONFIG_*` setting, a
 * `CARGO_REGISTRIES_*_TOKEN`, a per-registry credential or a Bundler host
 * credential.
 */
export function matchesRemoteSinkNamePattern(upper: string): boolean {
  const name = upper.replace(/^INPUT_/, "");
  return (
    matchesPlainNamePattern(upper) ||
    /^GIT_CONFIG_(?:PARAMETERS|(?:KEY|VALUE)_\d+)$/.test(name) ||
    /^CARGO_REGISTRIES_[A-Z0-9_]+_TOKEN$/.test(name) ||
    isRegistryCredentialName(name) ||
    BUNDLER_CREDENTIAL_NAME.test(name)
  );
}

// `He`: Claude reads at most this many characters of a value.
const CREDENTIAL_SCAN_LIMIT = 8192;

// `mi`: a userinfo part shaped like a token.
function isTokenShaped(userinfo: string): boolean {
  return (
    /^(?:gh[opusr]_|github_pat_|glpat-|xox[abpr]-|sk-|pk-|AKIA|eyJ|ya29\.|npm_)/.test(userinfo) ||
    // eslint-disable-next-line sonarjs/concise-regex -- verbatim Claude Code 2.1.291 mi
    (userinfo.length >= 20 && /[0-9]/.test(userinfo) && /[a-z]/i.test(userinfo))
  );
}

// `Ei` and `hi`: host forms.
const HOST_WITH_DOMAIN =
  // eslint-disable-next-line sonarjs/regex-complexity -- verbatim Claude Code 2.1.291 Ei
  /^(?:localhost|[a-z0-9_-]+(?:\.[a-z0-9_-]+)*\.(?=[a-z0-9-]*[a-z])[a-z0-9-]+|[a-z0-9_.-]+(?=:\d+(?:[/?#]|$))|\d{1,3}(?:\.\d{1,3}){3}|\[[0-9a-f:.]+\])(?::\d+)?(?:[/?#]|$)/i;
const HOST_NAME =
  // eslint-disable-next-line sonarjs/regex-complexity -- verbatim Claude Code 2.1.291 hi
  /^(?:(?=[a-z0-9._-]*[a-z])[a-z0-9._-]+|\d{1,3}(?:\.\d{1,3}){3}|\[[0-9a-f:.]+\])(?::\d+)?(?:[/?#]|$)/i;

// `sn`: the text before `@` is `host:port/path` and the text after it is a
// version, a tag or a path rather than a host, so the `@` is not userinfo.
function isHostPortPath(beforeAt: string, afterAt: string): boolean {
  const match = /^([a-z0-9_-]+(?:\.[a-z0-9_-]+)*):\d+([/?#].*)$/is.exec(beforeAt);
  if (!match) {
    return false;
  }

  const [, , path = ""] = match;
  if (/[?#&]/.test(path)) {
    return true;
  }

  if (HOST_WITH_DOMAIN.test(afterAt)) {
    return false;
  }

  if (beforeAt.endsWith("/")) {
    return true;
  }

  if (/^(?:v?\d|sha\d*:)/i.test(afterAt)) {
    return true;
  }

  return !HOST_NAME.test(afterAt);
}

// `r` inside `JA`: an authority that carries `user:pass@` or a token-shaped
// user before `@`.
function authorityCarriesCredential(authority: string): boolean {
  const space = authority.search(/\s/);
  const word = space === -1 ? authority : authority.slice(0, space);
  const at = word.lastIndexOf("@");
  if (at === -1) {
    return false;
  }

  const userinfo = word.slice(0, at);
  if (isHostPortPath(userinfo, word.slice(at + 1))) {
    return false;
  }

  return userinfo.includes(":") || (!/[/?#]/.test(userinfo) && isTokenShaped(userinfo));
}

// Every `scheme://` authority, then a leading network-path `//` authority.
function schemeAuthorityCarriesCredential(text: string): boolean {
  let separator = text.indexOf("://");
  while (separator !== -1) {
    if (separator > 0 && /[a-z0-9+.-]/i.test(text.charAt(separator - 1))) {
      if (authorityCarriesCredential(text.slice(separator + 3))) {
        return true;
      }
    }

    separator = text.indexOf("://", separator + 3);
  }

  return text.startsWith("//") && authorityCarriesCredential(text.slice(2));
}

// `Si`: digest, npm and Maven coordinates that hold `@`.
const PACKAGE_COORDINATE =
  // eslint-disable-next-line sonarjs/regex-complexity -- verbatim Claude Code 2.1.291 Si
  /^(?:[\w.-]+(?::[\w.-]+)?@sha(?:256|384|512):[0-9a-f]{32,}|npm:(?:@[\w.-]+\/)?[\w.-]+@[\w.^~<>=*|+-]*|[a-z_][\w.-]*:[\w.-]+:v?\d[\w.+[\](),-]*@(?:jar|war|ear|aar|apk|aab|pom|zip|tar|tgz|module|klib|exe|dll|so|dylib)?)$/i;

// A bare `user:pass@host` with no scheme, unless it is a drive path, a
// package coordinate, a `host:port/path@version` or a mail-like URI.
function bareUserinfoCarriesCredential(text: string): boolean {
  const at = text.lastIndexOf("@", text.search(/\s|$/));
  return (
    /^[^\s/@:]+:(?!\/\/)(?![\\/])[^\s@]*@[^\s/@]+/.test(text) &&
    !/^[a-z]:[\\/]/i.test(text) &&
    !PACKAGE_COORDINATE.test(text) &&
    !isHostPortPath(text.slice(0, at), text.slice(at + 1)) &&
    !/^(?:mailto|sips?|xmpp|im|acct):/i.test(text)
  );
}

// `Ri`: a secret-named key with a value.
const SECRET_ASSIGNMENT =
  // eslint-disable-next-line sonarjs/regex-complexity -- verbatim Claude Code 2.1.291 Ri
  /(?:(?:^|[;&?#,{]|\/:)\s*|\s)["']?(?!-*jobserver-auth\s*[=:])(?:[a-z0-9_.-]{0,64}(?:password|passwd|pwd|secret|token|(?:account|access|api|private|subscription)[-_]?key|signature|sig|credential)|[a-z0-9_.-]{0,63}[_.-]auth)["']?\s*[=:]\s*["']?(?!(?:true|false|none|null|yes|no|on|off|enabled|disabled|required|optional)(?:$|[;&,\s"']))[^;&,\s"']+/i;

// `yi`: a Slack, Discord or Teams webhook URL.
const WEBHOOK_URL =
  /https:\/\/(?:hooks\.slack\.com\/(?:services|workflows|triggers)\/|(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/|[\w.-]+\.webhook\.office\.com\/webhookb2\/)[\w/@.~-]{16,}/i;

// `kso`: a PEM private-key header.
const PRIVATE_KEY_HEADER = /-----BEGIN [A-Z ]*PRIVATE KEY(?: BLOCK)?-----/;

const SONAR_LOGIN = /["']?sonar\.login["']?\s*[:=]\s*["']?[^\s"',}]{8,}/;

const AUTHORIZATION_VALUE =
  // eslint-disable-next-line sonarjs/duplicates-in-character-class -- verbatim Claude Code 2.1.291 JA
  /\bauthorization\s*[:=]\s*["']?[a-z][a-z0-9_-]*\s+[A-Za-z0-9._~+/=-]{8,}/i;

const TOKEN_VALUE =
  // eslint-disable-next-line sonarjs/concise-regex -- verbatim Claude Code 2.1.291 JA
  /\b(?:[Tt]oken|TOKEN)\s+(?=[A-Za-z0-9_~+=-]*[0-9])(?=[A-Za-z0-9_~+=-]*[A-Z])(?=([A-Za-z0-9_~+=-]{20,}))\1(?![/.])/;

const BEARER_OR_BASIC_VALUE =
  // eslint-disable-next-line sonarjs/regex-complexity, sonarjs/concise-regex -- verbatim Claude Code 2.1.291 JA
  /\b(?:Bearer|Basic)\s+(?=[A-Za-z._~+/=-]*[0-9]|(?:[A-Za-z0-9._~+/=-]*?[a-z][A-Z](?![a-z])){2}|[A-Za-z0-9.-]*[_~+/=])[A-Za-z0-9._~+/=-]{8,}/;

// The token patterns at the end of `JA`, in Claude's order.
function tokenPatternMatches(text: string): boolean {
  return (
    SECRET_ASSIGNMENT.test(text) ||
    WEBHOOK_URL.test(text) ||
    SONAR_LOGIN.test(text) ||
    PRIVATE_KEY_HEADER.test(text) ||
    AUTHORIZATION_VALUE.test(text) ||
    TOKEN_VALUE.test(text) ||
    BEARER_OR_BASIC_VALUE.test(text)
  );
}

/**
 * AVAR-05: Claude's `JA`. Reports whether a value embeds a credential: URL
 * userinfo (`user:pass@` or a token-shaped user), a bare `user:pass@host`, a
 * secret-named assignment, a webhook URL, a `sonar.login`, a private-key
 * header, or an `Authorization`, `Token`, `Bearer` or `Basic` value. Only the
 * first 8192 characters are read.
 */
export function valueCarriesCredential(value: string): boolean {
  const text = value.slice(0, CREDENTIAL_SCAN_LIMIT);
  return (
    schemeAuthorityCarriesCredential(text) ||
    bareUserinfoCarriesCredential(text) ||
    tokenPatternMatches(text)
  );
}
