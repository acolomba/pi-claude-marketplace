Feature: Hook prompt commands

  A UserPromptSubmit hook sees the slash command or skill the user typed, as Claude Code passes the typed
  text, and a hook that blocks the prompt stops the command before it expands. A scripted model stands in
  for a real one, and a script hook that records each run stands in for a plugin's hook.

  Scenario Outline: A prompt hook sees the typed text of a plugin <typed kind>, and the model gets the expanded text
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the slash command "cmd" with this command file:
      """
      ---
      description: Runs the command.
      ---

      Command body: $ARGUMENTS
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the skill "status" with this skill file:
      """
      ---
      description: Reports the status.
      ---

      Skill body: $ARGUMENTS
      """
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name       | event            | matcher |
      | prompt-log | UserPromptSubmit |         |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply |
      | Done. |
    When the user prompts "<typed text>"
    Then the hooks record these runs:
      | event            | session | prompt       | cwd           | transcript path | arguments  | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | UserPromptSubmit | first   | <typed text> | {project dir} |                 | prompt-log | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the model receives these calls:
      | call | role | text         |
      | 1    | user | <model text> |

    Examples:
      | typed kind  | typed text                      | model text                                                                                                                                                                                                                                                  |
      | command     | /demo:cmd first second          | Command body: first second                                                                                                                                                                                                                                  |
      | skill       | /skill:demo-status first second | <skill name="demo-status" location="{project dir}/.pi/pi-claude-marketplace/resources/skills/demo-status/SKILL.md">\nReferences are relative to {project dir}/.pi/pi-claude-marketplace/resources/skills/demo-status.\n\nSkill body: first second\n</skill> |
      | skill alias | /demo:status first second       | <skill name="demo-status" location="{project dir}/.pi/pi-claude-marketplace/resources/skills/demo-status/SKILL.md">\nReferences are relative to {project dir}/.pi/pi-claude-marketplace/resources/skills/demo-status.\n\nSkill body: first second\n</skill> |

  Scenario Outline: A prompt hook that blocks a typed plugin <typed kind> stops it before it expands or reaches the model
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the slash command "cmd" with this command file:
      """
      ---
      description: Runs the command.
      ---

      Command body: $ARGUMENTS
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the skill "status" with this skill file:
      """
      ---
      description: Reports the status.
      ---

      Skill body: $ARGUMENTS
      """
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name  | event            | matcher | form   | exit code | stderr           |
      | guard | UserPromptSubmit |         | script | 2         | no prompts today |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    When the user prompts "<typed text>"
    Then the hooks record these runs:
      | event            | session | prompt       | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | UserPromptSubmit | first   | <typed text> | {project dir} |                 | guard     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the hooks show the user these messages:
      | severity | text                                                                                                  |
      | info     | UserPromptSubmit operation blocked by hook:\n[${CLAUDE_PLUGIN_ROOT}/hooks/guard.sh]: no prompts today |
    Then the prompt the hook blocked reaches the model in no call

    Examples:
      | typed kind  | typed text                      |
      | command     | /demo:cmd first second          |
      | skill       | /skill:demo-status first second |
      | skill alias | /demo:status first second       |
