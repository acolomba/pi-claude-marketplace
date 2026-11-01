Feature: Hook configuration

  Each hook option a plugin sets either works as in Claude Code or is
  reported, and none is dropped silently. The scenarios use a local
  marketplace, a scripted model, and hooks that record each run.

  Scenario Outline: Info on a plugin whose manifest declares hooks names it partially available with unsupported hooks
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".claude-plugin/plugin.json" with this text:
      """
      { "name": "demo", "version": "1.0.0", "hooks": <hooks field> }
      """
    Given the marketplace "fixtures" is added to the project scope
    When the user runs "/claude:plugin info demo@fixtures"
    Then the result has these fields:
      | kind                           | plugin-info         |
      | marketplace details autoupdate | false               |
      | marketplace name               | fixtures            |
      | marketplace scope              | project             |
      | needs reload                   | false               |
      | plugin components resolved     | true                |
      | plugin components skills       | demo-skill          |
      | plugin id                      | demo@fixtures       |
      | plugin name                    | demo                |
      | plugin reasons                 | unsupported hooks   |
      | plugin status                  | partially-available |
      | plugin version                 | 1.0.0               |
      | severity                       | info                |

    Examples:
      | hooks field                                                                                    |
      | "./extra/hooks.json"                                                                           |
      | ["./extra/hooks.json"]                                                                         |
      | { "PreToolUse": [{ "matcher": "Bash", "hooks": [{ "type": "command", "command": "echo x" }] }] } |

  Scenario: Info on a plugin whose marketplace entry declares hooks names it partially available with unsupported hooks
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" publishes this manifest:
      """
      {
        "name": "fixtures",
        "owner": { "name": "features" },
        "plugins": [
          {
            "name": "demo",
            "source": "./plugins/demo",
            "version": "1.0.0",
            "hooks": { "PreToolUse": [{ "matcher": "Bash", "hooks": [{ "type": "command", "command": "echo x" }] }] }
          }
        ]
      }
      """
    Given the marketplace "fixtures" is added to the project scope
    When the user runs "/claude:plugin info demo@fixtures"
    Then the result has these fields:
      | kind                           | plugin-info         |
      | marketplace details autoupdate | false               |
      | marketplace name               | fixtures            |
      | marketplace scope              | project             |
      | needs reload                   | false               |
      | plugin components resolved     | true                |
      | plugin components skills       | demo-skill          |
      | plugin id                      | demo@fixtures       |
      | plugin name                    | demo                |
      | plugin reasons                 | unsupported hooks   |
      | plugin status                  | partially-available |
      | plugin version                 | 1.0.0               |
      | severity                       | info                |

  Scenario: A manifest that names the convention hooks file keeps the plugin available
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name  | event      | matcher |
      | guard | PreToolUse | Bash    |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".claude-plugin/plugin.json" with this text:
      """
      { "name": "demo", "version": "1.0.0", "hooks": "./hooks/hooks.json" }
      """
    Given the marketplace "fixtures" is added to the project scope
    When the user runs "/claude:plugin info demo@fixtures"
    Then the result has these fields:
      | kind                           | plugin-info                                |
      | marketplace details autoupdate | false                                      |
      | marketplace name               | fixtures                                   |
      | marketplace scope              | project                                    |
      | needs reload                   | false                                      |
      | plugin components hooks        | [{"event":"PreToolUse","matcher":"Bash"}] |
      | plugin components resolved     | true                                       |
      | plugin components skills       | demo-skill                                 |
      | plugin id                      | demo@fixtures                              |
      | plugin name                    | demo                                       |
      | plugin reasons                 |                                            |
      | plugin status                  | available                                  |
      | plugin version                 | 1.0.0                                      |
      | severity                       | info                                       |

  Scenario: Installing a plugin whose manifest declares hooks needs --partial
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".claude-plugin/plugin.json" with this text:
      """
      { "name": "demo", "version": "1.0.0", "hooks": "./extra/hooks.json" }
      """
    Given the marketplace "fixtures" is added to the project scope
    When the user runs "/claude:plugin install demo@fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status              | reasons           | hint            |
      | fixtures         | project           | demo@fixtures | demo | partially-available | unsupported hooks | partial-install |

  Scenario: A hook with an if condition on a session event does not run
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name  | event        | matcher | if           |
      | gated | SessionStart | *       | Bash(echo *) |
      | open  | SessionStart | *       |              |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    When the user starts a new pi session with the hooks recording
    Then the hooks record these runs:
      | event        | session | source | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                | CLAUDE_ENV_FILE                                                           | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | SessionStart | first   | clear  | {project dir} |                 | open      | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/demo | {project dir}/.pi/pi-claude-marketplace/data/_shared/claude-env-first.env | first                  | first             | 1          |

  Scenario: An if condition selects the tool calls a hook runs on
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name      | event      | matcher | if           |
      | echo-only | PreToolUse | Bash    | Bash(echo *) |
      | rm-only   | PreToolUse | Bash    | Bash(rm *)   |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply | tool | arguments                      |
      |       | bash | {"command": "echo from-model"} |
      | Done. |      |                                |
    When the user prompts "run the echo"
    Then the hooks record these runs:
      | event      | session | tool name | tool input                    | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse | first   | Bash      | {"command":"echo from-model"} | {project dir} |                 | echo-only | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/demo | first                  | first             | 1          |

  Scenario: A hook marked once runs on every matching tool call
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name  | event      | matcher | once |
      | every | PreToolUse | Bash    | true |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply | tool | arguments               |
      |       | bash | {"command": "echo one"} |
      |       | bash | {"command": "echo two"} |
      | Done. |      |                         |
    When the user prompts "run two echoes"
    Then the hooks record these runs:
      | event      | session | tool name | tool input             | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse | first   | Bash      | {"command":"echo one"} | {project dir} |                 | every     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/demo | first                  | first             | 1          |
      | PreToolUse | first   | Bash      | {"command":"echo two"} | {project dir} |                 | every     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/demo | first                  | first             | 1          |

  Scenario Outline: Info on a plugin with a hook on an event pi does not support names the event unsupported
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name   | event        | matcher |
      | guard  | PreToolUse   | Bash    |
      | notice | <hook event> |         |
    Given the marketplace "fixtures" is added to the project scope
    When the user runs "/claude:plugin info demo@fixtures"
    Then the result has these fields:
      | kind                           | plugin-info                                                                                           |
      | marketplace details autoupdate | false                                                                                                 |
      | marketplace name               | fixtures                                                                                              |
      | marketplace scope              | project                                                                                               |
      | needs reload                   | false                                                                                                 |
      | plugin components hooks        | [{"event":"PreToolUse","matcher":"Bash"},{"kind":"lenient","event":"<hook event>","supported":false}] |
      | plugin components resolved     | true                                                                                                  |
      | plugin components skills       | demo-skill                                                                                            |
      | plugin id                      | demo@fixtures                                                                                         |
      | plugin name                    | demo                                                                                                  |
      | plugin reasons                 | unsupported hooks                                                                                     |
      | plugin status                  | partially-available                                                                                   |
      | plugin version                 | 1.0.0                                                                                                 |
      | severity                       | info                                                                                                  |

    Examples:
      | hook event     |
      | Notification   |
      | DirectoryAdded |
      | PreModelSwitch |

  Scenario: A plugin with an unsupported hook event still runs its supported hooks after a partial install
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name   | event        | matcher |
      | guard  | PreToolUse   | Bash    |
      | notice | Notification |         |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project --partial"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply | tool | arguments                      |
      |       | bash | {"command": "echo from-model"} |
      | Done. |      |                                |
    When the user prompts "run the echo"
    Then the hooks record these runs:
      | event      | session | tool name | tool input                    | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse | first   | Bash      | {"command":"echo from-model"} | {project dir} |                 | guard     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/demo | first                  | first             | 1          |
