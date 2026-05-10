// domain/index.ts -- public API surface for the domain/ tier (Phase 2+)
export type { ParsedSource, PathSource, GitHubSource, UnknownSource } from "./source.ts";
export { parsePluginSource, pathSource, githubSource } from "./source.ts";
