Feature: Plugin import

  Import brings the extra known marketplaces and the enabled plugins of a
  Claude Code settings file into a scope. The settings file lives in the
  sandbox, and a local marketplace stands in for a published one.

  Background:
    Given the marketplace "fixtures" is published as a dir source

  Scenario: Importing the user's claude code settings adds their marketplace and installs their enabled plugin
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the claude code settings file of the user scope holds this text:
      """
      {
        "enabledPlugins": { "demo@fixtures": true },
        "extraKnownMarketplaces": {
          "fixtures": {
            "source": { "source": "directory", "path": "{home}/marketplaces/fixtures" }
          }
        }
      }
      """
    When the user runs "/claude:plugin import --scope user"
    Then the result has these fields:
      | kind                | cascade |
      | severity            | info    |
      | needs reload        | true    |
      | tally label         | Import  |
      | tally failures      | 0       |
      | tally warnings      | 0       |
      | tally success count | 2       |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace status | id            | name | version | status    | reasons | scope |
      | fixtures         | user              | added              | demo@fixtures | demo | 1.0.0   | installed |         | user  |
    Then the "claude-plugins.json" file of the user scope declares these marketplaces:
      | name     | source                       |
      | fixtures | {home}/marketplaces/fixtures |
    Then the "claude-plugins.json" file of the user scope declares these plugins:
      | id            |
      | demo@fixtures |
    When the user starts a new pi session
    Then the session offers these skills:
      | command           | description            |
      | /skill:demo-skill | A skill of demo 1.0.0. |

  Scenario: Importing the project's claude code settings adds their marketplace and installs their enabled plugin in the project scope
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the claude code settings file of the project scope holds this text:
      """
      {
        "enabledPlugins": { "demo@fixtures": true },
        "extraKnownMarketplaces": {
          "fixtures": {
            "source": { "source": "directory", "path": "{home}/marketplaces/fixtures" }
          }
        }
      }
      """
    When the user runs "/claude:plugin import --scope project"
    Then the result has these fields:
      | kind                | cascade |
      | severity            | info    |
      | needs reload        | true    |
      | tally label         | Import  |
      | tally failures      | 0       |
      | tally warnings      | 0       |
      | tally success count | 2       |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace status | id            | name | version | status    | reasons | scope   |
      | fixtures         | project           | added              | demo@fixtures | demo | 1.0.0   | installed |         | project |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name     | source                       |
      | fixtures | {home}/marketplaces/fixtures |
    Then the "claude-plugins.json" file of the project scope declares these plugins:
      | id            |
      | demo@fixtures |
    When the user starts a new pi session
    Then the session offers these skills:
      | command           | description            |
      | /skill:demo-skill | A skill of demo 1.0.0. |

  Scenario: Importing leaves out a plugin the claude code settings disable
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
      | tool | 2.0.0   |
    Given the claude code settings file of the user scope holds this text:
      """
      {
        "enabledPlugins": { "demo@fixtures": true, "tool@fixtures": false },
        "extraKnownMarketplaces": {
          "fixtures": {
            "source": { "source": "directory", "path": "{home}/marketplaces/fixtures" }
          }
        }
      }
      """
    When the user runs "/claude:plugin import --scope user"
    Then the result has these fields:
      | kind                | cascade |
      | severity            | info    |
      | needs reload        | true    |
      | tally label         | Import  |
      | tally failures      | 0       |
      | tally warnings      | 0       |
      | tally success count | 2       |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace status | id            | name | version | status    | reasons | scope |
      | fixtures         | user              | added              | demo@fixtures | demo | 1.0.0   | installed |         | user  |
    Then the installation record of the user scope holds these plugins:
      | id            | version | enabled |
      | demo@fixtures | 1.0.0   | true    |
    Then the "claude-plugins.json" file of the user scope declares these plugins:
      | id            |
      | demo@fixtures |

  Scenario: Importing the same claude code settings a second time skips the marketplace and the plugin it already holds
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the claude code settings file of the user scope holds this text:
      """
      {
        "enabledPlugins": { "demo@fixtures": true },
        "extraKnownMarketplaces": {
          "fixtures": {
            "source": { "source": "directory", "path": "{home}/marketplaces/fixtures" }
          }
        }
      }
      """
    Given the user has run "/claude:plugin import --scope user"
    When the user runs "/claude:plugin import --scope user"
    Then the result has these fields:
      | kind                | cascade |
      | severity            | info    |
      | needs reload        | false   |
      | tally label         | Import  |
      | tally failures      | 0       |
      | tally warnings      | 0       |
      | tally success count | 2       |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace status | marketplace reasons | id            | name | status  | reasons           | scope |
      | fixtures         | user              | skipped            | already added       | demo@fixtures | demo | skipped | already installed | user  |
    Then the installation record of the user scope holds these plugins:
      | id            | version | enabled |
      | demo@fixtures | 1.0.0   | true    |
    Then the "claude-plugins.json" file of the user scope declares these marketplaces:
      | name     | source                       |
      | fixtures | {home}/marketplaces/fixtures |
    Then the "claude-plugins.json" file of the user scope declares these plugins:
      | id            |
      | demo@fixtures |

  Scenario: Importing reports an enabled plugin the marketplace does not offer and installs the rest
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the claude code settings file of the user scope holds this text:
      """
      {
        "enabledPlugins": { "ghost@fixtures": true, "demo@fixtures": true },
        "extraKnownMarketplaces": {
          "fixtures": {
            "source": { "source": "directory", "path": "{home}/marketplaces/fixtures" }
          }
        }
      }
      """
    When the user runs "/claude:plugin import --scope user"
    Then the result has these fields:
      | kind                | cascade                             |
      | severity            | warning                             |
      | summary             | A plugin operation needs attention. |
      | needs reload        | true                                |
      | tally label         | Import                              |
      | tally failures      | 0                                   |
      | tally warnings      | 1                                   |
      | tally success count | 2                                   |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace status | id             | name  | version | status      | reasons         | scope |
      | fixtures         | user              | added              | demo@fixtures  | demo  | 1.0.0   | installed   |                 | user  |
      | fixtures         | user              | added              | ghost@fixtures | ghost |         | unavailable | not in manifest |       |
    Then the installation record of the user scope holds these plugins:
      | id            | version | enabled |
      | demo@fixtures | 1.0.0   | true    |
    Then the "claude-plugins.json" file of the user scope declares these plugins:
      | id            |
      | demo@fixtures |
    When the user starts a new pi session
    Then the session offers these skills:
      | command           | description            |
      | /skill:demo-skill | A skill of demo 1.0.0. |

  Scenario: Importing reports a plugin pi supports only in part as unavailable with the reason install gives
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has an output style
    Given the claude code settings file of the user scope holds this text:
      """
      {
        "enabledPlugins": { "demo@fixtures": true },
        "extraKnownMarketplaces": {
          "fixtures": {
            "source": { "source": "directory", "path": "{home}/marketplaces/fixtures" }
          }
        }
      }
      """
    When the user runs "/claude:plugin import --scope user"
    Then the result has these fields:
      | kind                | cascade                             |
      | severity            | warning                             |
      | summary             | A plugin operation needs attention. |
      | needs reload        | false                               |
      | tally label         | Import                              |
      | tally failures      | 0                                   |
      | tally warnings      | 1                                   |
      | tally success count | 1                                   |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace status | id            | name | status      | reasons               |
      | fixtures         | user              | added              | demo@fixtures | demo | unavailable | unsupported component |
    Then the user scope has no installed plugins

  Scenario: Importing the project scope reads only the project's claude code settings and changes only the project scope
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | tool | 2.0.0   |
    Given the claude code settings file of the user scope holds this text:
      """
      {
        "enabledPlugins": { "demo@other": true },
        "extraKnownMarketplaces": {
          "other": {
            "source": { "source": "directory", "path": "{home}/marketplaces/other" }
          }
        }
      }
      """
    Given the claude code settings file of the project scope holds this text:
      """
      {
        "enabledPlugins": { "tool@fixtures": true },
        "extraKnownMarketplaces": {
          "fixtures": {
            "source": { "source": "directory", "path": "{home}/marketplaces/fixtures" }
          }
        }
      }
      """
    When the user runs "/claude:plugin import --scope project"
    Then the result has these fields:
      | kind                | cascade |
      | severity            | info    |
      | needs reload        | true    |
      | tally label         | Import  |
      | tally failures      | 0       |
      | tally warnings      | 0       |
      | tally success count | 2       |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace status | id            | name | version | status    | reasons | scope   |
      | fixtures         | project           | added              | tool@fixtures | tool | 2.0.0   | installed |         | project |
    Then the installation record of the project scope holds these plugins:
      | id            | version | enabled |
      | tool@fixtures | 2.0.0   | true    |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name     | source                       |
      | fixtures | {home}/marketplaces/fixtures |
    Then the "claude-plugins.json" file of the user scope does not exist
    Then the import leaves no installation record in the user scope
    When the user starts a new pi session
    Then the session offers these skills:
      | command           | description            |
      | /skill:tool-skill | A skill of tool 2.0.0. |

  Scenario: Importing the user scope reads only the user's claude code settings and changes only the user scope
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the claude code settings file of the user scope holds this text:
      """
      {
        "enabledPlugins": { "demo@fixtures": true },
        "extraKnownMarketplaces": {
          "fixtures": {
            "source": { "source": "directory", "path": "{home}/marketplaces/fixtures" }
          }
        }
      }
      """
    Given the claude code settings file of the project scope holds this text:
      """
      {
        "enabledPlugins": { "tool@other": true },
        "extraKnownMarketplaces": {
          "other": {
            "source": { "source": "directory", "path": "{home}/marketplaces/other" }
          }
        }
      }
      """
    When the user runs "/claude:plugin import --scope user"
    Then the result has these fields:
      | kind                | cascade |
      | severity            | info    |
      | needs reload        | true    |
      | tally label         | Import  |
      | tally failures      | 0       |
      | tally warnings      | 0       |
      | tally success count | 2       |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace status | id            | name | version | status    | reasons | scope |
      | fixtures         | user              | added              | demo@fixtures | demo | 1.0.0   | installed |         | user  |
    Then the installation record of the user scope holds these plugins:
      | id            | version | enabled |
      | demo@fixtures | 1.0.0   | true    |
    Then the "claude-plugins.json" file of the user scope declares these marketplaces:
      | name     | source                       |
      | fixtures | {home}/marketplaces/fixtures |
    Then the "claude-plugins.json" file of the project scope does not exist
    Then the import leaves no installation record in the project scope
    When the user starts a new pi session
    Then the session offers these skills:
      | command           | description            |
      | /skill:demo-skill | A skill of demo 1.0.0. |

  Scenario: Importing a plugin of a marketplace the scope already holds installs the plugin under the skipped marketplace
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" is added to the user scope
    Given the claude code settings file of the user scope holds this text:
      """
      {
        "enabledPlugins": { "demo@fixtures": true },
        "extraKnownMarketplaces": {
          "fixtures": {
            "source": { "source": "directory", "path": "{home}/marketplaces/fixtures" }
          }
        }
      }
      """
    When the user runs "/claude:plugin import --scope user"
    Then the result has these fields:
      | kind                | cascade |
      | severity            | info    |
      | needs reload        | true    |
      | tally label         | Import  |
      | tally failures      | 0       |
      | tally warnings      | 0       |
      | tally success count | 2       |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace status | marketplace reasons | id            | name | version | status    | reasons | scope |
      | fixtures         | user              | skipped            | already added       | demo@fixtures | demo | 1.0.0   | installed |         | user  |
    Then the installation record of the user scope holds these plugins:
      | id            | version | enabled |
      | demo@fixtures | 1.0.0   | true    |
    Then the "claude-plugins.json" file of the user scope declares these marketplaces:
      | name     | source                       |
      | fixtures | {home}/marketplaces/fixtures |
    Then the "claude-plugins.json" file of the user scope declares these plugins:
      | id            |
      | demo@fixtures |

  Scenario: Importing a plugin whose installed dependency moves to a version that needs a new dependency installs that dependency too
    Given the marketplace "fixtures" offers these plugins with dependencies:
      | name | version | dependencies |
      | aaa  | 1.0.0   |              |
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install aaa@fixtures --scope user"
    Given the marketplace "fixtures" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | aaa@^2.0.0   |
      | aaa  | 2.0.0   | fff          |
      | fff  | 1.0.0   |              |
    Given the claude code settings file of the user scope holds this text:
      """
      {
        "enabledPlugins": { "app@fixtures": true },
        "extraKnownMarketplaces": {
          "fixtures": {
            "source": { "source": "directory", "path": "{home}/marketplaces/fixtures" }
          }
        }
      }
      """
    When the user runs "/claude:plugin import --scope user"
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace status | marketplace reasons | id           | name | version | status    | reasons | scope |
      | fixtures         | user              | skipped            | already added       | app@fixtures | app  | 1.0.0   | installed |         | user  |
    Then the installation record of the user scope holds these plugins:
      | id           | version | enabled |
      | aaa@fixtures | 2.0.0   | true    |
      | app@fixtures | 1.0.0   | true    |
      | fff@fixtures | 1.0.0   | true    |
    When the user starts a new pi session
    Then the session offers these skills:
      | command          | description           |
      | /skill:aaa-skill | A skill of aaa 2.0.0. |
      | /skill:app-skill | A skill of app 1.0.0. |
      | /skill:fff-skill | A skill of fff 1.0.0. |

  Scenario: Importing a plugin the scope holds disabled enables it instead of reinstalling it
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user has run "/claude:plugin disable demo@fixtures --scope user"
    Given the claude code settings file of the user scope holds this text:
      """
      {
        "enabledPlugins": { "demo@fixtures": true },
        "extraKnownMarketplaces": {
          "fixtures": {
            "source": { "source": "directory", "path": "{home}/marketplaces/fixtures" }
          }
        }
      }
      """
    When the user runs "/claude:plugin import --scope user"
    Then the result has these fields:
      | kind                | cascade |
      | severity            | info    |
      | needs reload        | true    |
      | tally label         | Import  |
      | tally failures      | 0       |
      | tally warnings      | 0       |
      | tally success count | 2       |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace status | marketplace reasons | id            | name | version | status    | reasons | scope |
      | fixtures         | user              | skipped            | already added       | demo@fixtures | demo | 1.0.0   | installed |         | user  |
    Then the installation record of the user scope holds these plugins:
      | id            | version | enabled |
      | demo@fixtures | 1.0.0   | true    |
    Then the "claude-plugins.json" file of the user scope declares these plugins:
      | id            | enabled |
      | demo@fixtures | true    |
    Then the user scope stages these skills and prompts:
      | kind  | name       |
      | skill | demo-skill |

  Scenario: Importing a partially installed plugin the scope holds disabled enables it as partially installed
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has an output style
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user --partial"
    Given the user has run "/claude:plugin disable demo@fixtures --scope user"
    Given the claude code settings file of the user scope holds this text:
      """
      {
        "enabledPlugins": { "demo@fixtures": true },
        "extraKnownMarketplaces": {
          "fixtures": {
            "source": { "source": "directory", "path": "{home}/marketplaces/fixtures" }
          }
        }
      }
      """
    When the user runs "/claude:plugin import --scope user"
    Then the result has these fields:
      | kind                | cascade |
      | severity            | info    |
      | needs reload        | true    |
      | tally label         | Import  |
      | tally failures      | 0       |
      | tally warnings      | 0       |
      | tally success count | 2       |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace status | marketplace reasons | id            | name | version | status              | reasons               | scope |
      | fixtures         | user              | skipped            | already added       | demo@fixtures | demo | 1.0.0   | partially-installed | unsupported component | user  |
    Then the installation record of the user scope holds these plugins:
      | id            | version | enabled |
      | demo@fixtures | 1.0.0   | true    |
    Then the user scope stages these skills and prompts:
      | kind  | name       |
      | skill | demo-skill |

  Scenario: Importing while another process holds the state lock of the scope fails as lock held and changes nothing
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the claude code settings file of the user scope holds this text:
      """
      {
        "enabledPlugins": { "demo@fixtures": true },
        "extraKnownMarketplaces": {
          "fixtures": {
            "source": { "source": "directory", "path": "{home}/marketplaces/fixtures" }
          }
        }
      }
      """
    Given another process holds the state lock of the user scope
    When the user runs "/claude:plugin import --scope user"
    Then the result has these fields:
      | kind           | cascade                      |
      | severity       | error                        |
      | needs reload   | false                        |
      | summary        | Some operations have failed. |
      | tally label    | Import                       |
      | tally failures | 2                            |
      | tally warnings | 0                            |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace status | id                | name     | status | reasons   | scope | cause chain                                                                                                                                                                       | cause truncated | leaks | rollback partial |
      | fixtures         | user              | failed             | fixtures@fixtures | fixtures | failed | lock held | user  | Another pi-claude-marketplace operation is in progress for user scope ({agent dir}/pi-claude-marketplace/.state-lock). Retry after it completes., Lock file is already being held | false           |       |                  |
    Then the import leaves no installation record in the user scope
    Then the user scope holds no marketplace checkout
    Then the "claude-plugins.json" file of the user scope does not exist
