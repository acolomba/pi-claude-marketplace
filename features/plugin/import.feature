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
      | marketplace name | marketplace scope | marketplace status | marketplace reasons | id           | name         | status    | reasons                 | scope | version | from  | to    | cause chain                                                              | cause truncated | leaks | rollback partial |
      | fixtures         | user              | skipped            | already added       | app@fixtures | app          | installed |                         | user  | 1.0.0   |       |       |                                                                          |                 |       |                  |
      | fixtures         | user              | skipped            | already added       | fff@fixtures | fff@fixtures | installed |                         | user  | 1.0.0   |       |       |                                                                          |                 |       |                  |
      | fixtures         | user              | skipped            | already added       | aaa@fixtures | aaa@fixtures | updated   | dependency current copy | user  |         | 1.0.0 | 2.0.0 | constrained to the combined range (^2.0.0) -- required by "app@fixtures" | false           |       |                  |
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

  Scenario: Importing a plugin whose moved dependency needs a disabled dependency keeps that dependency's disabled config entry
    Given the marketplace "fixtures" offers these plugins with dependencies:
      | name | version | dependencies |
      | aaa  | 1.0.0   |              |
      | ddd  | 1.0.0   |              |
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install aaa@fixtures --scope user"
    Given the user has run "/claude:plugin install ddd@fixtures --scope user"
    Given the user has run "/claude:plugin disable ddd@fixtures --scope user"
    Given the marketplace "fixtures" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | aaa@^2.0.0   |
      | aaa  | 2.0.0   | ddd          |
      | ddd  | 1.0.0   |              |
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
    Then the "claude-plugins.json" file of the user scope declares these plugins:
      | id           | enabled |
      | aaa@fixtures |         |
      | ddd@fixtures | false   |
      | app@fixtures |         |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace status | marketplace reasons | id           | name         | status    | reasons                               | scope | version | from  | to    | cause chain                                                              | cause truncated | leaks | rollback partial |
      | fixtures         | user              | skipped            | already added       | app@fixtures | app          | installed |                                       | user  | 1.0.0   |       |       |                                                                          |                 |       |                  |
      | fixtures         | user              | skipped            | already added       | ddd@fixtures | ddd@fixtures | installed | already installed, dependency enabled | user  | 1.0.0   |       |       |                                                                          |                 |       |                  |
      | fixtures         | user              | skipped            | already added       | aaa@fixtures | aaa@fixtures | updated   | dependency current copy               | user  |         | 1.0.0 | 2.0.0 | constrained to the combined range (^2.0.0) -- required by "app@fixtures" | false           |       |                  |

  Scenario: Importing a plugin whose second dependency move fails lists the move that landed
    Given the marketplace "fixtures" offers these plugins with dependencies:
      | name | version | dependencies |
      | aaa  | 1.0.0   |              |
      | zzz  | 1.0.0   |              |
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install aaa@fixtures --scope user"
    Given the user has run "/claude:plugin install zzz@fixtures --scope user"
    Given the marketplace "fixtures" offers these plugins with dependencies:
      | name | version | dependencies          |
      | app  | 1.0.0   | zzz@^2.0.0,aaa@^2.0.0 |
      | aaa  | 2.0.0   |                       |
      | zzz  | 2.0.0   |                       |
    Given the published plugin "aaa" of the marketplace "fixtures" has an unreadable skill file
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
      | marketplace name | marketplace scope | marketplace status | marketplace reasons | id           | name         | status  | reasons                 | scope | version | from  | to    | cause chain                                                              | cause truncated | leaks | rollback partial |
      | fixtures         | user              | skipped            | already added       | app@fixtures | app          | failed  | dependency failed       | user  |         |       |       | Dependency "aaa@fixtures" did not move into ^2.0.0.                      | false           |       |                  |
      | fixtures         | user              | skipped            | already added       | zzz@fixtures | zzz@fixtures | updated | dependency current copy | user  |         | 1.0.0 | 2.0.0 | constrained to the combined range (^2.0.0) -- required by "app@fixtures" | false           |       |                  |
      | fixtures         | user              | skipped            | already added       | aaa@fixtures | aaa@fixtures | failed  |                         | user  | 1.0.0   |       |       | {unreadable skill file copy error}                                       | false           |       |                  |
    Then the installation record of the user scope holds these plugins:
      | id           | version | enabled |
      | aaa@fixtures | 1.0.0   | true    |
      | zzz@fixtures | 2.0.0   | true    |

  Scenario: Importing a plugin whose install moves a dependency lists every dependency the install added
    Given the marketplace "fixtures" offers these plugins with dependencies:
      | name | version | dependencies |
      | aaa  | 1.0.0   |              |
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install aaa@fixtures --scope user"
    Given the marketplace "fixtures" offers these plugins with dependencies:
      | name | version | dependencies   |
      | app  | 1.0.0   | aaa@^2.0.0,ggg |
      | aaa  | 2.0.0   | fff            |
      | fff  | 1.0.0   |                |
      | ggg  | 1.0.0   |                |
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
      | marketplace name | marketplace scope | marketplace status | marketplace reasons | id           | name         | status    | reasons                 | scope | version | from  | to    | cause chain                                                              | cause truncated | leaks | rollback partial |
      | fixtures         | user              | skipped            | already added       | app@fixtures | app          | installed |                         | user  | 1.0.0   |       |       |                                                                          |                 |       |                  |
      | fixtures         | user              | skipped            | already added       | fff@fixtures | fff@fixtures | installed |                         | user  | 1.0.0   |       |       |                                                                          |                 |       |                  |
      | fixtures         | user              | skipped            | already added       | aaa@fixtures | aaa@fixtures | updated   | dependency current copy | user  |         | 1.0.0 | 2.0.0 | constrained to the combined range (^2.0.0) -- required by "app@fixtures" | false           |       |                  |
      | fixtures         | user              | skipped            | already added       | ggg@fixtures | ggg@fixtures | installed |                         | user  | 1.0.0   |       |       |                                                                          |                 |       |                  |
    Then the installation record of the user scope holds these plugins:
      | id           | version | enabled |
      | aaa@fixtures | 2.0.0   | true    |
      | app@fixtures | 1.0.0   | true    |
      | fff@fixtures | 1.0.0   | true    |
      | ggg@fixtures | 1.0.0   | true    |

  Scenario: Importing adds an extra known marketplace that no enabled plugin names
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "tools" is published as a dir source
    Given the claude code settings file of the user scope holds this text:
      """
      {
        "enabledPlugins": { "demo@fixtures": true },
        "extraKnownMarketplaces": {
          "fixtures": {
            "source": { "source": "directory", "path": "{home}/marketplaces/fixtures" }
          },
          "tools": {
            "source": { "source": "directory", "path": "{home}/marketplaces/tools" }
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
      | tally success count | 3       |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace status | id            | name | version | status    | reasons | scope |
      | fixtures         | user              | added              | demo@fixtures | demo | 1.0.0   | installed |         | user  |
      | tools            | user              | added              |               |      |         |           |         |       |
    Then the "claude-plugins.json" file of the user scope declares these marketplaces:
      | name     | source                       |
      | fixtures | {home}/marketplaces/fixtures |
      | tools    | {home}/marketplaces/tools    |
    Then the "claude-plugins.json" file of the user scope declares these plugins:
      | id            |
      | demo@fixtures |

  Scenario: Importing settings that name a known marketplace under another name fails its plugin as not added
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" is added to the user scope
    Given the claude code settings file of the user scope holds this text:
      """
      {
        "enabledPlugins": { "demo@other": true },
        "extraKnownMarketplaces": {
          "other": {
            "source": { "source": "directory", "path": "{home}/marketplaces/fixtures" }
          }
        }
      }
      """
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
      | marketplace name | marketplace scope | marketplace status | id         | name | status | reasons | scope | cause chain                                         | cause truncated | leaks | rollback partial |
      | other            | user              | failed             | demo@other | demo | failed |         | user  | Marketplace "other" is not added in the user scope. | false           |       |                  |
    Then the user scope has no installed plugins
    Then the "claude-plugins.json" file of the user scope declares these marketplaces:
      | name     | source                       |
      | fixtures | {home}/marketplaces/fixtures |
    Then the "claude-plugins.json" file of the user scope declares no plugins

  Scenario: Importing settings that name a known marketplace by its recorded name keeps the name the config uses for it
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" is added to the user scope
    Given a config in scope user and layer base, with these marketplaces:
      | name  | source                       | autoupdate |
      | other | {home}/marketplaces/fixtures |            |
    Given a config in scope user and layer base, with these plugins:
      | marketplace | plugin | enabled |
      | other       | demo   |         |
    Given the user has run "/claude:plugin apply --scope user"
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
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace status | marketplace reasons | id            | name | status  | reasons           | scope |
      | fixtures         | user              | skipped            | already added       | demo@fixtures | demo | skipped | already installed | user  |
    Then the installation record of the user scope holds these plugins:
      | id            | version | enabled |
      | demo@fixtures | 1.0.0   | true    |
    Then the "claude-plugins.json" file of the user scope declares these marketplaces:
      | name  | source                       |
      | other | {home}/marketplaces/fixtures |
    Then the "claude-plugins.json" file of the user scope declares these plugins:
      | id         |
      | demo@other |

  Scenario: Importing settings that also declare the recorded name of a known marketplace fails the other name's plugin as not added
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" is added to the user scope
    Given the claude code settings file of the user scope holds this text:
      """
      {
        "enabledPlugins": { "demo@other": true },
        "extraKnownMarketplaces": {
          "other": {
            "source": { "source": "directory", "path": "{home}/marketplaces/fixtures" }
          },
          "fixtures": {
            "source": { "source": "file", "url": "https://example.test/marketplace.json" }
          }
        }
      }
      """
    When the user runs "/claude:plugin import --scope user"
    Then the command reports these results:
      | kind       | severity | needs reload | summary                      | tally label | tally failures | tally warnings | header                        | lines                                                                                                                                                                 |
      | cascade    | error    | false        | Some operations have failed. | Import      | 2              | 0              |                               |                                                                                                                                                                       |
      | diagnostic | warning  | false        |                              |             |                |                | 1 import diagnostic surfaced. | Skipping Claude marketplace "fixtures" because it has no supported url, github, or directory source (nested file/remote-marketplace.json sources are not importable). |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | marketplace status | id         | name | status | reasons | scope | cause chain                                         | cause truncated | leaks | rollback partial |
      | other            | user              | failed             | demo@other | demo | failed |         | user  | Marketplace "other" is not added in the user scope. | false           |       |                  |
    Then the user scope has no installed plugins

  Scenario: Importing two settings marketplaces that name one known marketplace's source reuses it with no row
    Given the marketplace "fixtures" is added to the user scope
    Given the claude code settings file of the user scope holds this text:
      """
      {
        "extraKnownMarketplaces": {
          "other": {
            "source": { "source": "directory", "path": "{home}/marketplaces/fixtures" }
          },
          "twin": {
            "source": { "source": "directory", "path": "{home}/marketplaces/fixtures" }
          }
        }
      }
      """
    When the user runs "/claude:plugin import --scope user"
    Then the result lists no marketplaces
    Then the "claude-plugins.json" file of the user scope declares these marketplaces:
      | name     | source                       |
      | fixtures | {home}/marketplaces/fixtures |

  Scenario: Importing a plugin whose install rollback cannot finish names the rollback phase
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has a read-only skill directory
    Given a directory blocks the mcp-adapter.json file of the user scope
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
      | kind                | cascade                        |
      | severity            | error                          |
      | needs reload        | false                          |
      | summary             | A plugin operation has failed. |
      | tally label         | Import                         |
      | tally failures      | 1                              |
      | tally warnings      | 0                              |
      | tally success count | 1                              |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace status | id            | name | status | reasons          | scope | cause chain                                                  | cause truncated | leaks | rollback partial                                                                                            |
      | fixtures         | user              | added              | demo@fixtures | demo | failed | rollback partial | user  | {mcp-adapter.json read error}, {mcp-adapter.json read error} | false           |       | [{"phase":"skills","cause":{"causeChain":["{read-only skill directory removal error}"],"truncated":false}}] |
    Then the installation record of the user scope holds these plugins:
      | id | version | enabled |
    Then the user scope stages these skills and prompts:
      | kind  | name       |
      | skill | demo-skill |

  Scenario: Importing a disabled plugin whose enable rollback cannot finish names the rollback phase
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user has run "/claude:plugin disable demo@fixtures --scope user"
    Given the published plugin "demo" of the marketplace "fixtures" has a read-only skill directory
    Given a directory blocks the mcp-adapter.json file of the user scope
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
      | kind                | cascade                        |
      | severity            | error                          |
      | needs reload        | false                          |
      | summary             | A plugin operation has failed. |
      | tally label         | Import                         |
      | tally failures      | 1                              |
      | tally warnings      | 0                              |
      | tally success count | 1                              |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace status | marketplace reasons | id            | name | status | reasons          | scope | cause chain                                                  | cause truncated | leaks | rollback partial                                                                                            |
      | fixtures         | user              | skipped            | already added       | demo@fixtures | demo | failed | rollback partial | user  | {mcp-adapter.json read error}, {mcp-adapter.json read error} | false           |       | [{"phase":"skills","cause":{"causeChain":["{read-only skill directory removal error}"],"truncated":false}}] |
    Then the installation record of the user scope holds these plugins:
      | id            | version | enabled |
      | demo@fixtures | 1.0.0   | false   |

  Scenario: Importing a plugin whose dependency rollback cannot finish names the dependency and its rollback phase
    Given the marketplace "fixtures" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib          |
      | lib  | 1.0.0   |              |
    Given the published plugin "lib" of the marketplace "fixtures" has a read-only skill directory
    Given a directory blocks the mcp-adapter.json file of the user scope
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
    Then the result has these fields:
      | kind                | cascade                             |
      | severity            | error                               |
      | needs reload        | false                               |
      | summary             | Some plugin operations have failed. |
      | tally label         | Import                              |
      | tally failures      | 2                                   |
      | tally warnings      | 0                                   |
      | tally success count | 1                                   |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace status | id           | name         | status | reasons           | scope | cause chain                                                  | cause truncated | leaks | rollback partial                                                                                            |
      | fixtures         | user              | added              | app@fixtures | app          | failed | dependency failed | user  |                                                              |                 |       |                                                                                                             |
      | fixtures         | user              | added              | lib@fixtures | lib@fixtures | failed | rollback partial  | user  | {mcp-adapter.json read error}, {mcp-adapter.json read error} | false           |       | [{"phase":"skills","cause":{"causeChain":["{read-only skill directory removal error}"],"truncated":false}}] |
    Then the installation record of the user scope holds these plugins:
      | id | version | enabled |

  Scenario: Importing two plugins whose shared dependency rollback cannot finish names that dependency once
    Given the marketplace "fixtures" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib          |
      | tool | 1.0.0   | lib          |
      | lib  | 1.0.0   |              |
    Given the published plugin "lib" of the marketplace "fixtures" has a read-only skill directory
    Given a directory blocks the mcp-adapter.json file of the user scope
    Given the claude code settings file of the user scope holds this text:
      """
      {
        "enabledPlugins": { "app@fixtures": true, "tool@fixtures": true },
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
      | severity            | error                               |
      | needs reload        | false                               |
      | summary             | Some plugin operations have failed. |
      | tally label         | Import                              |
      | tally failures      | 3                                   |
      | tally warnings      | 0                                   |
      | tally success count | 1                                   |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace status | id            | name         | status | reasons           | scope | cause chain                                                  | cause truncated | leaks | rollback partial                                                                                            |
      | fixtures         | user              | added              | app@fixtures  | app          | failed | dependency failed | user  |                                                              |                 |       |                                                                                                             |
      | fixtures         | user              | added              | lib@fixtures  | lib@fixtures | failed | rollback partial  | user  | {mcp-adapter.json read error}, {mcp-adapter.json read error} | false           |       | [{"phase":"skills","cause":{"causeChain":["{read-only skill directory removal error}"],"truncated":false}}] |
      | fixtures         | user              | added              | tool@fixtures | tool         | failed | dependency failed | user  |                                                              |                 |       |                                                                                                             |
    Then the installation record of the user scope holds these plugins:
      | id | version | enabled |
