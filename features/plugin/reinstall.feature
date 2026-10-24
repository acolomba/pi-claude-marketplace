Feature: Plugin reinstall

  Reinstalling a plugin builds it again in place at the version its marketplace offers now.
  The scenarios run the real extension in a headless Pi, read its JSON results,
  and use a local marketplace in place of a published one.

  Background:
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"

  Scenario: Reinstalling with --local a plugin only the base layer declares fails as plugin in base layer only
    When the user runs "/claude:plugin reinstall demo@fixtures --scope project --local"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status | reasons                   | scope   | cause chain                                                                                                                | cause truncated | leaks | rollback partial |
      | fixtures         | project           | demo@fixtures | demo | failed | plugin in base layer only | project | The plugin demo@fixtures is declared only in the base config (claude-plugins.json). Run the command again without --local. | false           |       |                  |
    Then the "claude-plugins.local.json" file of the project scope does not exist
    Then the "claude-plugins.json" file of the project scope declares these plugins:
      | id            |
      | demo@fixtures |
    When the user starts a new pi session
    Then the session offers these skills:
      | command           | description            |
      | /skill:demo-skill | A skill of demo 1.0.0. |

  Scenario: Reinstalling every plugin with --local reinstalls only the plugins the local layer declares
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
      | pp   | 1.0.0   |
    Given the user has run "/claude:plugin install pp@fixtures --scope project --local"
    When the user runs "/claude:plugin reinstall --scope project --local"
    Then the result has these fields:
      | kind                | cascade          |
      | severity            | info             |
      | needs reload        | true             |
      | tally label         | Plugin reinstall |
      | tally failures      | 0                |
      | tally warnings      | 0                |
      | tally success count | 1                |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id          | name | status      | reasons | scope   | version |
      | fixtures         | project           | pp@fixtures | pp   | reinstalled |         | project | 1.0.0   |

  Scenario: Reinstalling every plugin with --local also reinstalls the dependencies the local plugins need
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib          |
      | lib  | 1.0.0   |              |
      | svc  | 1.0.0   | core         |
      | core | 1.0.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install app@tools --scope project --local"
    Given the user has run "/claude:plugin install svc@tools --scope project"
    When the user runs "/claude:plugin reinstall --scope project --local"
    Then the result has these fields:
      | kind                | cascade          |
      | severity            | info             |
      | needs reload        | true             |
      | tally label         | Plugin reinstall |
      | tally failures      | 0                |
      | tally warnings      | 0                |
      | tally success count | 2                |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name | status      | reasons | scope   | version |
      | tools            | project           | app@tools | app  | reinstalled |         | project | 1.0.0   |
      | tools            | project           | lib@tools | lib  | reinstalled |         | project | 1.0.0   |

  Scenario: Reinstalling every plugin with --local fails and reinstalls nothing when the dependencies of a local plugin cannot be read
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
      | pp   | 1.0.0   |
    Given the user has run "/claude:plugin install pp@fixtures --scope project --local"
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib          |
      | lib  | 1.0.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install app@tools --scope project --local"
    Given the manifest of the marketplace "tools" has become invalid
    When the user runs "/claude:plugin reinstall --scope project --local"
    Then the result has these fields:
      | kind           | cascade                        |
      | severity       | error                          |
      | needs reload   | false                          |
      | summary        | A plugin operation has failed. |
      | tally label    | Plugin reinstall               |
      | tally failures | 1                              |
      | tally warnings | 0                              |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id                      | name        | status | reasons    | scope   | cause chain                                                                    | cause truncated | leaks | rollback partial |
      | (reinstall)      | project           | (reinstall)@(reinstall) | (reinstall) | failed | unreadable | project | cannot read the dependencies of app@tools: its marketplace manifest is invalid | false           |       |                  |

  Scenario: Reinstalling a dependency declares nothing in either layer
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib          |
      | lib  | 1.0.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install app@tools --scope project"
    When the user runs "/claude:plugin reinstall lib@tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name | status      | reasons | scope   | version |
      | tools            | project           | lib@tools | lib  | reinstalled |         | project | 1.0.0   |
    Then the "claude-plugins.json" file of the project scope declares these plugins:
      | id            |
      | demo@fixtures |
      | app@tools     |
    Then the "claude-plugins.local.json" file of the project scope does not exist

  Scenario: Reinstalling a dependency within the version range its dependent declares names the range on its row
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib@^1.0.0   |
      | lib  | 1.0.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install app@tools --scope project"
    When the user runs "/claude:plugin reinstall lib@tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name | status      | reasons                 | scope   | version | cause chain                                                            | cause truncated | leaks | rollback partial |
      | tools            | project           | lib@tools | lib  | reinstalled | dependency current copy | project | 1.0.0   | constrained to the combined range (^1.0.0) -- required by "app@tools" | false           |       |                  |

  Scenario: Reinstalling every plugin of a marketplace whose manifest became invalid shows no manifest text as a cause
    Given the manifest of the marketplace "fixtures" has become invalid
    When the user runs "/claude:plugin reinstall @fixtures --scope project"
    Then the result has these fields:
      | kind           | cascade                        |
      | severity       | error                          |
      | needs reload   | false                          |
      | summary        | A plugin operation has failed. |
      | tally label    | Plugin reinstall               |
      | tally failures | 1                              |
      | tally warnings | 0                              |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status | reasons    | scope   | leaks | rollback partial |
      | fixtures         | project           | demo@fixtures | demo | failed | unreadable | project |       |                  |

  Scenario: Reinstalling a plugin whose installed skills were deleted restores them
    Given the user has deleted the installed skills of "demo@fixtures" in the project scope
    When the user runs "/claude:plugin reinstall demo@fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status      | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | reinstalled |         | project | 1.0.0   |
    When the user starts a new pi session
    Then the session offers these skills:
      | command           | description            |
      | /skill:demo-skill | A skill of demo 1.0.0. |

  Scenario: Reinstalling an installed plugin rebuilds it at the same version in the same scope
    When the user runs "/claude:plugin reinstall demo@fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status      | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | reinstalled |         | project | 1.0.0   |
    Then the installation record of the project scope holds these plugins:
      | id            | version | enabled |
      | demo@fixtures | 1.0.0   | true    |

  Scenario: A new session offers the skills of the reinstalled plugin
    Given the user has run "/claude:plugin reinstall demo@fixtures --scope project"
    When the user starts a new pi session
    Then the session offers these skills:
      | command           | description            |
      | /skill:demo-skill | A skill of demo 1.0.0. |

  Scenario: Uninstalling a reinstalled plugin removes it from the scope
    Given the user has run "/claude:plugin reinstall demo@fixtures --scope project"
    When the user runs "/claude:plugin uninstall demo@fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status      | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | uninstalled |         | project | 1.0.0   |
    Then the project scope has no installed plugins

  Scenario: The plugin list shows the reinstalled plugin at the same version
    Given the user has run "/claude:plugin reinstall demo@fixtures --scope project"
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

  Scenario: Deleting the installed skills of a plugin takes them out of a new session before any reinstall
    Given the user has deleted the installed skills of "demo@fixtures" in the project scope
    When the user starts a new pi session
    Then the session offers no skills

  Scenario: Reinstalling a plugin that is not installed fails as not installed and changes nothing
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
      | pp   | 1.0.0   |
    When the user runs "/claude:plugin reinstall pp@fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id          | name | status | reasons       | scope   | leaks | rollback partial |
      | fixtures         | project           | pp@fixtures | pp   | failed | not installed | project |       |                  |
    Then the installation record of the project scope holds these plugins:
      | id            | version | enabled |
      | demo@fixtures | 1.0.0   | true    |
    Then the project scope stages these skills and prompts:
      | kind  | name       |
      | skill | demo-skill |
    Then the "claude-plugins.json" file of the project scope declares these plugins:
      | id            |
      | demo@fixtures |
    Then the "claude-plugins.local.json" file of the project scope does not exist

  Scenario: Reinstalling a plugin whose marketplace now names a missing source directory fails as source missing and keeps it installed
    Given the marketplace "fixtures" publishes this manifest:
      """
      {
        "name": "fixtures",
        "owner": { "name": "features" },
        "plugins": [{ "name": "demo", "source": "./plugins/ghost", "version": "1.0.0" }]
      }
      """
    Given the user has run "/claude:plugin marketplace update fixtures --scope project"
    When the user runs "/claude:plugin reinstall demo@fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status | reasons        | scope   | version | leaks | rollback partial |
      | fixtures         | project           | demo@fixtures | demo | failed | source missing | project | 1.0.0   |       |                  |
    Then the installation record of the project scope holds these plugins:
      | id            | version | enabled |
      | demo@fixtures | 1.0.0   | true    |

  Scenario: Reinstalling a plugin the marketplace now offers at a newer version installs and records that version
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.1.0   |
    Given the user has run "/claude:plugin marketplace update fixtures --scope project"
    When the user runs "/claude:plugin reinstall demo@fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status      | reasons | scope   | from  | version |
      | fixtures         | project           | demo@fixtures | demo | reinstalled |         | project | 1.0.0 | 1.1.0   |
    Then the installation record of the project scope holds these plugins:
      | id            | version | enabled |
      | demo@fixtures | 1.1.0   | true    |

  Scenario: The plugin list shows a plugin reinstalled at a newer version at that version
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.1.0   |
    Given the user has run "/claude:plugin marketplace update fixtures --scope project"
    Given the user has run "/claude:plugin reinstall demo@fixtures --scope project"
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
      | fixtures         | project           | demo@fixtures | demo | installed |         | project | 1.1.0   |

  Scenario: Info on a plugin reinstalled at a newer version shows that version
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.1.0   |
    Given the user has run "/claude:plugin marketplace update fixtures --scope project"
    Given the user has run "/claude:plugin reinstall demo@fixtures --scope project"
    When the user runs "/claude:plugin info demo@fixtures"
    Then the result has these fields:
      | kind                           | plugin-info   |
      | severity                       | info          |
      | needs reload                   | false         |
      | marketplace name               | fixtures      |
      | marketplace scope              | project       |
      | marketplace details autoupdate | false         |
      | plugin id                      | demo@fixtures |
      | plugin name                    | demo          |
      | plugin status                  | installed     |
      | plugin reasons                 |               |
      | plugin scope                   | project       |
      | plugin version                 | 1.1.0         |
      | plugin components resolved     | true          |
      | plugin components skills       | demo-skill    |

  Scenario: A new session offers the skills of the version a reinstall installed
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.1.0   |
    Given the user has run "/claude:plugin marketplace update fixtures --scope project"
    Given the user has run "/claude:plugin reinstall demo@fixtures --scope project"
    When the user starts a new pi session
    Then the session offers these skills:
      | command           | description            |
      | /skill:demo-skill | A skill of demo 1.1.0. |

  Scenario: Reinstalling and updating after the same marketplace update record the same version
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.1.0   |
    Given the user has run "/claude:plugin marketplace update fixtures --scope project"
    Given the user has run "/claude:plugin marketplace update fixtures --scope user"
    When the user runs "/claude:plugin reinstall demo@fixtures --scope project"
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status      | reasons | scope   | from  | version |
      | fixtures         | project           | demo@fixtures | demo | reinstalled |         | project | 1.0.0 | 1.1.0   |
    When the user runs "/claude:plugin update demo@fixtures --scope user"
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status  | reasons | scope | from  | to    |
      | fixtures         | user              | demo@fixtures | demo | updated |         | user  | 1.0.0 | 1.1.0 |
    Then the installation record of the project scope holds these plugins:
      | id            | version | enabled |
      | demo@fixtures | 1.1.0   | true    |
    Then the installation record of the user scope holds these plugins:
      | id            | version | enabled |
      | demo@fixtures | 1.1.0   | true    |

  Scenario: Reinstalling a dependency within the version range of a plugin its marketplace no longer lists names that range on its row
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib@^1.0.0   |
      | lib  | 1.0.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install app@tools --scope project"
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | lib  | 1.0.0   |              |
    When the user runs "/claude:plugin reinstall lib@tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name | status      | reasons                 | scope   | version | cause chain                                                            | cause truncated | leaks | rollback partial |
      | tools            | project           | lib@tools | lib  | reinstalled | dependency current copy | project | 1.0.0   | constrained to the combined range (^1.0.0) -- required by "app@tools" | false           |       |                  |
    Then the installation record of the project scope holds these plugins:
      | id            | version | enabled |
      | app@tools     | 1.0.0   | true    |
      | demo@fixtures | 1.0.0   | true    |
      | lib@tools     | 1.0.0   | true    |
