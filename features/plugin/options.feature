Feature: Plugin options

  A plugin's userConfig options take their declared default. A plugin whose options all have
  one installs without --partial, and one with a required option that has no default stays
  partially available (PG-CORE-03). Options that an install record holds in a form that does not
  parse are reported as unreadable until a reinstall (D-PG10-25). A local marketplace stands in
  for a published one.

  Background:
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |

  Scenario: A plugin whose options all have a default installs without --partial (PG-CORE-03)
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".claude-plugin/plugin.json" with this text:
      """
      {
        "name": "demo",
        "version": "1.0.0",
        "userConfig": {
          "mode": { "type": "string", "title": "Mode", "description": "The mode.", "default": "fast" }
        }
      }
      """
    Given the marketplace "fixtures" is added to the project scope
    When the user runs "/claude:plugin install demo@fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | installed |         | project | 1.0.0   |
    Then the installation record of the project scope holds these plugins:
      | id            | version | enabled |
      | demo@fixtures | 1.0.0   | true    |

  Scenario: A plugin whose option has no title is unavailable (PG-CORE-03, D-PG10-20)
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".claude-plugin/plugin.json" with this text:
      """
      { "name": "demo", "version": "1.0.0", "userConfig": { "mode": { "type": "string", "default": "fast" } } }
      """
    Given the marketplace "fixtures" is added to the project scope
    When the user runs "/claude:plugin install demo@fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status      | reasons          |
      | fixtures         | project           | demo@fixtures | demo | unavailable | invalid manifest |
    Then the project scope has no installed plugins

  Scenario: Installing a plugin with a malformed option with --partial is refused too (D-PG10-05)
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".claude-plugin/plugin.json" with this text:
      """
      { "name": "demo", "version": "1.0.0", "userConfig": { "mode": { "type": "string", "default": "fast" } } }
      """
    Given the marketplace "fixtures" is added to the project scope
    When the user runs "/claude:plugin install demo@fixtures --scope project --partial"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status      | reasons          |
      | fixtures         | project           | demo@fixtures | demo | unavailable | invalid manifest |
    Then the project scope has no installed plugins

  Scenario: A plugin with a required option that has no default is refused without --partial (PG-CORE-03)
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".claude-plugin/plugin.json" with this text:
      """
      {
        "name": "demo",
        "version": "1.0.0",
        "userConfig": {
          "token": { "type": "string", "title": "Token", "description": "The token.", "required": true },
          "mode": { "type": "string", "title": "Mode", "description": "The mode.", "default": "fast" }
        }
      }
      """
    Given the marketplace "fixtures" is added to the project scope
    When the user runs "/claude:plugin install demo@fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status              | reasons         | hint            |
      | fixtures         | project           | demo@fixtures | demo | partially-available | options not set | partial-install |
    Then the project scope has no installed plugins

  Scenario: A plugin with an unset required option installs with --partial as partially installed (D-PG10-06)
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".claude-plugin/plugin.json" with this text:
      """
      {
        "name": "demo",
        "version": "1.0.0",
        "userConfig": {
          "token": { "type": "string", "title": "Token", "description": "The token.", "required": true },
          "mode": { "type": "string", "title": "Mode", "description": "The mode.", "default": "fast" }
        }
      }
      """
    Given the marketplace "fixtures" is added to the project scope
    When the user runs "/claude:plugin install demo@fixtures --scope project --partial"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status              | reasons         | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | partially-installed | options not set | project | 1.0.0   |
    Then the installation record of the project scope holds these plugins:
      | id            | version | enabled |
      | demo@fixtures | 1.0.0   | true    |

  Scenario: Info names the required options of a plugin that are not set (D-PG10-06)
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".claude-plugin/plugin.json" with this text:
      """
      {
        "name": "demo",
        "version": "1.0.0",
        "userConfig": {
          "token": { "type": "string", "title": "Token", "description": "The token.", "required": true },
          "mode": { "type": "string", "title": "Mode", "description": "The mode.", "default": "fast" }
        }
      }
      """
    Given the marketplace "fixtures" is added to the project scope
    When the user runs "/claude:plugin info demo@fixtures"
    Then the result has these fields:
      | kind                           | plugin-info                                              |
      | marketplace details autoupdate | false                                                    |
      | marketplace name               | fixtures                                                 |
      | marketplace scope              | project                                                  |
      | needs reload                   | false                                                    |
      | plugin components resolved     | true                                                     |
      | plugin components skills       | demo-skill                                               |
      | plugin id                      | demo@fixtures                                            |
      | plugin name                    | demo                                                     |
      | plugin notes                   | required option "token" has no default, so it is not set |
      | plugin reasons                 | options not set                                          |
      | plugin status                  | partially-available                                      |
      | plugin version                 | 1.0.0                                                    |
      | severity                       | info                                                     |

  Scenario: The bash tool's environment holds the option variable of a trusted project's plugin (D-PG10-11)
    Given pi runs with the scripted model
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".claude-plugin/plugin.json" with this text:
      """
      {
        "name": "demo",
        "version": "1.0.0",
        "userConfig": {
          "mode": { "type": "string", "title": "Mode", "description": "The mode.", "default": "fast" }
        }
      }
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply | tool | arguments                                                                    |
      |       | bash | {"command": "printf %s \"$PI_CLAUDE_MARKETPLACE_OPTIONS\""}                  |
      |       | bash | {"command": "printf %s \"$PI_CLAUDE_MARKETPLACE_OPTION_34f6bcb3de70f47b\""} |
      | Done. |      |                                                                              |
    When the user prompts "show the plugin options"
    Then the model receives these calls:
      | call | role        | text                                                                                 |
      | 1    | user        | show the plugin options                                                              |
      | 2    | user        | show the plugin options                                                              |
      | 2    | assistant   | tool call bash {"command":"printf %s \"$PI_CLAUDE_MARKETPLACE_OPTIONS\""}            |
      | 2    | tool result | bash returned: project:PI_CLAUDE_MARKETPLACE_OPTION_34f6bcb3de70f47b                 |
      | 3    | user        | show the plugin options                                                              |
      | 3    | assistant   | tool call bash {"command":"printf %s \"$PI_CLAUDE_MARKETPLACE_OPTIONS\""}            |
      | 3    | tool result | bash returned: project:PI_CLAUDE_MARKETPLACE_OPTION_34f6bcb3de70f47b                 |
      | 3    | assistant   | tool call bash {"command":"printf %s \"$PI_CLAUDE_MARKETPLACE_OPTION_34f6bcb3de70f47b\""} |
      | 3    | tool result | bash returned: fast                                                                  |

  Scenario: In a project the user marked do not trust, only the user-scope plugin's option variable is set (D-PG10-23)
    Given pi runs with the scripted model in a project the user marked "do not trust"
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".claude-plugin/plugin.json" with this text:
      """
      {
        "name": "demo",
        "version": "1.0.0",
        "userConfig": {
          "mode": { "type": "string", "title": "Mode", "description": "The mode.", "default": "fast" }
        }
      }
      """
    Given the marketplace "mine" is published as a dir source
    Given the marketplace "mine" offers these plugins:
      | name     | version |
      | personal | 1.0.0   |
    Given the published plugin "personal" of the marketplace "mine" has the file ".claude-plugin/plugin.json" with this text:
      """
      {
        "name": "personal",
        "version": "1.0.0",
        "userConfig": {
          "mode": { "type": "string", "title": "Mode", "description": "The mode.", "default": "fast" }
        }
      }
      """
    Given the marketplace "mine" is added to the user scope
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install personal@mine --scope user"
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply | tool | arguments                                                   |
      |       | bash | {"command": "printf %s \"$PI_CLAUDE_MARKETPLACE_OPTIONS\""} |
      | Done. |      |                                                             |
    When the user prompts "show the plugin options"
    Then the model receives these calls:
      | call | role        | text                                                                      |
      | 1    | user        | show the plugin options                                                   |
      | 2    | user        | show the plugin options                                                   |
      | 2    | assistant   | tool call bash {"command":"printf %s \"$PI_CLAUDE_MARKETPLACE_OPTIONS\""} |
      | 2    | tool result | bash returned: user:PI_CLAUDE_MARKETPLACE_OPTION_17d4e1bcc7bbb7b4         |

  Scenario: An uninstalled plugin's option variable is gone after the command (D-PG10-11)
    Given pi runs with the scripted model
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".claude-plugin/plugin.json" with this text:
      """
      {
        "name": "demo",
        "version": "1.0.0",
        "userConfig": {
          "mode": { "type": "string", "title": "Mode", "description": "The mode.", "default": "fast" }
        }
      }
      """
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user has reloaded pi
    Given the user has run "/claude:plugin uninstall demo@fixtures --scope user"
    Given the scripted model plays these steps:
      | reply | tool | arguments                                                   |
      |       | bash | {"command": "printf %s \"$PI_CLAUDE_MARKETPLACE_OPTIONS\""} |
      | Done. |      |                                                             |
    When the user prompts "show the plugin options"
    Then the model receives these calls:
      | call | role        | text                                                                      |
      | 1    | user        | show the plugin options                                                   |
      | 2    | user        | show the plugin options                                                   |
      | 2    | assistant   | tool call bash {"command":"printf %s \"$PI_CLAUDE_MARKETPLACE_OPTIONS\""} |
      | 2    | tool result | bash returned: (no output)                                                |

  Scenario: Every reload warns about a plugin whose recorded options do not parse (D-PG10-25)
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".claude-plugin/plugin.json" with this text:
      """
      {
        "name": "demo",
        "version": "1.0.0",
        "userConfig": {
          "mode": { "type": "string", "title": "Mode", "description": "The mode.", "default": "fast" }
        }
      }
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the installation record of the plugin "demo@fixtures" in the project scope holds plugin options that do not parse
    When the user reloads pi
    Then the session reports these results:
      | kind                      | severity | needs reload | summary                             | tally label | tally failures | tally warnings |
      | reconcile-applied-cascade | warning  | false        | A plugin operation needs attention. | Reconcile   | 0              | 1              |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status | reasons    | scope   | cause chain                                                                                                                                                       | cause truncated | leaks | rollback partial |
      | fixtures         | project           | demo@fixtures | demo | failed | unreadable | project | The plugin options in the install record of demo@fixtures do not parse (userConfig is not an object). Run /claude:plugin reinstall demo@fixtures to restore them. | false           |       |                  |

  Scenario: The plugin list shows a plugin whose recorded options do not parse as unreadable (D-PG10-25)
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".claude-plugin/plugin.json" with this text:
      """
      {
        "name": "demo",
        "version": "1.0.0",
        "userConfig": {
          "mode": { "type": "string", "title": "Mode", "description": "The mode.", "default": "fast" }
        }
      }
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the installation record of the plugin "demo@fixtures" in the project scope holds plugin options that do not parse
    When the user runs "/claude:plugin list --scope project"
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons    | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | installed | unreadable | project | 1.0.0   |

  Scenario: Info shows a plugin whose recorded options do not parse as unreadable (D-PG10-25)
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".claude-plugin/plugin.json" with this text:
      """
      {
        "name": "demo",
        "version": "1.0.0",
        "userConfig": {
          "mode": { "type": "string", "title": "Mode", "description": "The mode.", "default": "fast" }
        }
      }
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the installation record of the plugin "demo@fixtures" in the project scope holds plugin options that do not parse
    When the user runs "/claude:plugin info demo@fixtures"
    Then the result has these fields:
      | kind                           | plugin-info   |
      | marketplace details autoupdate | false         |
      | marketplace name               | fixtures      |
      | marketplace scope              | project       |
      | needs reload                   | false         |
      | plugin components resolved     | true          |
      | plugin components skills       | demo-skill    |
      | plugin id                      | demo@fixtures |
      | plugin name                    | demo          |
      | plugin reasons                 | unreadable    |
      | plugin status                  | installed     |
      | plugin version                 | 1.0.0         |
      | severity                       | info          |
      | plugin scope                   | project       |

  Scenario: A reinstall restores the recorded options of a plugin whose recorded options do not parse (D-PG10-25)
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".claude-plugin/plugin.json" with this text:
      """
      {
        "name": "demo",
        "version": "1.0.0",
        "userConfig": {
          "mode": { "type": "string", "title": "Mode", "description": "The mode.", "default": "fast" }
        }
      }
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the installation record of the plugin "demo@fixtures" in the project scope holds plugin options that do not parse
    Given the user has run "/claude:plugin reinstall demo@fixtures --scope project"
    When the user reloads pi
    Then the session reports no results
