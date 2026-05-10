import { assertSafeName } from "../validation.ts";

/** Generated skill name used both at staging time (resource pipeline) and
 *  when resolving `skills:` references in agent frontmatter. Format:
 *  `<plugin>-<skill>`, with the prefix elided if the source already starts
 *  with it. */
export function generateSkillName(pluginName: string, skillName: string): string {
  assertSafeName(pluginName, "plugin name");
  assertSafeName(skillName, "skill name");
  if (skillName.startsWith(pluginName + "-")) {
    return skillName;
  }

  return pluginName + "-" + skillName;
}

/** Replace `${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_PLUGIN_DATA}` in plugin
 *  content (skill bodies, command bodies, agent bodies). */
export function substitutePluginVars(
  content: string,
  pluginRoot: string,
  pluginDataDir: string,
): string {
  return content
    .replaceAll("${CLAUDE_PLUGIN_ROOT}", pluginRoot)
    .replaceAll("${CLAUDE_PLUGIN_DATA}", pluginDataDir);
}
