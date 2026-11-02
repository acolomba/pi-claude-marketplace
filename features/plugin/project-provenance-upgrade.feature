Feature: Plugin project provenance upgrade

  A project-scope install made before pi kept its record of project installs leaves skills and
  commands refused and hooks off, and one reinstall of the plugin makes all three work again. A
  local marketplace, a scripted model, and a hook that records each run stand in for published ones.

  Scenario: A project install that the user's pi directory does not record works again after one reinstall
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the skill "status" with this skill file:
      """
      ---
      description: Reports the status.
      ---

      Status: !`printf skill-ran`
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the slash command "check" with this command file:
      """
      ---
      description: Checks the status.
      ---

      Check: !`printf command-ran`
      """
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name       | event      | matcher |
      | bash-guard | PreToolUse | Bash    |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user's pi directory records no plugin install for the project
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply  | tool | arguments                      |
      |        | bash | {"command": "echo from-model"} |
      | Done.  |      |                                |
      | Noted. |      |                                |
      |        | bash | {"command": "echo from-model"} |
      | Done.  |      |                                |
    When the user runs "/skill:demo-status"
    Then the result has these fields:
      | kind         | usage-error                                                                                                                                                                                                                                                           |
      | severity     | error                                                                                                                                                                                                                                                                 |
      | needs reload | false                                                                                                                                                                                                                                                                 |
      | message      | The skill /skill:demo-status was not installed into the project {project dir} on this machine, or its file changed after the install. Reinstall its plugin into this project with /claude:plugin reinstall demo@fixtures --scope project, then run /reload to use it. |
      | usage        |                                                                                                                                                                                                                                                                       |
    When the user runs "/demo:check"
    Then the result has these fields:
      | kind         | usage-error                                                                                                                                                                                                                                                         |
      | severity     | error                                                                                                                                                                                                                                                               |
      | needs reload | false                                                                                                                                                                                                                                                               |
      | message      | The command /demo:check was not installed into the project {project dir} on this machine, or its file changed after the install. Reinstall its plugin into this project with /claude:plugin reinstall demo@fixtures --scope project, then run /reload to use it. |
      | usage        |                                                                                                                                                                                                                                                                     |
    When the user prompts "run the echo"
    Then the hooks record no runs
    Then the model receives these calls:
      | call | role        | text                                         |
      | 1    | user        | run the echo                                 |
      | 2    | user        | run the echo                                 |
      | 2    | assistant   | tool call bash {"command":"echo from-model"} |
      | 2    | tool result | bash returned: from-model\n                  |
    When the user runs "/claude:plugin reinstall demo@fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status      | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | reinstalled |         | project | 1.0.0   |
    When the user starts a new pi session
    Then the session reports no results
    When the user prompts "/skill:demo-status"
    Then the model receives these calls:
      | call | role | text                                                                                                                                                                                                                                                |
      | 3    | user | <skill name="demo-status" location="{project dir}/.pi/pi-claude-marketplace/resources/skills/demo-status/SKILL.md">\nReferences are relative to {project dir}/.pi/pi-claude-marketplace/resources/skills/demo-status.\n\nStatus: skill-ran\n</skill> |
    When the user prompts "/demo:check"
    Then the hooks record these runs:
      | event      | session | tool name | tool input                    | cwd           | transcript path | arguments  | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse | first   | Bash      | {"command":"echo from-model"} | {project dir} |                 | bash-guard | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/demo | first                  | first             | 1          |
    Then the model receives these calls:
      | call | role        | text                                                                                                                                                                                                                                                 |
      | 4    | user        | <skill name="demo-status" location="{project dir}/.pi/pi-claude-marketplace/resources/skills/demo-status/SKILL.md">\nReferences are relative to {project dir}/.pi/pi-claude-marketplace/resources/skills/demo-status.\n\nStatus: skill-ran\n</skill> |
      | 4    | assistant   | Noted.                                                                                                                                                                                                                                               |
      | 4    | user        | Check: command-ran                                                                                                                                                                                                                                   |
      | 5    | user        | <skill name="demo-status" location="{project dir}/.pi/pi-claude-marketplace/resources/skills/demo-status/SKILL.md">\nReferences are relative to {project dir}/.pi/pi-claude-marketplace/resources/skills/demo-status.\n\nStatus: skill-ran\n</skill> |
      | 5    | assistant   | Noted.                                                                                                                                                                                                                                               |
      | 5    | user        | Check: command-ran                                                                                                                                                                                                                                   |
      | 5    | assistant   | tool call bash {"command":"echo from-model"}                                                                                                                                                                                                         |
      | 5    | tool result | bash returned: from-model\n                                                                                                                                                                                                                          |
