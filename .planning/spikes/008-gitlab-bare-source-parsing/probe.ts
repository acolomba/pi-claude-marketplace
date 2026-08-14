import { parsePluginSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";

const cases = [
  "gitlab.com/group/project",
  "gitlab.com/group/subgroup/project",
  "gitlab.com/group/subgroup/subsubgroup/project",
  "github.com/owner/repo",
  "https://gitlab.com/group/project",
  "https://gitlab.com/group/subgroup/project",
  "https://gitlab.com/group/subgroup/subsubgroup/project.git",
  "https://gitlab.com/group/subgroup/project#main",
  "owner/repo",
];

for (const c of cases) {
  console.log(JSON.stringify({ input: c, result: parsePluginSource(c) }));
}
