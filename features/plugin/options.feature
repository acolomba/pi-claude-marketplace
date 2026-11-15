Feature: Plugin options

  A plugin's userConfig options take their declared default. A plugin whose options all have
  one installs without --partial, and one with a required option that has no default stays
  partially available (PG-CORE-03). A local marketplace stands in for a published one.

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
