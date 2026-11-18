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
    When the user prompts "finish up" and the stop hooks continue the run
    Then the hooks record these runs in any order:
      | event | session | last assistant message | stop hook active | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | Stop  | first   | Done.                  | false            | {project dir} |                 | stop-a    | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
      | Stop  | first   | Done.                  | false            | {project dir} |                 | stop-b    | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
      | Stop  | first   | Fixed.                 | true             | {project dir} |                 | stop-a    | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
      | Stop  | first   | Fixed.                 | true             | {project dir} |                 | stop-b    | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the model receives these calls:
      | call | role      | text                                                         |
      | 1    | user      | finish up                                                    |
      | 2    | user      | finish up                                                    |
      | 2    | assistant | Done.                                                        |
      | 2    | user      | Stop hook feedback:\nreason A\nStop hook feedback:\nreason B |

  Scenario: A run that a stop hook blocks twice settles once after one run start
    Given pi runs with the scripted model and counts its run starts
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name   | event | matcher | form   | output                                     |
      | always | Stop  |         | script | {"decision":"block","reason":"keep going"} |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply  | stop reason |
      | Done 1 |             |
      | Done 2 |             |
      | End    | length      |
    When the user prompts "finish up" and the stop hooks continue the run
    Then the hooks record these runs:
      | event | session | last assistant message | stop hook active | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | Stop  | first   | Done 1                 | false            | {project dir} |                 | always    | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
      | Stop  | first   | Done 2                 | true             | {project dir} |                 | always    | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the model receives these calls:
      | call | role      | text                            |
      | 1    | user      | finish up                       |
      | 2    | user      | finish up                       |
      | 2    | assistant | Done 1                          |
      | 2    | user      | Stop hook feedback:\nkeep going |
      | 3    | user      | finish up                       |
      | 3    | assistant | Done 1                          |
      | 3    | user      | Stop hook feedback:\nkeep going |
      | 3    | assistant | Done 2                          |
      | 3    | user      | Stop hook feedback:\nkeep going |
    Then the stop sequence has these counts:
      | run starts | model calls |
      | 1          | 3           |

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
    When the user prompts "finish up" and the stop hooks continue the run
    Then the hooks record these runs:
      | event | session | last assistant message | stop hook active | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | Stop  | first   | Done.                  | false            | {project dir} |                 | advise    | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
      | Stop  | first   | Tested.                | true             | {project dir} |                 | advise    | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
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
      | event | session | last assistant message | stop hook active | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | Stop  | first   | Done.                  | false            | {project dir} |                 | notice    | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the hooks show the user these messages:
      | severity | text                          |
      | info     | Stop says: remember the tests |
    Then the model receives these calls:
      | call | role | text      |
      | 1    | user | finish up |

  Scenario: Eight consecutive Stop blocks continue before the ninth is overridden
    Given pi runs with the scripted model and counts its run starts
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name   | event | matcher | form   | output                                     |
      | always | Stop  |         | script | {"decision":"block","reason":"keep going"} |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply  |
      | Done 1 |
      | Done 2 |
      | Done 3 |
      | Done 4 |
      | Done 5 |
      | Done 6 |
      | Done 7 |
      | Done 8 |
      | Done 9 |
    When the user prompts "finish up" and the stop hooks continue the run
    Then the stop sequence has these exact replies and hook states:
      | reply  | stop hook active |
      | Done 1 | false            |
      | Done 2 | true             |
      | Done 3 | true             |
      | Done 4 | true             |
      | Done 5 | true             |
      | Done 6 | true             |
      | Done 7 | true             |
      | Done 8 | true             |
      | Done 9 | true             |
    Then the stop override cap notice count is 1
    Then the stop sequence has these counts:
      | run starts | model calls |
      | 1          | 9           |

  Scenario: Tool calls reset a Stop-only plugin's continuation count
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name   | event | matcher | form   | output                                     |
      | always | Stop  |         | script | {"decision":"block","reason":"keep going"} |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply   | tool | arguments                   | stop reason |
      | Done 1  |      |                             |             |
      |         | bash | {"command":"echo from-model"} |             |
      | Done 2  |      |                             |             |
      |         | bash | {"command":"echo from-model"} |             |
      | Done 3  |      |                             |             |
      |         | bash | {"command":"echo from-model"} |             |
      | Done 4  |      |                             |             |
      |         | bash | {"command":"echo from-model"} |             |
      | Done 5  |      |                             |             |
      |         | bash | {"command":"echo from-model"} |             |
      | Done 6  |      |                             |             |
      |         | bash | {"command":"echo from-model"} |             |
      | Done 7  |      |                             |             |
      |         | bash | {"command":"echo from-model"} |             |
      | Done 8  |      |                             |             |
      |         | bash | {"command":"echo from-model"} |             |
      | Done 9  |      |                             |             |
      |         | bash | {"command":"echo from-model"} |             |
      | Done 10 |      |                             |             |
      |         | bash | {"command":"echo from-model"} |             |
      | End     |      |                             | length      |
    When the user prompts "finish up" and the stop hooks continue the run
    Then ten stop blocks separated by tool calls continue
    Then the stop override cap notice count is 0

  Scenario: Reload starts a fresh Stop continuation count
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name   | event | matcher | form   | output                                     |
      | always | Stop  |         | script | {"decision":"block","reason":"keep going"} |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply    | stop reason |
      | Before 1 |             |
      | Before 2 |             |
      | Before 3 |             |
      | Pause    | length      |
      | After 1  |             |
      | After 2  |             |
      | After 3  |             |
      | After 4  |             |
      | After 5  |             |
      | After 6  |             |
      | After 7  |             |
      | After 8  |             |
      | After 9  |             |
    When the user prompts "before reload" until "Pause", reloads pi, and prompts "after reload" through the stop limit
    Then the reloaded stop sequence has these exact replies and hook states:
      | run    | reply    | stop hook active |
      | before | Before 1 | false            |
      | before | Before 2 | true             |
      | before | Before 3 | true             |
      | after  | After 1  | false            |
      | after  | After 2  | true             |
      | after  | After 3  | true             |
      | after  | After 4  | true             |
      | after  | After 5  | true             |
      | after  | After 6  | true             |
      | after  | After 7  | true             |
      | after  | After 8  | true             |
      | after  | After 9  | true             |

  Scenario: A Stop hook receives the effort level of the session
    Given pi runs with a scripted model that reasons
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name | event | matcher |
      | stop | Stop  |         |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the user has set the thinking level "high"
    Given the scripted model plays these steps:
      | reply |
      | Done. |
    When the user prompts "finish up"
    Then the hooks record these runs:
      | event | session | last assistant message | stop hook active | cwd           | transcript path | effort           | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | Stop  | first   | Done.                  | false            | {project dir} |                 | {"level":"high"} | stop      | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
