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
