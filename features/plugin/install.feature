Feature: Plugin install

  Installing a plugin from an added marketplace materializes it in the chosen scope.
  The scenarios run the real extension in a headless Pi, read its JSON results,
  and use a local marketplace in place of a published one.

  Background:
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" is added to the project scope

  Scenario: Installing a plugin reports it installed in the chosen scope
    When the user runs "/claude:plugin install demo@fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | installed |         | project | 1.0.0   |

  Scenario: An install failure redacts its root path
    Given the published plugin "demo" of the marketplace "fixtures" has an unreadable skill file
    When the user runs "/claude:plugin install demo@fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status | reasons | scope   | version | cause chain                        | cause truncated | leaks | rollback partial |
      | fixtures         | project           | demo@fixtures | demo | failed |         | project | 1.0.0   | {unreadable skill file copy error} | false           |       |                  |
    Then the command result contains no absolute sandbox path
    Then the project scope has no installed plugins

  Scenario: A new session offers the skills of the installed plugin
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    When the user starts a new pi session
    Then the session offers these skills:
      | command           | description            |
      | /skill:demo-skill | A skill of demo 1.0.0. |

  Scenario: A session in another project offers the skills of a plugin installed into the user scope and none of a project-scope plugin
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
      | pp   | 1.0.0   |
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user has run "/claude:plugin install pp@fixtures --scope project"
    When the user starts a new pi session in another project
    Then the session offers these skills:
      | command           | description            |
      | /skill:demo-skill | A skill of demo 1.0.0. |

  Scenario: The plugin list shows the installed plugin
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    When the user runs "/claude:plugin list --scope project"
    Then the result has these fields:
      | kind                | cascade     |
      | severity            | info        |
      | needs reload        | false       |
      | tally label         | Plugin list |
      | tally failures      | 0           |
      | tally warnings      | 0           |
      | tally success count | 1           |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | installed |         | project | 1.0.0   |

  Scenario: Installing a plugin the marketplace does not offer fails as not in manifest
    When the user runs "/claude:plugin install missing@fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id               | name    | status | reasons         | scope   | cause chain                                           | cause truncated | leaks | rollback partial |
      | fixtures         | project           | missing@fixtures | missing | failed | not in manifest | project | Plugin "missing" not found in marketplace "fixtures". | false           |       |                  |
    Then the "claude-plugins.json" file of the project scope declares no plugins
    Then the project scope has no installed plugins

  Scenario: Installing a plugin whose name breaks the plugin id rule fails as an invalid manifest
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | _x   | 1.0.0   |
    When the user runs "/claude:plugin install _x@fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id          | name | status | reasons          | scope   | cause chain                                                                                                                                                                                                                                                                                            | cause truncated | leaks | rollback partial |
      | fixtures         | project           | _x@fixtures | _x   | failed | invalid manifest | project | Plugin "_x@fixtures" cannot be installed, because its id is invalid: Each part of a plugin id (plugin@marketplace) may use only the letters a-z and A-Z, digits, ".", "_" and "-", and must start with a letter or digit. Here the plugin's name does not; the marketplace's maintainer can rename it. | false           |       |                  |
    Then the "claude-plugins.json" file of the project scope declares no plugins
    Then the project scope has no installed plugins

  Scenario: Installing a plugin whose name holds a zero-width space shows the name escaped in its failed row
    Given the marketplace "fixtures" offers these plugins:
      | name       | version |
      | zero​width | 1.0.0   |
    When the user runs "/claude:plugin install zero​width@fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id                       | name            | status | reasons          | scope   | cause chain                                                                                                                                                                                                                                                                                                         | cause truncated | leaks | rollback partial |
      | fixtures         | project           | zero\u200bwidth@fixtures | zero\u200bwidth | failed | invalid manifest | project | Plugin "zero\u200bwidth@fixtures" cannot be installed, because its id is invalid: Each part of a plugin id (plugin@marketplace) may use only the letters a-z and A-Z, digits, ".", "_" and "-", and must start with a letter or digit. Here the plugin's name does not; the marketplace's maintainer can rename it. | false           |       |                  |
    Then the "claude-plugins.json" file of the project scope declares no plugins
    Then the project scope has no installed plugins

  Scenario: Installing a plugin whose name breaks the plugin id rule and that the marketplace does not offer fails as not in manifest
    When the user runs "/claude:plugin install _x@fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id          | name | status | reasons         | scope   | cause chain                                      | cause truncated | leaks | rollback partial |
      | fixtures         | project           | _x@fixtures | _x   | failed | not in manifest | project | Plugin "_x" not found in marketplace "fixtures". | false           |       |                  |
    Then the "claude-plugins.json" file of the project scope declares no plugins
    Then the project scope has no installed plugins

  Scenario: Installing a path-source plugin records the version its plugin.json declares over its entry's
    Given the marketplace "fixtures" publishes this manifest:
      """
      {
        "name": "fixtures",
        "owner": { "name": "features" },
        "plugins": [{ "name": "demo", "source": "./plugins/demo", "version": "0.9.0" }]
      }
      """
    When the user runs "/claude:plugin install demo@fixtures --scope project"
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | installed |         | project | 1.0.0   |
    Then the installation record of the project scope holds these plugins:
      | id            | version | enabled |
      | demo@fixtures | 1.0.0   | true    |

  Scenario: Installing a path-source plugin whose directory is missing names it unavailable as source missing
    Given the marketplace "fixtures" publishes this manifest:
      """
      {
        "name": "fixtures",
        "owner": { "name": "features" },
        "plugins": [{ "name": "ghost", "source": "./plugins/ghost", "version": "1.0.0" }]
      }
      """
    When the user runs "/claude:plugin install ghost@fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id             | name  | status      | reasons        |
      | fixtures         | project           | ghost@fixtures | ghost | unavailable | source missing |
    Then the project scope has no installed plugins

  Scenario: Installing a plugin that is already installed fails as already installed
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    When the user runs "/claude:plugin install demo@fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status | reasons           | scope   | cause chain                                                   | cause truncated | leaks | rollback partial |
      | fixtures         | project           | demo@fixtures | demo | failed | already installed | project | Plugin "demo" is already installed in marketplace "fixtures". | false           |       |                  |
    Then the "claude-plugins.json" file of the project scope declares these plugins:
      | id            |
      | demo@fixtures |
    When the user starts a new pi session
    Then the session offers these skills:
      | command           | description            |
      | /skill:demo-skill | A skill of demo 1.0.0. |

  Scenario: Installing a plugin into the base layer from a marketplace added with --local fails as marketplace in local layer only
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | pp   | 1.0.0   |
    Given the user has run "/claude:plugin marketplace add {home}/marketplaces/tools --scope project --local"
    When the user runs "/claude:plugin install pp@tools --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id       | name | status | reasons                         | scope   | cause chain                                                                                                                 | cause truncated | leaks | rollback partial |
      | tools            | project           | pp@tools | pp   | failed | marketplace in local layer only | project | The marketplace tools is declared only in the local config (claude-plugins.local.json). Run the command again with --local. | false           |       |                  |
    Then the "claude-plugins.json" file of the project scope declares no plugins
    Then the "claude-plugins.local.json" file of the project scope declares no plugins
    Then the project scope has no installed plugins

  Scenario: Installing with --local from a marketplace only the base layer declares also declares the marketplace in the local layer
    When the user runs "/claude:plugin install demo@fixtures --scope project --local"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | installed |         | project | 1.0.0   |
    Then the "claude-plugins.local.json" file of the project scope declares these marketplaces:
      | name     | source                       |
      | fixtures | {home}/marketplaces/fixtures |
    Then the "claude-plugins.local.json" file of the project scope declares these plugins:
      | id            |
      | demo@fixtures |
    Then the "claude-plugins.json" file of the project scope declares no plugins

  Scenario: A plugin installed with --local from a marketplace the base layer declares stays installed after the user removes the marketplace from the base layer
    Given the user has run "/claude:plugin install demo@fixtures --scope project --local"
    Given the user has run "/claude:plugin marketplace remove fixtures --scope project"
    When the user starts a new pi session
    Then the session offers these skills:
      | command           | description            |
      | /skill:demo-skill | A skill of demo 1.0.0. |

  Scenario: Installing with --local a plugin the base layer declares and the scope has not installed installs it
    Given a config in scope project and layer base, with these plugins:
      | marketplace | plugin | enabled |
      | fixtures    | demo   |         |
    When the user runs "/claude:plugin install demo@fixtures --scope project --local"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | installed |         | project | 1.0.0   |
    Then the "claude-plugins.local.json" file of the project scope declares these plugins:
      | id            |
      | demo@fixtures |
    Then the "claude-plugins.local.json" file of the project scope declares these marketplaces:
      | name     | source                       |
      | fixtures | {home}/marketplaces/fixtures |
    Then the "claude-plugins.json" file of the project scope declares these plugins:
      | id            |
      | demo@fixtures |

  Scenario: Installing with --local a plugin the base layer declares adds the local declaration and installs nothing
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    When the user runs "/claude:plugin install demo@fixtures --scope project --local"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status  | reasons                         | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | skipped | already installed in base layer | project | 1.0.0   |
    Then the "claude-plugins.local.json" file of the project scope declares these plugins:
      | id            |
      | demo@fixtures |
    Then the "claude-plugins.local.json" file of the project scope declares these marketplaces:
      | name     | source                       |
      | fixtures | {home}/marketplaces/fixtures |
    Then the "claude-plugins.json" file of the project scope declares these plugins:
      | id            |
      | demo@fixtures |

  Scenario: Installing without --local a plugin installed with --local adds the declaration in the base layer and installs nothing
    Given the user has run "/claude:plugin install demo@fixtures --scope project --local"
    When the user runs "/claude:plugin install demo@fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status  | reasons                          | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | skipped | already installed in local layer | project | 1.0.0   |
    Then the "claude-plugins.json" file of the project scope declares these plugins:
      | id            |
      | demo@fixtures |
    Then the "claude-plugins.local.json" file of the project scope declares these plugins:
      | id            |
      | demo@fixtures |

  Scenario: Installing with no --scope records the plugin in the user scope only
    Given the marketplace "fixtures" is added to the user scope
    When the user runs "/claude:plugin install demo@fixtures"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope | version |
      | fixtures         | user              | demo@fixtures | demo | installed |         | user  | 1.0.0   |
    Then the installation record of the user scope holds these plugins:
      | id            | version | enabled |
      | demo@fixtures | 1.0.0   | true    |
    Then the project scope has no installed plugins
    Then the "claude-plugins.json" file of the user scope declares these plugins:
      | id            |
      | demo@fixtures |
    Then the "claude-plugins.json" file of the project scope declares no plugins

  Scenario: Installing with --scope user records the plugin in the user scope only
    Given the marketplace "fixtures" is added to the user scope
    When the user runs "/claude:plugin install demo@fixtures --scope user"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope | version |
      | fixtures         | user              | demo@fixtures | demo | installed |         | user  | 1.0.0   |
    Then the installation record of the user scope holds these plugins:
      | id            | version | enabled |
      | demo@fixtures | 1.0.0   | true    |
    Then the project scope has no installed plugins
    Then the "claude-plugins.json" file of the user scope declares these plugins:
      | id            |
      | demo@fixtures |
    Then the "claude-plugins.json" file of the project scope declares no plugins

  Scenario: The project-scope plugin list offers the plugin as available once the user scope installs it with no --scope
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures"
    When the user runs "/claude:plugin list --scope project"
    Then the result has these fields:
      | kind                | cascade     |
      | severity            | info        |
      | needs reload        | false       |
      | tally label         | Plugin list |
      | tally failures      | 0           |
      | tally warnings      | 0           |
      | tally success count | 1           |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | version |
      | fixtures         | project           | demo@fixtures | demo | available |         | 1.0.0   |

  Scenario: The project-scope plugin list offers the plugin as available once the user scope installs it with --scope user
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    When the user runs "/claude:plugin list --scope project"
    Then the result has these fields:
      | kind                | cascade     |
      | severity            | info        |
      | needs reload        | false       |
      | tally label         | Plugin list |
      | tally failures      | 0           |
      | tally warnings      | 0           |
      | tally success count | 1           |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | version |
      | fixtures         | project           | demo@fixtures | demo | available |         | 1.0.0   |

  Scenario: A session in another project offers the skills of a plugin installed with no --scope
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures"
    When the user starts a new pi session in another project
    Then the session offers these skills:
      | command           | description            |
      | /skill:demo-skill | A skill of demo 1.0.0. |

  Scenario: Installing a plugin whose manifest links outside its marketplace refuses it and installs nothing
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib          |
      | lib  | 1.2.0   |              |
    Given the published plugin "app" of the marketplace "tools" links its manifest to a file outside the marketplace
    Given the marketplace "tools" is added to the project scope
    When the user runs "/claude:plugin install app@tools --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name | status      | reasons             |
      | tools            | project           | app@tools | app  | unavailable | unreadable manifest |
    Then the project scope has no installed plugins
