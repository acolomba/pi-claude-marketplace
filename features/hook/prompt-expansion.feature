Feature: Hook prompt expansion

  A UserPromptExpansion hook runs when a typed line names a prompt template or a skill, before the line
  expands. It reads the expansion type, the command's Claude Code name, its arguments, its source, and the
  prompt, and a hook that blocks stops the command before it expands. A scripted model stands in for a
  real one, and a script hook that records each run stands in for a plugin's hook.

  Scenario: An expansion hook with the matcher demo:deploy blocks the typed command
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the slash command "deploy" with this command file:
      """
      ---
      description: Deploys.
      ---

      Deploy body: $ARGUMENTS
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the slash command "other" with this command file:
      """
      ---
      description: Does another thing.
      ---

      Other body: $ARGUMENTS
      """
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name  | event               | matcher     | form   | exit code | stderr           |
      | guard | UserPromptExpansion | demo:deploy | script | 2         | no deploys today |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply |
      | Done. |
    When the user prompts "/demo:other one"
    Then the hooks record no runs
    Then the model receives these calls:
      | call | role | text            |
      | 1    | user | Other body: one |
    When the user prompts "/demo:deploy production"
    Then the hooks record these runs:
      | event               | session | expansion type | command name | command args | command source | prompt                  | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | UserPromptExpansion | first   | slash_command  | demo:deploy  | production   | plugin         | /demo:deploy production | {project dir} |                 | guard     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the hooks show the user these messages:
      | severity | text                                                                                                                                                 |
      | info     | UserPromptExpansion operation blocked by hook:\n[${CLAUDE_PLUGIN_ROOT}/hooks/guard.sh]: no deploys today\n\nOriginal prompt: /demo:deploy production |
    Then the prompt the hook blocked reaches the model in no call

  Scenario: An expansion hook that blocks with suppressOriginalPrompt leaves the typed command out of the notice
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

      Command body: [$ARGUMENTS]
      """
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name  | event               | matcher | form   | output                                                                                                                             |
      | quiet | UserPromptExpansion |         | script | {"decision":"block","reason":"not now","hookSpecificOutput":{"hookEventName":"UserPromptExpansion","suppressOriginalPrompt":true}} |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    When the user prompts "/demo:cmd first second"
    Then the hooks record these runs:
      | event               | session | expansion type | command name | command args | command source | prompt                 | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | UserPromptExpansion | first   | slash_command  | demo:cmd     | first second | plugin         | /demo:cmd first second | {project dir} |                 | quiet     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the hooks show the user these messages:
      | severity | text                                                    |
      | info     | UserPromptExpansion operation blocked by hook:\nnot now |
    Then the prompt the hook blocked reaches the model in no call

  Scenario Outline: An expansion hook records the typed plugin <typed kind>, and the model gets the expanded text
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

      Command body: [$ARGUMENTS]
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the skill "status" with this skill file:
      """
      ---
      description: Reports the status.
      ---

      Skill body: $ARGUMENTS
      """
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name          | event               | matcher |
      | expansion-log | UserPromptExpansion |         |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply |
      | Done. |
    When the user prompts "<typed text>"
    Then the hooks record these runs:
      | event               | session | expansion type | command name   | command args   | command source | prompt   | cwd           | transcript path | arguments     | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | UserPromptExpansion | first   | slash_command  | <command name> | <command args> | plugin         | <prompt> | {project dir} |                 | expansion-log | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the model receives these calls:
      | call | role | text         |
      | 1    | user | <model text> |

    Examples:
      | typed kind               | typed text                      | command name | command args | prompt                    | model text                                                                                                                                                                                                                                                  |
      | command                  | /demo:cmd first second          | demo:cmd     | first second | /demo:cmd first second    | Command body: [first second]                                                                                                                                                                                                                                |
      | command with no argument | /demo:cmd                       | demo:cmd     |              | /demo:cmd                 | Command body: []                                                                                                                                                                                                                                            |
      | skill                    | /skill:demo-status first second | demo:status  | first second | /demo:status first second | <skill name="demo-status" location="{project dir}/.pi/pi-claude-marketplace/resources/skills/demo-status/SKILL.md">\nReferences are relative to {project dir}/.pi/pi-claude-marketplace/resources/skills/demo-status.\n\nSkill body: first second\n</skill> |
      | skill alias              | /demo:status first second       | demo:status  | first second | /demo:status first second | <skill name="demo-status" location="{project dir}/.pi/pi-claude-marketplace/resources/skills/demo-status/SKILL.md">\nReferences are relative to {project dir}/.pi/pi-claude-marketplace/resources/skills/demo-status.\n\nSkill body: first second\n</skill> |

  Scenario: A typed plugin command runs the prompt hook before the expansion hook
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

      Command body: [$ARGUMENTS]
      """
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name          | event               | matcher |
      | prompt-log    | UserPromptSubmit    |         |
      | expansion-log | UserPromptExpansion |         |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply |
      | Done. |
    When the user prompts "/demo:cmd first second"
    Then the hooks record these runs:
      | event               | session | expansion type | command name | command args | command source | prompt                 | cwd           | transcript path | arguments     | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | UserPromptSubmit    | first   |                |              |              |                | /demo:cmd first second | {project dir} |                 | prompt-log    | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
      | UserPromptExpansion | first   | slash_command  | demo:cmd     | first second | plugin         | /demo:cmd first second | {project dir} |                 | expansion-log | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the model receives these calls:
      | call | role | text                         |
      | 1    | user | Command body: [first second] |

  Scenario: A prompt hook that blocks a typed plugin command runs no expansion hook
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

      Command body: [$ARGUMENTS]
      """
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name          | event               | matcher | form   | exit code | stderr           |
      | guard         | UserPromptSubmit    |         | script | 2         | no prompts today |
      | expansion-log | UserPromptExpansion |         |        |           |                  |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    When the user prompts "/demo:cmd first second"
    Then the hooks record these runs:
      | event            | session | prompt                 | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | UserPromptSubmit | first   | /demo:cmd first second | {project dir} |                 | guard     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the hooks show the user these messages:
      | severity | text                                                                                                  |
      | info     | UserPromptSubmit operation blocked by hook:\n[${CLAUDE_PLUGIN_ROOT}/hooks/guard.sh]: no prompts today |
    Then the prompt the hook blocked reaches the model in no call

  Scenario: An expansion hook that stops the command shows its stop reason
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

      Command body: [$ARGUMENTS]
      """
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name | event               | matcher | form   | output                                    |
      | halt | UserPromptExpansion |         | script | {"continue":false,"stopReason":"not now"} |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    When the user prompts "/demo:cmd first second"
    Then the hooks record these runs:
      | event               | session | expansion type | command name | command args | command source | prompt                 | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | UserPromptExpansion | first   | slash_command  | demo:cmd     | first second | plugin         | /demo:cmd first second | {project dir} |                 | halt      | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the hooks show the user these messages:
      | severity | text                               |
      | info     | Operation stopped by hook: not now |
    Then the prompt the hook blocked reaches the model in no call

  Scenario: An expansion hook's context reaches the model after the expanded command
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

      Command body: [$ARGUMENTS]
      """
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name | event               | matcher | form   | output                                                                                             |
      | ctx  | UserPromptExpansion |         | script | {"hookSpecificOutput":{"hookEventName":"UserPromptExpansion","additionalContext":"ctx-from-hook"}} |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply |
      | Done. |
    When the user prompts "/demo:cmd first second"
    Then the hooks record these runs:
      | event               | session | expansion type | command name | command args | command source | prompt                 | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | UserPromptExpansion | first   | slash_command  | demo:cmd     | first second | plugin         | /demo:cmd first second | {project dir} |                 | ctx       | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the model receives these calls:
      | call | role | text                                                       |
      | 1    | user | Command body: [first second]                               |
      | 1    | user | UserPromptExpansion hook additional context: ctx-from-hook |

  Scenario: An expansion hook with no matcher sees the user's own template
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the user's pi directory has the slash command "notes" with this command file:
      """
      Notes: $ARGUMENTS.
      """
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name          | event               | matcher |
      | expansion-log | UserPromptExpansion |         |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply |
      | Done. |
    When the user prompts "/notes today"
    Then the hooks record these runs:
      | event               | session | expansion type | command name | command args | command source | prompt       | cwd           | transcript path | arguments     | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | UserPromptExpansion | first   | slash_command  | notes        | today        | userSettings   | /notes today | {project dir} |                 | expansion-log | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the model receives these calls:
      | call | role | text          |
      | 1    | user | Notes: today. |
