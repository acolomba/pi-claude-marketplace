Feature: Hook prompt and stop

  What a plugin's Stop hooks send back to the model when they block or add
  context, and what they show the user, is what Claude Code sends and shows.
  A scripted model stands in for a real one, and a script hook that records
  each run stands in for a plugin's hook.

  Scenario: Every blocking stop hook's reason reaches the model in one feedback message
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name   | event | matcher | form   | on reentry | output                                   |
      | stop-a | Stop  |         | script | allow      | {"decision":"block","reason":"reason A"} |
      | stop-b | Stop  |         | script | allow      | {"decision":"block","reason":"reason B"} |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply  |
      | Done.  |
      | Fixed. |
    When the user prompts "finish up" and the stop hooks send the turn back
    Then the hooks record these runs in any order:
      | event | session | last assistant message | stop hook active | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | Stop  | first   | Done.                  | false            | {project dir} |                 | stop-a    | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/demo | first                  | first             | 1          |
      | Stop  | first   | Done.                  | false            | {project dir} |                 | stop-b    | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/demo | first                  | first             | 1          |
      | Stop  | first   | Fixed.                 | true             | {project dir} |                 | stop-a    | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/demo | first                  | first             | 1          |
      | Stop  | first   | Fixed.                 | true             | {project dir} |                 | stop-b    | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/demo | first                  | first             | 1          |
    Then the model receives these calls:
      | call | role      | text                                                         |
      | 1    | user      | finish up                                                    |
      | 2    | user      | finish up                                                    |
      | 2    | assistant | Done.                                                        |
      | 2    | user      | Stop hook feedback:\nreason A\nStop hook feedback:\nreason B |

  Scenario: A stop hook's additional context is sent back as stop hook feedback
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name   | event | matcher | form   | on reentry | output                                                                              |
      | advise | Stop  |         | script | allow      | {"hookSpecificOutput":{"hookEventName":"Stop","additionalContext":"run the tests"}} |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply   |
      | Done.   |
      | Tested. |
    When the user prompts "finish up" and the stop hooks send the turn back
    Then the hooks record these runs:
      | event | session | last assistant message | stop hook active | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | Stop  | first   | Done.                  | false            | {project dir} |                 | advise    | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/demo | first                  | first             | 1          |
      | Stop  | first   | Tested.                | true             | {project dir} |                 | advise    | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/demo | first                  | first             | 1          |
    Then the model receives these calls:
      | call | role      | text                               |
      | 1    | user      | finish up                          |
      | 2    | user      | finish up                          |
      | 2    | assistant | Done.                              |
      | 2    | user      | Stop hook feedback:\nrun the tests |

  Scenario: A stop hook's system message is shown to the user
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name   | event | matcher | form   | output                                 |
      | notice | Stop  |         | script | {"systemMessage":"remember the tests"} |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply |
      | Done. |
    When the user prompts "finish up"
    Then the hooks record these runs:
      | event | session | last assistant message | stop hook active | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | Stop  | first   | Done.                  | false            | {project dir} |                 | notice    | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/demo | first                  | first             | 1          |
    Then the hooks show the user these messages:
      | severity | text                          |
      | info     | Stop says: remember the tests |
    Then the model receives these calls:
      | call | role | text      |
      | 1    | user | finish up |
