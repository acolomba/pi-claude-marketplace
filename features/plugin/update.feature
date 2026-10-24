Feature: Plugin update

  Updating a plugin replaces the installed version with the one the marketplace offers now.
  The scenarios run the real extension in a headless Pi, read its JSON results,
  and use a local marketplace in place of a published one.

  Background:
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"

  Scenario: Updating a plugin reports the move from the installed version to the offered one
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.1.0   |
    When the user runs "/claude:plugin update demo@fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status  | reasons | scope   | from  | to    |
      | fixtures         | project           | demo@fixtures | demo | updated |         | project | 1.0.0 | 1.1.0 |

  Scenario: A new session offers the skills of the updated version
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.1.0   |
    Given the user has run "/claude:plugin update demo@fixtures --scope project"
    When the user starts a new pi session
    Then the session offers these skills:
      | command           | description            |
      | /skill:demo-skill | A skill of demo 1.1.0. |

  Scenario: The plugin list shows the updated version
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.1.0   |
    Given the user has run "/claude:plugin update demo@fixtures --scope project"
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

  Scenario: Updating a plugin that is up to date skips it as up to date
    When the user runs "/claude:plugin update demo@fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status  | reasons    | scope   |
      | fixtures         | project           | demo@fixtures | demo | skipped | up-to-date | project |

  Scenario: Updating a plugin that is not installed fails as not installed and changes nothing
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
      | pp   | 1.0.0   |
    When the user runs "/claude:plugin update pp@fixtures --scope project"
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
    Then the "claude-plugins.json" file of the project scope declares these plugins:
      | id            |
      | demo@fixtures |

  Scenario: Updating a plugin whose marketplace now names a missing source directory fails as source missing and keeps it installed
    Given the marketplace "fixtures" publishes this manifest:
      """
      {
        "name": "fixtures",
        "owner": { "name": "features" },
        "plugins": [{ "name": "demo", "source": "./plugins/ghost", "version": "1.0.0" }]
      }
      """
    Given the user has run "/claude:plugin marketplace update fixtures --scope project"
    When the user runs "/claude:plugin update demo@fixtures --scope project"
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

  Scenario: Updating with --local a plugin only the base layer declares fails as plugin in base layer only
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.1.0   |
    When the user runs "/claude:plugin update demo@fixtures --scope project --local"
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

  Scenario: Updating every plugin with --local updates only the plugins the local layer declares
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
      | pp   | 1.0.0   |
    Given the user has run "/claude:plugin install pp@fixtures --scope project --local"
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.1.0   |
      | pp   | 1.1.0   |
    When the user runs "/claude:plugin update --scope project --local"
    Then the result has these fields:
      | kind                | cascade       |
      | severity            | info          |
      | needs reload        | true          |
      | tally label         | Plugin update |
      | tally failures      | 0             |
      | tally warnings      | 0             |
      | tally success count | 1             |
      | tally success verb  | updated       |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id          | name | status  | reasons | scope   | from  | to    |
      | fixtures         | project           | pp@fixtures | pp   | updated |         | project | 1.0.0 | 1.1.0 |
    Then the "claude-plugins.json" file of the project scope declares these plugins:
      | id            |
      | demo@fixtures |
    When the user starts a new pi session
    Then the session offers these skills:
      | command           | description            |
      | /skill:demo-skill | A skill of demo 1.0.0. |
      | /skill:pp-skill   | A skill of pp 1.1.0.   |

  Scenario: Updating every plugin with --local also updates the dependencies the local plugins need
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
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.1.0   | lib          |
      | lib  | 1.1.0   |              |
      | svc  | 1.1.0   | core         |
      | core | 1.1.0   |              |
    When the user runs "/claude:plugin update --scope project --local"
    Then the result has these fields:
      | kind                | cascade       |
      | severity            | info          |
      | needs reload        | true          |
      | tally label         | Plugin update |
      | tally failures      | 0             |
      | tally warnings      | 0             |
      | tally success count | 2             |
      | tally success verb  | updated       |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name | status  | reasons | scope   | from  | to    |
      | tools            | project           | lib@tools | lib  | updated |         | project | 1.0.0 | 1.1.0 |
      | tools            | project           | app@tools | app  | updated |         | project | 1.0.0 | 1.1.0 |

  Scenario: Updating every plugin with --local fails and updates nothing when the dependencies of a local plugin cannot be read
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
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.1.0   |
      | pp   | 1.1.0   |
    Given the manifest of the marketplace "tools" has become invalid
    When the user runs "/claude:plugin update --scope project --local"
    Then the result has these fields:
      | kind           | cascade                        |
      | severity       | error                          |
      | needs reload   | false                          |
      | summary        | A plugin operation has failed. |
      | tally label    | Plugin update                  |
      | tally failures | 1                              |
      | tally warnings | 0                              |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id                | name     | status | reasons    | scope   | cause chain                                                                    | cause truncated | leaks | rollback partial |
      | (update)         | project           | (update)@(update) | (update) | failed | unreadable | project | cannot read the dependencies of app@tools: its marketplace manifest is invalid | false           |       |                  |
    When the user starts a new pi session
    Then the session reports these results:
      | kind                      | severity | needs reload | summary                             | tally label | tally failures | tally warnings |
      | reconcile-applied-cascade | warning  | false        | A plugin operation needs attention. | Reconcile   | 0              | 1              |
      | reconcile-applied-cascade | warning  | false        | A plugin operation needs attention. | Reconcile   | 0              | 1              |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id        | name | status | reasons          | scope   | leaks | rollback partial | cause chain                                                                    | cause truncated |
      | tools            | project           | lib@tools | lib  | failed | invalid manifest | project |       |                  | cannot read the dependencies of lib@tools: its marketplace manifest is invalid | false           |
      | tools            | project           | lib@tools | lib  | failed | invalid manifest | project |       |                  | cannot read the dependencies of lib@tools: its marketplace manifest is invalid | false           |
    Then the session offers these skills:
      | command           | description            |
      | /skill:app-skill  | A skill of app 1.0.0.  |
      | /skill:demo-skill | A skill of demo 1.0.0. |
      | /skill:lib-skill  | A skill of lib 1.0.0.  |
      | /skill:pp-skill   | A skill of pp 1.0.0.   |

  Scenario: Updating every plugin updates the plugins of both layers and declares none of their dependencies
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
    Given the user has run "/claude:plugin install app@tools --scope project"
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.1.0   |
      | pp   | 1.1.0   |
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.1.0   | lib          |
      | lib  | 1.1.0   |              |
    When the user runs "/claude:plugin update --scope project"
    Then the result has these fields:
      | kind                | cascade       |
      | severity            | info          |
      | needs reload        | true          |
      | tally label         | Plugin update |
      | tally failures      | 0             |
      | tally warnings      | 0             |
      | tally success count | 4             |
      | tally success verb  | updated       |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status  | reasons | scope   | from  | to    |
      | fixtures         | project           | demo@fixtures | demo | updated |         | project | 1.0.0 | 1.1.0 |
      | fixtures         | project           | pp@fixtures   | pp   | updated |         | project | 1.0.0 | 1.1.0 |
      | tools            | project           | lib@tools     | lib  | updated |         | project | 1.0.0 | 1.1.0 |
      | tools            | project           | app@tools     | app  | updated |         | project | 1.0.0 | 1.1.0 |
    Then the "claude-plugins.json" file of the project scope declares these plugins:
      | id            |
      | demo@fixtures |
      | app@tools     |
    Then the "claude-plugins.local.json" file of the project scope declares these plugins:
      | id          |
      | pp@fixtures |

  Scenario: Updating the plugins of one marketplace updates each outdated plugin of that marketplace only
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
      | pp   | 1.0.0   |
    Given the user has run "/claude:plugin install pp@fixtures --scope project"
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | app  | 1.0.0   |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install app@tools --scope project"
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.1.0   |
      | pp   | 1.1.0   |
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | app  | 1.1.0   |
    When the user runs "/claude:plugin update @fixtures --scope project"
    Then the result has these fields:
      | kind                | cascade       |
      | severity            | info          |
      | needs reload        | true          |
      | tally label         | Plugin update |
      | tally failures      | 0             |
      | tally warnings      | 0             |
      | tally success count | 2             |
      | tally success verb  | updated       |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status  | reasons | scope   | from  | to    |
      | fixtures         | project           | demo@fixtures | demo | updated |         | project | 1.0.0 | 1.1.0 |
      | fixtures         | project           | pp@fixtures   | pp   | updated |         | project | 1.0.0 | 1.1.0 |
    Then the installation record of the project scope holds these plugins:
      | id            | version | enabled |
      | app@tools     | 1.0.0   | true    |
      | demo@fixtures | 1.1.0   | true    |
      | pp@fixtures   | 1.1.0   | true    |

  Scenario: Updating a dependency within the version range its dependent declares updates it
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib@^1.0.0   |
      | lib  | 1.0.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install app@tools --scope project"
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib@^1.0.0   |
      | lib  | 1.1.0   |              |
    When the user runs "/claude:plugin update lib@tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name | status  | reasons                 | scope   | from  | to    |
      | tools            | project           | lib@tools | lib  | updated | dependency current copy | project | 1.0.0 | 1.1.0 |
    Then the installation record of the project scope holds these plugins:
      | id            | version | enabled |
      | app@tools     | 1.0.0   | true    |
      | demo@fixtures | 1.0.0   | true    |
      | lib@tools     | 1.1.0   | true    |

  Scenario: Updating a dependency past the version range its dependent declares holds the update and changes nothing
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib@^1.0.0   |
      | lib  | 1.0.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install app@tools --scope project"
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib@^1.0.0   |
      | lib  | 2.0.0   |              |
    When the user runs "/claude:plugin update lib@tools --scope project"
    Then the result has these fields:
      | kind         | cascade                             |
      | severity     | warning                             |
      | needs reload | false                               |
      | summary      | A plugin operation needs attention. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name | status  | reasons              | scope   | version | cause chain                                                                                              | cause truncated | leaks | rollback partial |
      | tools            | project           | lib@tools | lib  | skipped | dependents constrain | project | 1.0.0   | version 2.0.0 falls outside what the combined range admits (^1.0.0) -- required by "app@tools" | false           |       |                  |
    Then the installation record of the project scope holds these plugins:
      | id            | version | enabled |
      | app@tools     | 1.0.0   | true    |
      | demo@fixtures | 1.0.0   | true    |
      | lib@tools     | 1.0.0   | true    |
    When the user starts a new pi session
    Then the session offers these skills:
      | command           | description            |
      | /skill:app-skill  | A skill of app 1.0.0.  |
      | /skill:demo-skill | A skill of demo 1.0.0. |
      | /skill:lib-skill  | A skill of lib 1.0.0.  |

  Scenario: Updating a plugin whose new version is only partially available is held without --partial and keeps the installed version
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.1.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has an output style
    When the user runs "/claude:plugin update demo@fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade                             |
      | severity     | warning                             |
      | needs reload | false                               |
      | summary      | A plugin operation needs attention. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status               | reasons               | hint           | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | partially-upgradable | unsupported component | partial-update | project | 1.0.0   |
    Then the installation record of the project scope holds these plugins:
      | id            | version | enabled |
      | demo@fixtures | 1.0.0   | true    |
    When the user starts a new pi session
    Then the session offers these skills:
      | command           | description            |
      | /skill:demo-skill | A skill of demo 1.0.0. |

  Scenario: Updating with --partial a plugin whose new version is only partially available installs the parts Pi supports
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.1.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has an output style
    When the user runs "/claude:plugin update demo@fixtures --scope project --partial"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status              | reasons               | scope   | from  | version |
      | fixtures         | project           | demo@fixtures | demo | partially-installed | unsupported component | project | 1.0.0 | 1.1.0   |
    Then the installation record of the project scope holds these plugins:
      | id            | version | enabled |
      | demo@fixtures | 1.1.0   | true    |
    When the user starts a new pi session
    Then the session offers these skills:
      | command           | description            |
      | /skill:demo-skill | A skill of demo 1.1.0. |

  Scenario: Info on a plugin updated with --partial shows it partially installed with an unsupported component
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.1.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has an output style
    Given the user has run "/claude:plugin update demo@fixtures --scope project --partial"
    When the user runs "/claude:plugin info demo@fixtures"
    Then the result has these fields:
      | kind                           | plugin-info           |
      | severity                       | info                  |
      | needs reload                   | false                 |
      | marketplace name               | fixtures              |
      | marketplace scope              | project               |
      | marketplace details autoupdate | false                 |
      | plugin id                      | demo@fixtures         |
      | plugin name                    | demo                  |
      | plugin status                  | partially-installed   |
      | plugin reasons                 | unsupported component |
      | plugin scope                   | project               |
      | plugin version                 | 1.1.0                 |
      | plugin components resolved     | true                  |
      | plugin components skills       | demo-skill            |

  Scenario: The plugin list shows a plugin updated with --partial as partially installed
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.1.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has an output style
    Given the user has run "/claude:plugin update demo@fixtures --scope project --partial"
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
      | marketplace name | marketplace scope | id            | name | status              | reasons               | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | partially-installed | unsupported component | project | 1.1.0   |
