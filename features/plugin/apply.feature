Feature: Plugin apply

  Apply makes the changes that pending lists, so a scope matches the configs a
  user edits by hand. The scenarios run the real extension in a headless Pi and
  use a local marketplace in place of a published one.

  Background:
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name  | version |
      | demo  | 1.0.0   |
      | alpha | 1.0.0   |
      | beta  | 1.0.0   |
      | gamma | 1.0.0   |

  Scenario: Apply reports the rollback phases and leaks of a failed enable
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has run "/claude:plugin disable demo@fixtures --scope project"
    Given the published plugin "demo" of the marketplace "fixtures" has a read-only skill directory
    Given a directory blocks the mcp-adapter.json file of the project scope
    Given a config in scope project and layer base, with these plugins:
      | marketplace | plugin | enabled |
      | fixtures    | demo   | true    |
    When the user runs "/claude:plugin apply --scope project"
    Then the result has these fields:
      | kind                | reconcile-applied-cascade      |
      | severity            | error                          |
      | needs reload        | false                          |
      | summary             | A plugin operation has failed. |
      | tally label         | Reconcile                      |
      | tally failures      | 1                              |
      | tally warnings      | 0                              |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status | reasons          | scope   | cause chain                                               | cause truncated | leaks      | rollback partial                                                                                       |
      | fixtures         | project           | demo@fixtures | demo | failed | rollback partial | project | {mcp-adapter.json read error}, {mcp-adapter.json read error} | false           | demo-skill | [{"phase":"skills","cause":{"causeChain":["{read-only skill directory removal error}"],"truncated":false}}] |
    Then the installation record of the project scope holds these plugins:
      | id            | version | enabled |
      | demo@fixtures | 1.0.0   | false   |

  Scenario: Apply installs a plugin that a config declares by hand and reports it
    Given the marketplace "fixtures" is added to the project scope
    Given a config in scope project and layer base, with these plugins:
      | marketplace | plugin | enabled |
      | fixtures    | demo   |         |
    When the user runs "/claude:plugin apply --scope project"
    Then the result has these fields:
      | kind                | reconcile-applied-cascade |
      | severity            | info                      |
      | needs reload        | true                      |
      | tally label         | Reconcile                 |
      | tally failures      | 0                         |
      | tally warnings      | 0                         |
      | tally success count | 1                         |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | installed |         | project | 1.0.0   |
    Then the installation record of the project scope holds these plugins:
      | id            | version | enabled |
      | demo@fixtures | 1.0.0   | true    |
    When the user starts a new pi session
    Then the session offers these skills:
      | command           | description            |
      | /skill:demo-skill | A skill of demo 1.0.0. |

  Scenario: Apply adds a marketplace that a config declares by hand and installs its plugin
    Given a config in scope project and layer base, with these marketplaces:
      | name     | source                       | autoupdate |
      | fixtures | {home}/marketplaces/fixtures |            |
    Given a config in scope project and layer base, with these plugins:
      | marketplace | plugin | enabled |
      | fixtures    | demo   |         |
    When the user runs "/claude:plugin apply --scope project"
    Then the result has these fields:
      | kind                | reconcile-applied-cascade |
      | severity            | info                      |
      | needs reload        | true                      |
      | tally label         | Reconcile                 |
      | tally failures      | 0                         |
      | tally warnings      | 0                         |
      | tally success count | 2                         |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | marketplace status | id            | name | status    | reasons | scope   | version |
      | fixtures         | project           | added              | demo@fixtures | demo | installed |         | project | 1.0.0   |
    When the user starts a new pi session
    Then the session offers these skills:
      | command           | description            |
      | /skill:demo-skill | A skill of demo 1.0.0. |

  Scenario: Apply replaces a marketplace whose declared source changed
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" is added to the project scope
    Given a second marketplace declaring the name "tools" is ready to add from "replacement"
    Given a config in scope project and layer local, with these marketplaces:
      | name  | source                           | autoupdate |
      | tools | {home}/marketplaces/replacement |            |
    When the user runs "/claude:plugin apply --scope project"
    Then the result has these fields:
      | kind                | reconcile-applied-cascade |
      | severity            | info                      |
      | needs reload        | false                     |
      | tally label         | Reconcile                 |
      | tally failures      | 0                         |
      | tally warnings      | 0                         |
      | tally success count | 1                         |
    Then the result lists these marketplaces:
      | name  | scope   | status |
      | tools | project | added  |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name  | source                     |
      | tools | {home}/marketplaces/tools |
    Then the "claude-plugins.local.json" file of the project scope declares these marketplaces:
      | name  | source                           |
      | tools | {home}/marketplaces/replacement |
    When the user runs "/claude:plugin apply --scope project"
    Then the result has these fields:
      | kind         | reconcile-pending-empty |
      | severity     | info                    |
      | needs reload | false                   |

  Scenario: Apply downloads a replacement marketplace once
    Given the marketplace "tools" is published as a hosted source
    Given a second marketplace declaring the name "tools" is ready to add from "original"
    Given the user has run "/claude:plugin marketplace add {home}/marketplaces/original --scope project"
    Given a config in scope project and layer local, with these marketplaces:
      | name  | source                                      | autoupdate |
      | tools | https://{git host}/acme/tools/marketplace.json |            |
    When the user runs "/claude:plugin apply --scope project"
    Then the result has these fields:
      | kind                | reconcile-applied-cascade |
      | severity            | info                     |
      | needs reload        | false                    |
      | tally label         | Reconcile                |
      | tally failures      | 0                        |
      | tally warnings      | 0                        |
      | tally success count | 1                        |
    Then the result lists these marketplaces:
      | name  | scope   | status |
      | tools | project | added  |
    Then the git host receives these requests:
      | method | path                         | status |
      | GET    | /acme/tools/marketplace.json | 200    |

  Scenario: The official fallback source is already up to date
    Given the marketplace "claude-plugins-official" is published as a dir source
    Given an earlier version recorded the marketplace "claude-plugins-official" in the project scope
    Given a config in scope project and layer base, with these marketplaces:
      | name                    | source                               | autoupdate |
      | claude-plugins-official | anthropics/claude-plugins-official |            |
    When the user runs "/claude:plugin apply --scope project"
    Then the result has these fields:
      | kind         | reconcile-pending-empty |
      | severity     | info                    |
      | needs reload | false                   |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name                    | source                               |
      | claude-plugins-official | anthropics/claude-plugins-official |

  Scenario: Apply uninstalls a plugin removed from a config by hand and keeps the others
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has run "/claude:plugin install alpha@fixtures --scope project"
    Given a config in scope project and layer base, with these plugins:
      | marketplace | plugin | enabled |
      | fixtures    | alpha  |         |
    When the user runs "/claude:plugin apply --scope project"
    Then the result has these fields:
      | kind                | reconcile-applied-cascade |
      | severity            | info                      |
      | needs reload        | true                      |
      | tally label         | Reconcile                 |
      | tally failures      | 0                         |
      | tally warnings      | 0                         |
      | tally success count | 1                         |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status      | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | uninstalled |         | project | 1.0.0   |
    When the user starts a new pi session
    Then the session offers these skills:
      | command            | description             |
      | /skill:alpha-skill | A skill of alpha 1.0.0. |

  Scenario: Apply disables a plugin set to disabled in a config by hand
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given a config in scope project and layer base, with these plugins:
      | marketplace | plugin | enabled |
      | fixtures    | demo   | false   |
    When the user runs "/claude:plugin apply --scope project"
    Then the result has these fields:
      | kind                | reconcile-applied-cascade |
      | severity            | info                      |
      | needs reload        | true                      |
      | tally label         | Reconcile                 |
      | tally failures      | 0                         |
      | tally warnings      | 0                         |
      | tally success count | 1                         |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status   | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | disabled |         | project | 1.0.0   |
    When the user starts a new pi session
    Then the session offers no skills

  Scenario: Apply enables a plugin set to enabled in a config by hand
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has run "/claude:plugin disable demo@fixtures --scope project"
    Given a config in scope project and layer base, with these plugins:
      | marketplace | plugin | enabled |
      | fixtures    | demo   | true    |
    When the user runs "/claude:plugin apply --scope project"
    Then the result has these fields:
      | kind                | reconcile-applied-cascade |
      | severity            | info                      |
      | needs reload        | true                      |
      | tally label         | Reconcile                 |
      | tally failures      | 0                         |
      | tally warnings      | 0                         |
      | tally success count | 1                         |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | installed |         | project | 1.0.0   |
    When the user starts a new pi session
    Then the session offers these skills:
      | command           | description            |
      | /skill:demo-skill | A skill of demo 1.0.0. |

  Scenario: Apply that cannot install one hand-declared plugin still makes every other hand edit
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install alpha@fixtures --scope project"
    Given the user has run "/claude:plugin install beta@fixtures --scope project"
    Given a config in scope project and layer base, with these plugins:
      | marketplace | plugin | enabled |
      | fixtures    | ghost  |         |
      | fixtures    | demo   |         |
      | fixtures    | beta   | false   |
    When the user runs "/claude:plugin apply --scope project"
    Then the result has these fields:
      | kind                | reconcile-applied-cascade      |
      | severity            | error                          |
      | needs reload        | true                           |
      | summary             | A plugin operation has failed. |
      | tally label         | Reconcile                      |
      | tally failures      | 1                              |
      | tally warnings      | 0                              |
      | tally success count | 3                              |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id             | name  | status    | reasons         | scope   | version | leaks | rollback partial |
      | fixtures         | project           | alpha@fixtures | alpha | uninstalled |                 | project | 1.0.0   |       |                  |
      | fixtures         | project           | ghost@fixtures | ghost | failed    | not in manifest | project |         |       |                  |
      | fixtures         | project           | demo@fixtures  | demo  | installed |                 | project | 1.0.0   |       |                  |
      | fixtures         | project           | beta@fixtures  | beta  | disabled  |                 | project | 1.0.0   |       |                  |
    When the user starts a new pi session
    Then the session reports these results:
      | kind    | severity | needs reload | needs apply | tally label       | tally failures | tally warnings | tally success count |
      | cascade | info     | false        | true        | Reconcile pending | 0              | 0              | 1                   |
      | cascade | info     | false        | true        | Reconcile pending | 0              | 0              | 1                   |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id             | name  | status       | reasons | scope   |
      | fixtures         | project           | ghost@fixtures | ghost | will install |         | project |
      | fixtures         | project           | ghost@fixtures | ghost | will install |         | project |
    Then the session offers these skills:
      | command           | description            |
      | /skill:demo-skill | A skill of demo 1.0.0. |

  Scenario: Apply that cannot finish the rollback of a failed install names the rollback phase
    Given the marketplace "fixtures" is added to the project scope
    Given a config in scope project and layer base, with these plugins:
      | marketplace | plugin | enabled |
      | fixtures    | demo   |         |
    Given the published plugin "demo" of the marketplace "fixtures" has a read-only skill directory
    Given a directory blocks the mcp-adapter.json file of the project scope
    When the user runs "/claude:plugin apply --scope project"
    Then the result has these fields:
      | kind           | reconcile-applied-cascade      |
      | severity       | error                          |
      | needs reload   | false                          |
      | summary        | A plugin operation has failed. |
      | tally label    | Reconcile                      |
      | tally failures | 1                              |
      | tally warnings | 0                              |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status | reasons          | scope   | cause chain                                                  | cause truncated | leaks      | rollback partial                                                                                            |
      | fixtures         | project           | demo@fixtures | demo | failed | rollback partial | project | {mcp-adapter.json read error}, {mcp-adapter.json read error} | false           | demo-skill | [{"phase":"skills","cause":{"causeChain":["{read-only skill directory removal error}"],"truncated":false}}] |

  Scenario: Apply that cannot finish the rollback of a failed dependency reports the dependency's own row
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib          |
      | lib  | 1.0.0   |              |
    Given the published plugin "lib" of the marketplace "tools" has a read-only skill directory
    Given the marketplace "tools" is added to the project scope
    Given a config in scope project and layer base, with these plugins:
      | marketplace | plugin | enabled |
      | tools       | app    |         |
    Given a directory blocks the mcp-adapter.json file of the project scope
    When the user runs "/claude:plugin apply --scope project"
    Then the result has these fields:
      | kind           | reconcile-applied-cascade           |
      | severity       | error                               |
      | needs reload   | false                               |
      | summary        | Some plugin operations have failed. |
      | tally label    | Reconcile                           |
      | tally failures | 2                                   |
      | tally warnings | 0                                   |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name | status | reasons           | scope   | cause chain                                                  | cause truncated | leaks     | rollback partial                                                                                            |
      | tools            | project           | app@tools | app  | failed | dependency failed | project |                                                              |                 |           |                                                                                                             |
      | tools            | project           | lib@tools | lib  | failed | rollback partial  | project | {mcp-adapter.json read error}, {mcp-adapter.json read error} | false           | lib-skill | [{"phase":"skills","cause":{"causeChain":["{read-only skill directory removal error}"],"truncated":false}}] |

  Scenario: Apply that cannot finish the rollback of a dependency two plugins share reports that dependency once
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name   | version | dependencies |
      | server | 1.0.0   | lib          |
      | web    | 1.0.0   | lib          |
      | lib    | 1.0.0   |              |
    Given the published plugin "lib" of the marketplace "tools" has a read-only skill directory
    Given the marketplace "tools" is added to the project scope
    Given a config in scope project and layer base, with these plugins:
      | marketplace | plugin | enabled |
      | tools       | server |         |
      | tools       | web    |         |
    Given a directory blocks the mcp-adapter.json file of the project scope
    When the user runs "/claude:plugin apply --scope project"
    Then the result has these fields:
      | kind           | reconcile-applied-cascade           |
      | severity       | error                               |
      | needs reload   | false                               |
      | summary        | Some plugin operations have failed. |
      | tally label    | Reconcile                           |
      | tally failures | 3                                   |
      | tally warnings | 0                                   |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id           | name   | status | reasons           | scope   | cause chain                                                  | cause truncated | leaks     | rollback partial                                                                                            |
      | tools            | project           | lib@tools    | lib    | failed | rollback partial  | project | {mcp-adapter.json read error}, {mcp-adapter.json read error} | false           | lib-skill | [{"phase":"skills","cause":{"causeChain":["{read-only skill directory removal error}"],"truncated":false}}] |
      | tools            | project           | server@tools | server | failed | dependency failed | project |                                                              |                 |           |                                                                                                             |
      | tools            | project           | web@tools    | web    | failed | dependency failed | project |                                                              |                 |           |                                                                                                             |

  Scenario: Apply shows the phase detail of a partially rolled back missing dependency
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   |              |
      | lib  | 1.0.0   | bar          |
      | bar  | 1.0.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install app@tools --scope project"
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib          |
      | lib  | 1.0.0   | bar          |
      | bar  | 1.0.0   |              |
    Given the published plugin "bar" of the marketplace "tools" has a read-only skill directory
    Given a directory blocks the mcp-adapter.json file of the project scope
    When the user runs "/claude:plugin apply --scope project"
    Then the result has these fields:
      | kind           | reconcile-applied-cascade           |
      | severity       | error                               |
      | needs reload   | false                               |
      | summary        | Some plugin operations have failed. |
      | tally label    | Reconcile                           |
      | tally failures | 3                                   |
      | tally warnings | 0                                   |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name | status | reasons           | scope   | cause chain                                                  | cause truncated | leaks     | rollback partial                                                                                            |
      | tools            | project           | bar@tools | bar  | failed | rollback partial  | project | {mcp-adapter.json read error}, {mcp-adapter.json read error} | false           | bar-skill | [{"phase":"skills","cause":{"causeChain":["{read-only skill directory removal error}"],"truncated":false}}] |
      | tools            | project           | lib@tools | lib  | failed | dependency failed | project |                                                              |                 |           |                                                                                                             |
      | tools            | project           | app@tools | app  | failed | unreadable         | project |                                                              |                 |           |                                                                                                             |

  Scenario: Apply that an invalid GitHub base address stops reports the install it made before stopping
    Given pi runs with the github base address "http://example.invalid"
    Given the git repository "ghp" holds these plugins:
      | name | version | path |
      | ghp  | 1.0.0   |      |
    Given the marketplace "fixtures" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | ghp  | github      | ghp        | false  |
    Given the marketplace "fixtures" is added to the project scope
    Given a config in scope project and layer base, with these plugins:
      | marketplace | plugin | enabled |
      | fixtures    | demo   |         |
      | fixtures    | ghp    |         |
    When the user runs "/claude:plugin apply --scope project"
    Then the command reports these results:
      | kind                      | severity | needs reload | summary                      | cause chain                                                       | cause truncated | tally label | tally failures | tally warnings | tally success count |
      | reconcile-applied-cascade | info     | true         |                              |                                                                   |                 | Reconcile   | 0              | 0              | 1                   |
      | internal-error            | error    | true         | Command failed unexpectedly. | PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL must use the https scheme. | false           |             |                |                |                     |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | installed |         | project | 1.0.0   |
    Then the installation record of the project scope holds these plugins:
      | id            | version | enabled |
      | demo@fixtures | 1.0.0   | true    |

  Scenario: Apply that an invalid GitHub base address stops keeps a plugin enabled whose missing dependency it installed first
    Given pi runs with the github base address "http://example.invalid"
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name   | version | dependencies |
      | app    | 1.0.0   |              |
      | audit  | 1.0.0   |              |
      | avault | 1.0.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install app@tools --scope project"
    Given the user has run "/claude:plugin install audit@tools --scope project"
    Given the git repository "zvault" holds these plugins:
      | name   | version | path |
      | zvault | 1.0.0   |      |
    Given the marketplace "tools" offers these plugins with dependencies:
      | name   | version | dependencies |
      | app    | 1.0.0   | avault       |
      | audit  | 1.0.0   | zvault       |
      | avault | 1.0.0   |              |
    Given the marketplace "tools" offers these plugins from git repositories:
      | name   | source kind | repository | pinned |
      | zvault | github      | zvault     | false  |
    When the user runs "/claude:plugin apply --scope project"
    Then the command reports these results:
      | kind                      | severity | needs reload | summary                             | cause chain                                                       | cause truncated | tally label | tally failures | tally warnings | tally success count |
      | reconcile-applied-cascade | warning  | true         | A plugin operation needs attention. |                                                                   |                 | Reconcile   | 0              | 1              | 1                   |
      | internal-error            | error    | true         | Command failed unexpectedly.        | PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL must use the https scheme. | false           |             |                |                |                     |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id           | name   | status    | reasons                | scope   | version | cause chain                                       | cause truncated | leaks | rollback partial |
      | tools            | project           | avault@tools | avault | installed | dependency installed   | project | 1.0.0   |                                                   |                 |       |                  |
      | tools            | project           | audit@tools  | audit  | disabled  | dependency unsatisfied | project | 1.0.0   | Install "zvault@tools" or uninstall "audit@tools" | false           |       |                  |
    Then the installation record of the project scope holds these plugins:
      | id           | version | enabled |
      | app@tools    | 1.0.0   | true    |
      | audit@tools  | 1.0.0   | false   |
      | avault@tools | 1.0.0   | true    |

  Scenario: Apply disables a plugin whose marketplace now declares a newer version of its dependency
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib          |
      | lib  | 1.0.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install app@tools --scope project"
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib@^2.0.0   |
      | lib  | 1.0.0   |              |
    When the user runs "/claude:plugin apply --scope project"
    Then the result has these fields:
      | kind           | reconcile-applied-cascade           |
      | severity       | warning                             |
      | needs reload   | true                                |
      | summary        | A plugin operation needs attention. |
      | tally label    | Reconcile                           |
      | tally failures | 0                                   |
      | tally warnings | 1                                   |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name | status   | reasons                        | scope   | version | cause chain                                                    | cause truncated | leaks | rollback partial |
      | tools            | project           | app@tools | app  | disabled | dependency version unsatisfied | project | 1.0.0   | Update "lib@tools" to satisfy ^2.0.0, or uninstall "app@tools" | false           |       |                  |
    When the user starts a new pi session
    Then the session offers these skills:
      | command          | description           |
      | /skill:lib-skill | A skill of lib 1.0.0. |

  Scenario: Apply moves a plugin and the newer dependency it needs, shipped together, in one run
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name   | version | dependencies |
      | widget | 1.0.0   | zcore        |
      | zcore  | 1.0.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install widget@tools --scope project"
    Given the marketplace "tools" offers these plugins with dependencies:
      | name   | version | dependencies |
      | widget | 1.1.0   | zcore@^2.0.0 |
      | zcore  | 2.0.0   |              |
    When the user runs "/claude:plugin apply --scope project"
    Then the result has these fields:
      | kind                | reconcile-applied-cascade |
      | severity            | info                      |
      | needs reload        | true                      |
      | tally label         | Reconcile                 |
      | tally failures      | 0                         |
      | tally warnings      | 0                         |
      | tally success count | 2                         |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id           | name   | status  | reasons | scope   | from  | to    |
      | tools            | project           | zcore@tools  | zcore  | updated |         | project | 1.0.0 | 2.0.0 |
      | tools            | project           | widget@tools | widget | updated |         | project | 1.0.0 | 1.1.0 |
    Then the installation record of the project scope holds these plugins:
      | id           | version | enabled |
      | widget@tools | 1.1.0   | true    |
      | zcore@tools  | 2.0.0   | true    |
    When the user runs "/claude:plugin pending --scope project"
    Then the result has these fields:
      | kind         | reconcile-pending-empty |
      | severity     | info                    |
      | needs reload | false                   |

  Scenario: Apply preserves dependency move warnings and MCP notices
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib          |
      | lib  | 1.0.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install app@tools --scope project"
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib          |
      | lib  | 2.0.0   |              |
    Given the published plugin "lib" of the marketplace "tools" has a second skill whose name collides with its first
    Given the published plugin "lib" of the marketplace "tools" declares the mcp server "lib-server"
    Given the mcp-adapter.json file of the project scope holds a comment
    When the user runs "/claude:plugin apply --scope project"
    Then the command reports these results:
      | kind                      | severity | needs reload | tally label | tally failures | tally warnings | tally success count | header                                                          | lines                                                                                                                                  | notices                                                                   |
      | reconcile-applied-cascade | info     | true         | Reconcile   | 0              | 0              | 1                   |                                                                 |                                                                                                                                        |                                                                           |
      | diagnostic                | warning  | false        |             |                |                |                     | Plugin "lib" [project] updated; 1 declared component has a note. | skill source "skill" in "skills" elides to generated name "lib-skill", already produced by skill source "lib-skill"; ignoring duplicate. |                                                                           |
      | mcp-config-notices        | warning  | false        |             |                |                |                     |                                                                 |                                                                                                                                        | [{"kind":"comments-dropped","scope":"project","file":"mcp-adapter.json"}] |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id        | name | status  | reasons                 | scope   | from  | to    |
      | tools            | project           | lib@tools | lib  | updated | requires pi-mcp-adapter | project | 1.0.0 | 2.0.0 |

  Scenario: Apply keeps a plugin and its dependency at their versions, the plugin disabled, when the dependency's move fails, and the next apply does the same
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name   | version | dependencies |
      | widget | 1.0.0   | zcore        |
      | zcore  | 1.0.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install widget@tools --scope project"
    Given the marketplace "tools" offers these plugins with dependencies:
      | name   | version | dependencies |
      | widget | 1.1.0   | zcore@^2.0.0 |
      | zcore  | 2.0.0   |              |
    Given the published plugin "zcore" of the marketplace "tools" has an unreadable skill file
    Given the user has run "/claude:plugin apply --scope project", which failed
    When the user runs "/claude:plugin apply --scope project"
    Then the result has these fields:
      | kind           | reconcile-applied-cascade      |
      | severity       | error                          |
      | needs reload   | false                          |
      | summary        | A plugin operation has failed. |
      | tally label    | Reconcile                      |
      | tally failures | 1                              |
      | tally warnings | 0                              |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id          | name  | status | reasons           | scope   | from  | version | leaks | rollback partial |
      | tools            | project           | zcore@tools | zcore | failed | permission denied | project | 1.0.0 | 2.0.0   |       |                  |
    Then the installation record of the project scope holds these plugins:
      | id           | version | enabled |
      | widget@tools | 1.0.0   | false   |
      | zcore@tools  | 1.0.0   | true    |

  Scenario: Apply disables a plugin whose move fails after its dependency moved
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name   | version | dependencies |
      | widget | 1.0.0   | zcore@^1.0.0 |
      | zcore  | 1.0.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install widget@tools --scope project"
    Given the marketplace "tools" offers these plugins with dependencies:
      | name   | version | dependencies |
      | widget | 1.1.0   | zcore@^2.0.0 |
      | zcore  | 2.0.0   |              |
    Given the published plugin "widget" of the marketplace "tools" has an unreadable skill file
    When the user runs "/claude:plugin apply --scope project"
    Then the result has these fields:
      | kind           | reconcile-applied-cascade      |
      | severity       | error                          |
      | needs reload   | true                           |
      | summary        | A plugin operation has failed. |
      | tally label    | Reconcile                      |
      | tally failures      | 1                              |
      | tally warnings      | 1                              |
      | tally success count | 1                              |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id           | name   | status   | reasons                        | scope   | from  | to    | version | cause chain                                      | cause truncated | leaks | rollback partial |
      | tools            | project           | zcore@tools  | zcore  | updated  |                                | project | 1.0.0 | 2.0.0 |         |                                                  |                 |       |                  |
      | tools            | project           | widget@tools | widget | failed   | permission denied              | project | 1.0.0 |       | 1.1.0   |                                                  |                 |       |                  |
      | tools            | project           | widget@tools | widget | disabled | dependency version unsatisfied | project |       |       | 1.0.0   | The update of "widget@tools" did not install; run apply again once it can, or uninstall "widget@tools" | false           |       |                  |
    Then the installation record of the project scope holds these plugins:
      | id           | version | enabled |
      | widget@tools | 1.0.0   | false   |
      | zcore@tools  | 2.0.0   | true    |

  Scenario: Apply keeps a plugin disabled after its failed move while the move still fails
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name   | version | dependencies |
      | widget | 1.0.0   | zcore@^1.0.0 |
      | zcore  | 1.0.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install widget@tools --scope project"
    Given the marketplace "tools" offers these plugins with dependencies:
      | name   | version | dependencies |
      | widget | 1.1.0   | zcore@^2.0.0 |
      | zcore  | 2.0.0   |              |
    Given the published plugin "widget" of the marketplace "tools" has an unreadable skill file
    Given the user has run "/claude:plugin apply --scope project", which failed
    When the user runs "/claude:plugin apply --scope project"
    Then the result has these fields:
      | kind           | reconcile-applied-cascade      |
      | severity       | error                          |
      | needs reload   | false                          |
      | summary        | A plugin operation has failed. |
      | tally label    | Reconcile                      |
      | tally failures | 1                              |
      | tally warnings | 0                              |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id           | name   | status | reasons    | scope   | from  | version | leaks | rollback partial |
      | tools            | project           | widget@tools | widget | failed | unreadable | project | 1.0.0 | 1.1.0   |       |                  |
    Then the installation record of the project scope holds these plugins:
      | id           | version | enabled |
      | widget@tools | 1.0.0   | false   |
      | zcore@tools  | 2.0.0   | true    |

  Scenario: Apply enables a plugin disabled after its failed move once the move lands
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name   | version | dependencies |
      | widget | 1.0.0   | zcore@^1.0.0 |
      | zcore  | 1.0.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install widget@tools --scope project"
    Given the marketplace "tools" offers these plugins with dependencies:
      | name   | version | dependencies |
      | widget | 1.1.0   | zcore@^2.0.0 |
      | zcore  | 2.0.0   |              |
    Given the published plugin "widget" of the marketplace "tools" has an unreadable skill file
    Given the user has run "/claude:plugin apply --scope project", which failed
    Given the unreadable skill file of the published plugin "widget" of the marketplace "tools" can be read again
    When the user runs "/claude:plugin apply --scope project"
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id           | name   | status  | reasons | scope   | from  | to    |
      | tools            | project           | widget@tools | widget | updated |         | project | 1.0.0 | 1.1.0 |
    Then the installation record of the project scope holds these plugins:
      | id           | version | enabled |
      | widget@tools | 1.1.0   | true    |
      | zcore@tools  | 2.0.0   | true    |

  Scenario: Apply enables a plugin held down for its dependency's version once a marketplace update ships that version
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name   | version | dependencies |
      | widget | 1.0.0   | zcore        |
      | zcore  | 1.0.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install widget@tools --scope project"
    Given the marketplace "tools" offers these plugins with dependencies:
      | name   | version | dependencies |
      | widget | 1.1.0   | zcore@^2.0.0 |
      | zcore  | 1.0.0   |              |
    Given the user has run "/claude:plugin apply --scope project", which warned
    Given the marketplace "tools" offers these plugins with dependencies:
      | name   | version | dependencies |
      | widget | 1.1.0   | zcore@^2.0.0 |
      | zcore  | 2.0.0   |              |
    When the user runs "/claude:plugin apply --scope project"
    Then the result has these fields:
      | kind                | reconcile-applied-cascade |
      | severity            | info                      |
      | needs reload        | true                      |
      | tally label         | Reconcile                 |
      | tally failures      | 0                         |
      | tally warnings      | 0                         |
      | tally success count | 2                         |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id           | name   | status  | reasons | scope   | from  | to    |
      | tools            | project           | zcore@tools  | zcore  | updated |         | project | 1.0.0 | 2.0.0 |
      | tools            | project           | widget@tools | widget | updated |         | project | 1.0.0 | 1.1.0 |
    Then the installation record of the project scope holds these plugins:
      | id           | version | enabled |
      | widget@tools | 1.1.0   | true    |
      | zcore@tools  | 2.0.0   | true    |

  Scenario: Apply disables a plugin whose own move a dependent holds when the dependency it needs fails to move, and the dependent with it
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name   | version | dependencies   |
      | host   | 1.0.0   | widget@^1.0.0  |
      | widget | 1.0.0   | zcore          |
      | zcore  | 1.0.0   |                |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install host@tools --scope project"
    Given the marketplace "tools" offers these plugins with dependencies:
      | name   | version | dependencies   |
      | host   | 1.0.0   | widget@^1.0.0  |
      | widget | 2.0.0   | zcore@^2.0.0   |
      | zcore  | 2.0.0   |                |
    Given the published plugin "zcore" of the marketplace "tools" has an unreadable skill file
    When the user runs "/claude:plugin apply --scope project"
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id           | name   | status   | reasons                | scope   | from  | version | cause chain                                                                            | cause truncated | leaks | rollback partial |
      | tools            | project           | zcore@tools  | zcore  | failed   | permission denied      | project | 1.0.0 | 2.0.0   |                                                                                        |                 |       |                  |
      | tools            | project           | widget@tools | widget | disabled | dependency failed      | project |       | 1.0.0   | "zcore@tools" did not update; run apply again once it can, or uninstall "widget@tools" | false           |       |                  |
      | tools            | project           | host@tools   | host   | disabled | dependency unsatisfied | project |       | 1.0.0   | Enable "widget@tools" or uninstall "host@tools"                                        | false           |       |                  |
    Then the installation record of the project scope holds these plugins:
      | id           | version | enabled |
      | host@tools   | 1.0.0   | false   |
      | widget@tools | 1.0.0   | false   |
      | zcore@tools  | 1.0.0   | true    |

  Scenario: Apply disables every plugin above a dependency whose move fails in the middle of a chain
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib          |
      | lib  | 1.0.0   | core         |
      | core | 1.0.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install app@tools --scope project"
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 2.0.0   | lib@^2.0.0   |
      | lib  | 2.0.0   | core@^2.0.0  |
      | core | 2.0.0   |              |
    Given the published plugin "lib" of the marketplace "tools" has an unreadable skill file
    When the user runs "/claude:plugin apply --scope project"
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id         | name | status   | reasons                        | scope   | from  | to    | version | cause chain                                                                                       | cause truncated | leaks | rollback partial |
      | tools            | project           | core@tools | core | updated  |                                | project | 1.0.0 | 2.0.0 |         |                                                                                                   |                 |       |                  |
      | tools            | project           | lib@tools  | lib  | failed   | permission denied              | project | 1.0.0 |       | 2.0.0   |                                                                                                   |                 |       |                  |
      | tools            | project           | lib@tools  | lib  | disabled | dependency version unsatisfied | project |       |       | 1.0.0   | The update of "lib@tools" did not install; run apply again once it can, or uninstall "lib@tools" | false           |       |                  |
      | tools            | project           | app@tools  | app  | disabled | dependency failed              | project |       |       | 1.0.0   | "lib@tools" did not update; run apply again once it can, or uninstall "app@tools"                 | false           |       |                  |
    Then the installation record of the project scope holds these plugins:
      | id         | version | enabled |
      | app@tools  | 1.0.0   | false   |
      | core@tools | 2.0.0   | true    |
      | lib@tools  | 1.0.0   | false   |

  Scenario: Apply keeps the plugins above a dependency whose enable keeps failing disabled, and does not move them
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib          |
      | lib  | 1.0.0   | core         |
      | core | 1.0.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install app@tools --scope project"
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 2.0.0   | lib@^2.0.0   |
      | lib  | 2.0.0   | core@^2.0.0  |
      | core | 2.0.0   |              |
    Given the published plugin "lib" of the marketplace "tools" has an unreadable skill file
    Given the user has run "/claude:plugin apply --scope project", which failed
    When the user runs "/claude:plugin apply --scope project"
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name | status | reasons    | scope   | from  | version | leaks | rollback partial |
      | tools            | project           | lib@tools | lib  | failed | unreadable | project | 1.0.0 | 2.0.0   |       |                  |
    Then the installation record of the project scope holds these plugins:
      | id         | version | enabled |
      | app@tools  | 1.0.0   | false   |
      | core@tools | 2.0.0   | true    |
      | lib@tools  | 1.0.0   | false   |

  Scenario: Apply keeps a held-down plugin and the held-down plugin above it disabled while the move they wait on fails
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib          |
      | lib  | 1.0.0   | core         |
      | core | 1.0.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install app@tools --scope project"
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib          |
      | lib  | 1.0.0   | core@^2.0.0  |
      | core | 1.0.0   |              |
    Given the user has run "/claude:plugin apply --scope project", which warned
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib          |
      | lib  | 1.0.0   | core@^2.0.0  |
      | core | 2.0.0   |              |
    Given the published plugin "core" of the marketplace "tools" has an unreadable skill file
    When the user runs "/claude:plugin apply --scope project"
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id         | name | status | reasons           | scope   | from  | version | leaks | rollback partial |
      | tools            | project           | core@tools | core | failed | permission denied | project | 1.0.0 | 2.0.0   |       |                  |
    Then the installation record of the project scope holds these plugins:
      | id         | version | enabled |
      | app@tools  | 1.0.0   | false   |
      | core@tools | 1.0.0   | true    |
      | lib@tools  | 1.0.0   | false   |

  Scenario: Apply keeps a plugin disabled when the enable of the dependency a config turns back on fails
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib          |
      | lib  | 1.0.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install app@tools --scope project"
    Given a config in scope project and layer base, with these plugins:
      | marketplace | plugin | enabled |
      | tools       | app    |         |
      | tools       | lib    | false   |
    Given the user has run "/claude:plugin apply --scope project", which warned
    Given a config in scope project and layer base, with these plugins:
      | marketplace | plugin | enabled |
      | tools       | app    |         |
      | tools       | lib    |         |
    Given the published plugin "lib" of the marketplace "tools" has an unreadable skill file
    When the user runs "/claude:plugin apply --scope project"
    Then the result has these fields:
      | kind           | reconcile-applied-cascade      |
      | severity       | error                          |
      | needs reload   | false                          |
      | summary        | A plugin operation has failed. |
      | tally label    | Reconcile                      |
      | tally failures | 1                              |
      | tally warnings | 0                              |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name | status | reasons    | scope   | leaks | rollback partial |
      | tools            | project           | lib@tools | lib  | failed | unreadable | project |       |                  |
    Then the installation record of the project scope holds these plugins:
      | id        | version | enabled |
      | app@tools | 1.0.0   | false   |
      | lib@tools | 1.0.0   | false   |

  Scenario: Apply keeps a plugin a config enables disabled while the held-down dependency it needs cannot be enabled
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib          |
      | lib  | 1.0.0   | core         |
      | core | 1.0.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install app@tools --scope project"
    Given a config in scope project and layer base, with these plugins:
      | marketplace | plugin | enabled |
      | tools       | app    | false   |
      | tools       | lib    |         |
      | tools       | core   |         |
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib          |
      | lib  | 1.0.0   | core@^2.0.0  |
      | core | 1.0.0   |              |
    Given the user has run "/claude:plugin apply --scope project", which warned
    Given a config in scope project and layer base, with these plugins:
      | marketplace | plugin | enabled |
      | tools       | app    |         |
      | tools       | lib    |         |
      | tools       | core   |         |
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib          |
      | lib  | 1.0.0   | core@^2.0.0  |
      | core | 2.0.0   |              |
    Given the published plugin "lib" of the marketplace "tools" has an unreadable skill file
    When the user runs "/claude:plugin apply --scope project"
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id         | name | status  | reasons    | scope   | from  | to    | leaks | rollback partial |
      | tools            | project           | core@tools | core | updated |            | project | 1.0.0 | 2.0.0 |       |                  |
      | tools            | project           | lib@tools  | lib  | failed  | unreadable | project |       |       |       |                  |
    Then the installation record of the project scope holds these plugins:
      | id         | version | enabled |
      | app@tools  | 1.0.0   | false   |
      | core@tools | 2.0.0   | true    |
      | lib@tools  | 1.0.0   | false   |

  Scenario: Apply reports only the failing move once the plugins that wait on it are held down
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name   | version | dependencies  |
      | host   | 1.0.0   | widget@^1.0.0 |
      | widget | 1.0.0   | zcore         |
      | zcore  | 1.0.0   |               |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install host@tools --scope project"
    Given the marketplace "tools" offers these plugins with dependencies:
      | name   | version | dependencies  |
      | host   | 1.0.0   | widget@^1.0.0 |
      | widget | 2.0.0   | zcore@^2.0.0  |
      | zcore  | 2.0.0   |               |
    Given the published plugin "zcore" of the marketplace "tools" has an unreadable skill file
    Given the user has run "/claude:plugin apply --scope project", which failed
    Given the user has run "/claude:plugin apply --scope project", which failed
    When the user runs "/claude:plugin apply --scope project"
    Then the result has these fields:
      | kind           | reconcile-applied-cascade      |
      | severity       | error                          |
      | needs reload   | false                          |
      | summary        | A plugin operation has failed. |
      | tally label    | Reconcile                      |
      | tally failures | 1                              |
      | tally warnings | 0                              |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id          | name  | status | reasons           | scope   | from  | version | leaks | rollback partial |
      | tools            | project           | zcore@tools | zcore | failed | permission denied | project | 1.0.0 | 2.0.0   |       |                  |
    Then the installation record of the project scope holds these plugins:
      | id           | version | enabled |
      | host@tools   | 1.0.0   | false   |
      | widget@tools | 1.0.0   | false   |
      | zcore@tools  | 1.0.0   | true    |

  Scenario: Apply keeps the version of a held-down plugin whose enable fails after its move
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name   | version | dependencies |
      | widget | 1.0.0   | zcore        |
      | zcore  | 1.0.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install widget@tools --scope project"
    Given the marketplace "tools" offers these plugins with dependencies:
      | name   | version | dependencies |
      | widget | 1.1.0   | zcore@^2.0.0 |
      | zcore  | 1.0.0   |              |
    Given the user has run "/claude:plugin apply --scope project", which warned
    Given the marketplace "tools" offers these plugins with dependencies:
      | name   | version | dependencies |
      | widget | 1.1.0   | zcore@^2.0.0 |
      | zcore  | 2.0.0   |              |
    Given the published plugin "widget" of the marketplace "tools" has an unreadable skill file
    When the user runs "/claude:plugin apply --scope project"
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id           | name   | status  | reasons    | scope   | from  | to    | version | leaks | rollback partial |
      | tools            | project           | zcore@tools  | zcore  | updated |            | project | 1.0.0 | 2.0.0 |         |       |                  |
      | tools            | project           | widget@tools | widget | failed  | unreadable | project | 1.0.0 |       | 1.1.0   |       |                  |
    Then the installation record of the project scope holds these plugins:
      | id           | version | enabled |
      | widget@tools | 1.0.0   | false   |
      | zcore@tools  | 2.0.0   | true    |

  Scenario: Apply and pending leave a held-down plugin alone while the dependency it needs is disabled by a config
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib          |
      | lib  | 1.0.0   | core         |
      | core | 1.0.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install app@tools --scope project"
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib          |
      | lib  | 1.0.0   | core@^2.0.0  |
      | core | 1.0.0   |              |
    Given the user has run "/claude:plugin apply --scope project", which warned
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib          |
      | lib  | 1.0.0   | core         |
      | core | 1.0.0   |              |
    Given a config in scope project and layer base, with these plugins:
      | marketplace | plugin | enabled |
      | tools       | app    |         |
      | tools       | lib    | false   |
      | tools       | core   |         |
    When the user runs "/claude:plugin pending --scope project"
    Then the result has these fields:
      | kind         | reconcile-pending-empty |
      | severity     | info                    |
      | needs reload | false                   |
    When the user runs "/claude:plugin apply --scope project"
    Then the result has these fields:
      | kind         | reconcile-pending-empty |
      | severity     | info                    |
      | needs reload | false                   |
    Then the installation record of the project scope holds these plugins:
      | id         | version | enabled |
      | app@tools  | 1.0.0   | false   |
      | core@tools | 1.0.0   | true    |
      | lib@tools  | 1.0.0   | false   |

  Scenario: Apply and pending leave a plugin a config enables alone while the dependency it needs is disabled by a config
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib          |
      | lib  | 1.0.0   | core         |
      | core | 1.0.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install app@tools --scope project"
    Given a config in scope project and layer base, with these plugins:
      | marketplace | plugin | enabled |
      | tools       | app    | false   |
      | tools       | lib    |         |
      | tools       | core   |         |
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib          |
      | lib  | 1.0.0   | core@^2.0.0  |
      | core | 1.0.0   |              |
    Given the user has run "/claude:plugin apply --scope project", which warned
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib          |
      | lib  | 1.0.0   | core         |
      | core | 1.0.0   |              |
    Given a config in scope project and layer base, with these plugins:
      | marketplace | plugin | enabled |
      | tools       | app    |         |
      | tools       | lib    | false   |
      | tools       | core   |         |
    When the user runs "/claude:plugin pending --scope project"
    Then the result has these fields:
      | kind         | reconcile-pending-empty |
      | severity     | info                    |
      | needs reload | false                   |
    When the user runs "/claude:plugin apply --scope project"
    Then the result has these fields:
      | kind         | reconcile-pending-empty |
      | severity     | info                    |
      | needs reload | false                   |
    Then the installation record of the project scope holds these plugins:
      | id         | version | enabled |
      | app@tools  | 1.0.0   | false   |
      | core@tools | 1.0.0   | true    |
      | lib@tools  | 1.0.0   | false   |

  Scenario: Apply disables a plugin whose dependency a config drops in the same run, as pending lists it
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name   | version | dependencies |
      | keeper | 1.0.0   | orphan       |
      | orphan | 1.0.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given a config in scope project and layer base, with these plugins:
      | marketplace | plugin | enabled |
      | tools       | keeper |         |
      | tools       | orphan |         |
    Given the user has run "/claude:plugin apply --scope project"
    Given a config in scope project and layer base, with these plugins:
      | marketplace | plugin | enabled |
      | tools       | keeper |         |
    When the user runs "/claude:plugin pending --scope project"
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name   | status         | reasons | scope   | version |
      | tools            | project           | orphan@tools  | orphan | will uninstall |         | project | 1.0.0   |
      | tools            | project           | keeper@tools  | keeper | will disable   |         | project |         |
    When the user runs "/claude:plugin apply --scope project"
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name   | status      | reasons                | scope   | version | cause chain                                        | cause truncated | leaks | rollback partial |
      | tools            | project           | orphan@tools  | orphan | uninstalled |                        | project | 1.0.0   |                                                    |                 |       |                  |
      | tools            | project           | keeper@tools  | keeper | disabled    | dependency unsatisfied | project | 1.0.0   | Install "orphan@tools" or uninstall "keeper@tools" | false           |       |                  |
    Then the installation record of the project scope holds these plugins:
      | id           | version | enabled |
      | keeper@tools | 1.0.0   | false   |

  Scenario: Apply moves a chain of three plugins, each needing the next one's new version, in one run
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib          |
      | lib  | 1.0.0   | core         |
      | core | 1.0.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install app@tools --scope project"
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 2.0.0   | lib@^2.0.0   |
      | lib  | 2.0.0   | core@^2.0.0  |
      | core | 2.0.0   |              |
    When the user runs "/claude:plugin apply --scope project"
    Then the result has these fields:
      | kind                | reconcile-applied-cascade |
      | severity            | info                      |
      | needs reload        | true                      |
      | tally label         | Reconcile                 |
      | tally failures      | 0                         |
      | tally warnings      | 0                         |
      | tally success count | 3                         |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name | status  | reasons | scope   | from  | to    |
      | tools            | project           | core@tools | core | updated |         | project | 1.0.0 | 2.0.0 |
      | tools            | project           | lib@tools  | lib  | updated |         | project | 1.0.0 | 2.0.0 |
      | tools            | project           | app@tools  | app  | updated |         | project | 1.0.0 | 2.0.0 |
    Then the installation record of the project scope holds these plugins:
      | id         | version | enabled |
      | app@tools  | 2.0.0   | true    |
      | core@tools | 2.0.0   | true    |
      | lib@tools  | 2.0.0   | true    |

  Scenario: Apply disables a plugin together with the dependency that a config disables by hand, after which pending lists nothing
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib          |
      | lib  | 1.0.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install app@tools --scope project"
    Given a config in scope project and layer base, with these plugins:
      | marketplace | plugin | enabled |
      | tools       | app    |         |
      | tools       | lib    | false   |
    When the user runs "/claude:plugin apply --scope project"
    Then the result has these fields:
      | kind                | reconcile-applied-cascade           |
      | severity            | warning                             |
      | needs reload        | true                                |
      | summary             | A plugin operation needs attention. |
      | tally label         | Reconcile                           |
      | tally failures      | 0                                   |
      | tally warnings      | 1                                   |
      | tally success count | 1                                   |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name | status   | reasons                | scope   | version | cause chain                                 | cause truncated | leaks | rollback partial |
      | tools            | project           | lib@tools | lib  | disabled |                        | project | 1.0.0   |                                             |                 |       |                  |
      | tools            | project           | app@tools | app  | disabled | dependency unsatisfied | project | 1.0.0   | Enable "lib@tools" or uninstall "app@tools" | false           |       |                  |
    When the user runs "/claude:plugin pending --scope project"
    Then the result has these fields:
      | kind         | reconcile-pending-empty |
      | severity     | info                    |
      | needs reload | false                   |

  Scenario: Apply reports a hand-declared plugin pi supports only in part with the reason install gives
    Given the published plugin "demo" of the marketplace "fixtures" has an output style
    Given the marketplace "fixtures" is added to the project scope
    Given a config in scope project and layer base, with these plugins:
      | marketplace | plugin | enabled |
      | fixtures    | demo   |         |
    When the user runs "/claude:plugin apply --scope project"
    Then the result has these fields:
      | kind           | reconcile-applied-cascade      |
      | severity       | error                          |
      | needs reload   | false                          |
      | summary        | A plugin operation has failed. |
      | tally label    | Reconcile                      |
      | tally failures | 1                              |
      | tally warnings | 0                              |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status | reasons               | scope   | leaks | rollback partial |
      | fixtures         | project           | demo@fixtures | demo | failed | unsupported component | project |       |                  |
    Then the project scope has no installed plugins

  Scenario: Apply removes a marketplace the base config no longer declares and uninstalls its plugins
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has run "/claude:plugin install alpha@fixtures --scope project"
    Given a config in scope project and layer base, with this text:
      """
      {}
      """
    When the user runs "/claude:plugin apply --scope project"
    Then the result has these fields:
      | kind                | reconcile-applied-cascade |
      | severity            | info                      |
      | needs reload        | true                      |
      | tally label         | Reconcile                 |
      | tally failures      | 0                         |
      | tally warnings      | 0                         |
      | tally success count | 3                         |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace status | id             | name  | status      | reasons | scope   |
      | fixtures         | project           | removed            | demo@fixtures  | demo  | uninstalled |         | project |
      | fixtures         | project           | removed            | alpha@fixtures | alpha | uninstalled |         | project |
    Then the project scope has no installed plugins

  Scenario: Apply makes every change one hand edit of the base config causes, after which pending lists nothing
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has run "/claude:plugin install beta@fixtures --scope project"
    Given the user has run "/claude:plugin install gamma@fixtures --scope project"
    Given the user has run "/claude:plugin disable gamma@fixtures --scope project"
    Given a config in scope project and layer base, with these plugins:
      | marketplace | plugin | enabled |
      | fixtures    | alpha  |         |
      | fixtures    | beta   | false   |
      | fixtures    | gamma  | true    |
    When the user runs "/claude:plugin apply --scope project"
    Then the result has these fields:
      | kind                | reconcile-applied-cascade |
      | severity            | info                      |
      | needs reload        | true                      |
      | tally label         | Reconcile                 |
      | tally failures      | 0                         |
      | tally warnings      | 0                         |
      | tally success count | 4                         |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id             | name  | status      | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures  | demo  | uninstalled |         | project | 1.0.0   |
      | fixtures         | project           | alpha@fixtures | alpha | installed   |         | project | 1.0.0   |
      | fixtures         | project           | gamma@fixtures | gamma | installed   |         | project | 1.0.0   |
      | fixtures         | project           | beta@fixtures  | beta  | disabled    |         | project | 1.0.0   |
    When the user runs "/claude:plugin pending --scope project"
    Then the result has these fields:
      | kind         | reconcile-pending-empty |
      | severity     | info                    |
      | needs reload | false                   |

  Scenario: Apply with nothing to change reports so and changes nothing
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the config and installation record bytes of the project scope are remembered
    When the user runs "/claude:plugin apply --scope project"
    Then the result has these fields:
      | kind         | reconcile-pending-empty |
      | severity     | info                    |
      | needs reload | false                   |
    Then the installation record of the project scope holds these plugins:
      | id            | version | enabled |
      | demo@fixtures | 1.0.0   | true    |
    Then the config and installation record bytes of the project scope are unchanged

  Scenario: Apply moves a path-source plugin to the version its marketplace now offers
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.1.0   |
    When the user runs "/claude:plugin apply --scope project"
    Then the result has these fields:
      | kind                | reconcile-applied-cascade |
      | severity            | info                      |
      | needs reload        | true                      |
      | tally label         | Reconcile                 |
      | tally failures      | 0                         |
      | tally warnings      | 0                         |
      | tally success count | 1                         |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status  | reasons | scope   | from  | to    |
      | fixtures         | project           | demo@fixtures | demo | updated |         | project | 1.0.0 | 1.1.0 |
    Then the installation record of the project scope holds these plugins:
      | id            | version | enabled |
      | demo@fixtures | 1.1.0   | true    |
    When the user runs "/claude:plugin pending --scope project"
    Then the result has these fields:
      | kind         | reconcile-pending-empty |
      | severity     | info                    |
      | needs reload | false                   |

  Scenario: Apply makes a partially installed plugin whole when its new version needs no unsupported component
    Given the published plugin "demo" of the marketplace "fixtures" has an output style
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project --partial"
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.1.0   |
    Given the published plugin "demo" of the marketplace "fixtures" no longer has an output style
    When the user runs "/claude:plugin pending --scope project"
    Then the result has these fields:
      | kind                | cascade           |
      | severity            | info              |
      | needs reload        | false             |
      | needs apply         | true              |
      | tally label         | Reconcile pending |
      | tally failures      | 0                 |
      | tally warnings      | 0                 |
      | tally success count | 1                 |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status      | reasons | scope   | from  | to    |
      | fixtures         | project           | demo@fixtures | demo | will update |         | project | 1.0.0 | 1.1.0 |
    When the user runs "/claude:plugin apply --scope project"
    Then the result has these fields:
      | kind                | reconcile-applied-cascade |
      | severity            | info                      |
      | needs reload        | true                      |
      | tally label         | Reconcile                 |
      | tally failures      | 0                         |
      | tally warnings      | 0                         |
      | tally success count | 1                         |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status  | reasons | scope   | from  | to    |
      | fixtures         | project           | demo@fixtures | demo | updated |         | project | 1.0.0 | 1.1.0 |
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

  Scenario: Apply reads the landed git revision after a dependency move
    Given the git repository "ghp" holds these plugins:
      | name | version | path |
      | ghp  | 1.0.0   |      |
    Given the marketplace "fixtures" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | ghp          |
    Given the marketplace "fixtures" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | ghp  | github      | ghp        | true   |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install app@fixtures --scope project"
    Given the git repository "ghp" holds these plugins:
      | name | version | path |
      | ghp  | 2.0.0   |      |
    Given the marketplace "fixtures" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.1.0   | ghp          |
    Given the marketplace "fixtures" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | ghp  | github      | ghp        | true   |
    Given the user has run "/claude:plugin marketplace update fixtures --scope project"
    When the user runs "/claude:plugin apply --scope project"
    Then the result has these fields:
      | kind                | reconcile-applied-cascade |
      | severity            | info                      |
      | needs reload        | true                      |
      | tally label         | Reconcile                 |
      | tally failures      | 0                         |
      | tally warnings      | 0                         |
      | tally success count | 2                         |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status  | reasons | scope   | from  | to    |
      | fixtures         | project           | ghp@fixtures  | ghp  | updated |         | project | 1.0.0 | 2.0.0 |
      | fixtures         | project           | app@fixtures  | app  | updated |         | project | 1.0.0 | 1.1.0 |
    Then the installation record of the project scope holds these plugins:
      | id            | version | enabled |
      | app@fixtures  | 1.1.0   | true    |
      | ghp@fixtures  | 2.0.0   | true    |
    Then the git-source plugin "ghp" installed in the project scope runs revision 2 of its repository

  Scenario: Apply keeps a range-blocked and a consent-needing move in place with warning rows, and pending still lists them
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib@^1.0.0   |
      | lib  | 1.0.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install app@tools --scope project"
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib@^1.0.0   |
      | lib  | 2.0.0   |              |
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.1.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has an output style
    When the user runs "/claude:plugin apply --scope project"
    Then the result has these fields:
      | kind           | reconcile-applied-cascade              |
      | severity       | warning                                |
      | needs reload   | false                                  |
      | summary        | Some plugin operations need attention. |
      | tally label    | Reconcile                              |
      | tally failures | 0                                      |
      | tally warnings | 2                                      |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status               | reasons               | hint                   | scope   | version | cause chain                                                                                    | cause truncated | leaks | rollback partial |
      | fixtures         | project           | demo@fixtures | demo | partially-upgradable | unsupported component | catalog-partial-update | project | 1.0.0   |                                                                                                |                 |       |                  |
      | tools            | project           | lib@tools     | lib  | skipped              | dependents constrain  |                        | project | 1.0.0   | version 2.0.0 falls outside what the combined range admits (^1.0.0) -- required by "app@tools" | false           |       |                  |
    Then the installation record of the project scope holds these plugins:
      | id            | version | enabled |
      | app@tools     | 1.0.0   | true    |
      | demo@fixtures | 1.0.0   | true    |
      | lib@tools     | 1.0.0   | true    |
    When the user runs "/claude:plugin pending --scope project"
    Then the result has these fields:
      | kind           | cascade                                |
      | severity       | warning                                |
      | needs reload   | false                                  |
      | summary        | Some plugin operations need attention. |
      | tally label    | Reconcile pending                      |
      | tally failures | 0                                      |
      | tally warnings | 2                                      |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status               | reasons               | hint                   | scope   | version | cause chain                                                                                    | cause truncated | leaks | rollback partial |
      | fixtures         | project           | demo@fixtures | demo | partially-upgradable | unsupported component | catalog-partial-update | project | 1.0.0   |                                                                                                |                 |       |                  |
      | tools            | project           | lib@tools     | lib  | skipped              | dependents constrain  |                        | project | 1.0.0   | version 2.0.0 falls outside what the combined range admits (^1.0.0) -- required by "app@tools" | false           |       |                  |

  Scenario: Apply installs a plugin whose installed dependency must move first and reports the move pending listed
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | lib  | 1.2.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install lib@tools --scope project"
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib@^2.0.0   |
      | lib  | 2.0.0   |              |
    Given a config in scope project and layer base, with these plugins:
      | marketplace | plugin | enabled |
      | tools       | app    |         |
      | tools       | lib    |         |
    When the user runs "/claude:plugin pending --scope project"
    Then the result has these fields:
      | kind                | cascade           |
      | severity            | info              |
      | needs reload        | false             |
      | needs apply         | true              |
      | tally label         | Reconcile pending |
      | tally failures      | 0                 |
      | tally warnings      | 0                 |
      | tally success count | 2                 |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name | status       | reasons | scope   | from  | to    |
      | tools            | project           | app@tools | app  | will install |         | project |       |       |
      | tools            | project           | lib@tools | lib  | will update  |         | project | 1.2.0 | 2.0.0 |
    When the user runs "/claude:plugin apply --scope project"
    Then the result has these fields:
      | kind                | reconcile-applied-cascade |
      | severity            | info                      |
      | needs reload        | true                      |
      | tally label         | Reconcile                 |
      | tally failures      | 0                         |
      | tally warnings      | 0                         |
      | tally success count | 2                         |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name | status    | reasons | scope   | version | from  | to    | cause chain                                                            | cause truncated | leaks | rollback partial |
      | tools            | project           | lib@tools | lib  | updated   |         | project |         | 1.2.0 | 2.0.0 | constrained to the combined range (^2.0.0) -- required by "app@tools" | false           |       |                  |
      | tools            | project           | app@tools | app  | installed |         | project | 1.0.0   |       |       |                                                                        |                 |       |                  |
    Then the installation record of the project scope holds these plugins:
      | id        | version | enabled |
      | app@tools | 1.0.0   | true    |
      | lib@tools | 2.0.0   | true    |

  Scenario: Apply moves a plugin whose new version needs a plugin a config declares, after it installs that plugin
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name   | version | dependencies |
      | widget | 1.0.0   |              |
      | zcore  | 1.0.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install widget@tools --scope project"
    Given the marketplace "tools" offers these plugins with dependencies:
      | name   | version | dependencies |
      | widget | 1.1.0   | zcore        |
      | zcore  | 1.0.0   |              |
    Given a config in scope project and layer base, with these plugins:
      | marketplace | plugin | enabled |
      | tools       | widget | true    |
      | tools       | zcore  |         |
    When the user runs "/claude:plugin apply --scope project"
    Then the result has these fields:
      | kind                | reconcile-applied-cascade |
      | severity            | info                      |
      | needs reload        | true                      |
      | tally label         | Reconcile                 |
      | tally failures      | 0                         |
      | tally warnings      | 0                         |
      | tally success count | 2                         |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id           | name   | status    | reasons | scope   | version | from  | to    |
      | tools            | project           | zcore@tools  | zcore  | installed |         | project | 1.0.0   |       |       |
      | tools            | project           | widget@tools | widget | updated   |         | project |         | 1.0.0 | 1.1.0 |
    Then the installation record of the project scope holds these plugins:
      | id           | version | enabled |
      | widget@tools | 1.1.0   | true    |
      | zcore@tools  | 1.0.0   | true    |
    When the user runs "/claude:plugin pending --scope project"
    Then the result has these fields:
      | kind         | reconcile-pending-empty |
      | severity     | info                    |
      | needs reload | false                   |

  Scenario: Apply installs a missing dependency that needs the version the same apply moves to, as pending lists it
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name   | version | dependencies |
      | widget | 1.0.0   |              |
      | ycore  | 1.0.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install widget@tools --scope project"
    Given the user has run "/claude:plugin install ycore@tools --scope project"
    Given the marketplace "tools" offers these plugins with dependencies:
      | name   | version | dependencies |
      | widget | 1.1.0   | newdep       |
      | newdep | 1.0.0   | ycore@^2.0.0 |
      | ycore  | 2.0.0   |              |
    When the user runs "/claude:plugin pending --scope project"
    Then the result has these fields:
      | kind                | cascade           |
      | severity            | info              |
      | needs reload        | false             |
      | needs apply         | true              |
      | tally label         | Reconcile pending |
      | tally failures      | 0                 |
      | tally warnings      | 0                 |
      | tally success count | 3                 |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id           | name   | status       | reasons | scope   | from  | to    |
      | tools            | project           | widget@tools | widget | will update  |         | project | 1.0.0 | 1.1.0 |
      | tools            | project           | ycore@tools  | ycore  | will update  |         | project | 1.0.0 | 2.0.0 |
      | tools            | project           | newdep@tools | newdep | will install |         | project |       |       |
    When the user runs "/claude:plugin apply --scope project"
    Then the result has these fields:
      | kind                | reconcile-applied-cascade |
      | severity            | info                      |
      | needs reload        | true                      |
      | tally label         | Reconcile                 |
      | tally failures      | 0                         |
      | tally warnings      | 0                         |
      | tally success count | 3                         |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id           | name   | status    | reasons              | scope   | version | from  | to    |
      | tools            | project           | widget@tools | widget | updated   |                      | project |         | 1.0.0 | 1.1.0 |
      | tools            | project           | ycore@tools  | ycore  | updated   |                      | project |         | 1.0.0 | 2.0.0 |
      | tools            | project           | newdep@tools | newdep | installed | dependency installed | project | 1.0.0   |       |       |
    Then the installation record of the project scope holds these plugins:
      | id           | version | enabled |
      | newdep@tools | 1.0.0   | true    |
      | widget@tools | 1.1.0   | true    |
      | ycore@tools  | 2.0.0   | true    |
    When the user runs "/claude:plugin pending --scope project"
    Then the result has these fields:
      | kind         | reconcile-pending-empty |
      | severity     | info                    |
      | needs reload | false                   |

  Scenario: Apply moves a plugin whose moved dependency needs a missing plugin, as pending lists it
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name   | version | dependencies |
      | widget | 1.0.0   | zcore        |
      | zcore  | 1.0.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install widget@tools --scope project"
    Given the marketplace "tools" offers these plugins with dependencies:
      | name   | version | dependencies |
      | widget | 1.1.0   | zcore@^2.0.0 |
      | zcore  | 2.0.0   | extra        |
      | extra  | 1.0.0   |              |
    When the user runs "/claude:plugin pending --scope project"
    Then the result has these fields:
      | kind                | cascade           |
      | severity            | info              |
      | needs reload        | false             |
      | needs apply         | true              |
      | tally label         | Reconcile pending |
      | tally failures      | 0                 |
      | tally warnings      | 0                 |
      | tally success count | 3                 |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id           | name   | status       | reasons | scope   | from  | to    |
      | tools            | project           | zcore@tools  | zcore  | will update  |         | project | 1.0.0 | 2.0.0 |
      | tools            | project           | widget@tools | widget | will update  |         | project | 1.0.0 | 1.1.0 |
      | tools            | project           | extra@tools  | extra  | will install |         | project |       |       |
    When the user runs "/claude:plugin apply --scope project"
    Then the result has these fields:
      | kind                | reconcile-applied-cascade |
      | severity            | info                      |
      | needs reload        | true                      |
      | tally label         | Reconcile                 |
      | tally failures      | 0                         |
      | tally warnings      | 0                         |
      | tally success count | 3                         |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id           | name   | status    | reasons              | scope   | version | from  | to    |
      | tools            | project           | zcore@tools  | zcore  | updated   |                      | project |         | 1.0.0 | 2.0.0 |
      | tools            | project           | widget@tools | widget | updated   |                      | project |         | 1.0.0 | 1.1.0 |
      | tools            | project           | extra@tools  | extra  | installed | dependency installed | project | 1.0.0   |       |       |
    Then the installation record of the project scope holds these plugins:
      | id           | version | enabled |
      | extra@tools  | 1.0.0   | true    |
      | widget@tools | 1.1.0   | true    |
      | zcore@tools  | 2.0.0   | true    |
    When the user runs "/claude:plugin pending --scope project"
    Then the result has these fields:
      | kind         | reconcile-pending-empty |
      | severity     | info                    |
      | needs reload | false                   |

  Scenario: Apply moves a plugin after the held-down dependency it needs, once that dependency's missing dependency is installed, as pending lists it
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | alib | 1.0.0   |              |
      | bapp | 1.0.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install alib@tools --scope project"
    Given the user has run "/claude:plugin install bapp@tools --scope project"
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | alib | 1.0.0   | cdep         |
      | bapp | 1.0.0   |              |
    Given the user has run "/claude:plugin apply --scope project", which failed
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | alib | 2.0.0   | cdep         |
      | bapp | 2.0.0   | alib@^2.0.0  |
      | cdep | 1.0.0   |              |
    When the user runs "/claude:plugin pending --scope project"
    Then the result has these fields:
      | kind                | cascade           |
      | severity            | info              |
      | needs reload        | false             |
      | needs apply         | true              |
      | tally label         | Reconcile pending |
      | tally failures      | 0                 |
      | tally warnings      | 0                 |
      | tally success count | 4                 |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id         | name | status       | reasons | scope   | from  | to    |
      | tools            | project           | cdep@tools | cdep | will install |         | project |       |       |
      | tools            | project           | alib@tools | alib | will update  |         | project | 1.0.0 | 2.0.0 |
      | tools            | project           | alib@tools | alib | will enable  |         | project |       |       |
      | tools            | project           | bapp@tools | bapp | will update  |         | project | 1.0.0 | 2.0.0 |
    When the user runs "/claude:plugin apply --scope project"
    Then the result has these fields:
      | kind                | reconcile-applied-cascade |
      | severity            | info                      |
      | needs reload        | true                      |
      | tally label         | Reconcile                 |
      | tally failures      | 0                         |
      | tally warnings      | 0                         |
      | tally success count | 4                         |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id         | name | status    | reasons              | scope   | version | from  | to    |
      | tools            | project           | cdep@tools | cdep | installed | dependency installed | project | 1.0.0   |       |       |
      | tools            | project           | alib@tools | alib | updated   |                      | project |         | 1.0.0 | 2.0.0 |
      | tools            | project           | alib@tools | alib | installed |                      | project | 2.0.0   |       |       |
      | tools            | project           | bapp@tools | bapp | updated   |                      | project |         | 1.0.0 | 2.0.0 |
    Then the installation record of the project scope holds these plugins:
      | id         | version | enabled |
      | alib@tools | 2.0.0   | true    |
      | bapp@tools | 2.0.0   | true    |
      | cdep@tools | 1.0.0   | true    |
    When the user runs "/claude:plugin pending --scope project"
    Then the result has these fields:
      | kind         | reconcile-pending-empty |
      | severity     | info                    |
      | needs reload | false                   |

  Scenario: Apply reports a plugin it moves after a missing dependency's install as skipped when its other dependency's move fails
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name  | version | dependencies |
      | alib  | 1.0.0   |              |
      | xapp  | 1.0.0   |              |
      | ycore | 1.0.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install alib@tools --scope project"
    Given the user has run "/claude:plugin install xapp@tools --scope project"
    Given the user has run "/claude:plugin install ycore@tools --scope project"
    Given the marketplace "tools" offers these plugins with dependencies:
      | name  | version | dependencies |
      | alib  | 1.0.0   | cdep         |
      | xapp  | 1.0.0   |              |
      | ycore | 1.0.0   |              |
    Given the user has run "/claude:plugin apply --scope project", which failed
    Given the marketplace "tools" offers these plugins with dependencies:
      | name  | version | dependencies |
      | alib  | 2.0.0   | cdep         |
      | xapp  | 2.0.0   | alib, ycore  |
      | ycore | 2.0.0   |              |
      | cdep  | 1.0.0   |              |
    Given the published plugin "ycore" of the marketplace "tools" has an unreadable skill file
    When the user runs "/claude:plugin apply --scope project"
    Then the result has these fields:
      | kind                | reconcile-applied-cascade      |
      | severity            | error                          |
      | needs reload        | true                           |
      | summary             | A plugin operation has failed. |
      | tally label         | Reconcile                      |
      | tally failures      | 1                              |
      | tally warnings      | 1                              |
      | tally success count | 3                              |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id          | name  | status    | reasons              | scope   | version | from  | to    | leaks | rollback partial |
      | tools            | project           | ycore@tools | ycore | failed    | permission denied    | project | 2.0.0   | 1.0.0 |       |       |                  |
      | tools            | project           | cdep@tools  | cdep  | installed | dependency installed | project | 1.0.0   |       |       |       |                  |
      | tools            | project           | alib@tools  | alib  | updated   |                      | project |         | 1.0.0 | 2.0.0 |       |                  |
      | tools            | project           | alib@tools  | alib  | installed |                      | project | 2.0.0   |       |       |       |                  |
      | tools            | project           | xapp@tools  | xapp  | skipped   | dependency failed    | project | 1.0.0   |       |       |       |                  |
    Then the installation record of the project scope holds these plugins:
      | id          | version | enabled |
      | alib@tools  | 2.0.0   | true    |
      | cdep@tools  | 1.0.0   | true    |
      | xapp@tools  | 1.0.0   | true    |
      | ycore@tools | 1.0.0   | true    |

  Scenario: Apply moves a held-down plugin and then enables it once the missing dependency it waits on is installed, as pending lists both
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | alib | 1.0.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install alib@tools --scope project"
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | alib | 1.0.0   | cdep         |
    Given the user has run "/claude:plugin apply --scope project", which failed
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | alib | 2.0.0   | cdep         |
      | cdep | 1.0.0   |              |
    When the user runs "/claude:plugin pending --scope project"
    Then the result has these fields:
      | kind                | cascade           |
      | severity            | info              |
      | needs reload        | false             |
      | needs apply         | true              |
      | tally label         | Reconcile pending |
      | tally failures      | 0                 |
      | tally warnings      | 0                 |
      | tally success count | 3                 |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id         | name | status       | reasons | scope   | from  | to    |
      | tools            | project           | cdep@tools | cdep | will install |         | project |       |       |
      | tools            | project           | alib@tools | alib | will update  |         | project | 1.0.0 | 2.0.0 |
      | tools            | project           | alib@tools | alib | will enable  |         | project |       |       |
    When the user runs "/claude:plugin apply --scope project"
    Then the result has these fields:
      | kind                | reconcile-applied-cascade |
      | severity            | info                      |
      | needs reload        | true                      |
      | tally label         | Reconcile                 |
      | tally failures      | 0                         |
      | tally warnings      | 0                         |
      | tally success count | 3                         |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id         | name | status    | reasons              | scope   | version | from  | to    |
      | tools            | project           | cdep@tools | cdep | installed | dependency installed | project | 1.0.0   |       |       |
      | tools            | project           | alib@tools | alib | updated   |                      | project |         | 1.0.0 | 2.0.0 |
      | tools            | project           | alib@tools | alib | installed |                      | project | 2.0.0   |       |       |
    Then the installation record of the project scope holds these plugins:
      | id         | version | enabled |
      | alib@tools | 2.0.0   | true    |
      | cdep@tools | 1.0.0   | true    |
    When the user runs "/claude:plugin pending --scope project"
    Then the result has these fields:
      | kind         | reconcile-pending-empty |
      | severity     | info                    |
      | needs reload | false                   |

  Scenario: Apply reports the move of a held-down plugin as skipped when the install of the missing dependency it waits on is refused
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name  | version | dependencies |
      | alib  | 1.0.0   |              |
      | ycore | 1.0.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install alib@tools --scope project"
    Given the user has run "/claude:plugin install ycore@tools --scope project"
    Given the marketplace "tools" offers these plugins with dependencies:
      | name  | version | dependencies |
      | alib  | 1.0.0   | cdep         |
      | ycore | 1.0.0   |              |
    Given the user has run "/claude:plugin apply --scope project", which failed
    Given the marketplace "tools" offers these plugins with dependencies:
      | name  | version | dependencies |
      | alib  | 2.0.0   | cdep         |
      | cdep  | 1.0.0   | ycore@^2.0.0 |
      | ycore | 1.0.0   |              |
    When the user runs "/claude:plugin pending --scope project"
    Then the result has these fields:
      | kind                | cascade           |
      | severity            | info              |
      | needs reload        | false             |
      | needs apply         | true              |
      | tally label         | Reconcile pending |
      | tally failures      | 0                 |
      | tally warnings      | 0                 |
      | tally success count | 3                 |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id         | name | status       | reasons | scope   | from  | to    |
      | tools            | project           | cdep@tools | cdep | will install |         | project |       |       |
      | tools            | project           | alib@tools | alib | will update  |         | project | 1.0.0 | 2.0.0 |
      | tools            | project           | alib@tools | alib | will enable  |         | project |       |       |
    When the user runs "/claude:plugin apply --scope project"
    Then the result has these fields:
      | kind           | reconcile-applied-cascade      |
      | severity       | error                          |
      | needs reload   | false                          |
      | summary        | A plugin operation has failed. |
      | tally label    | Reconcile                      |
      | tally failures | 1                              |
      | tally warnings | 1                              |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id         | name | status  | reasons           | scope   | version | cause chain                                                                            | cause truncated | leaks | rollback partial |
      | tools            | project           | cdep@tools | cdep | failed  | dependency failed | project |         | Dependency "ycore@tools" is installed at version 1.0.0, which does not satisfy ^2.0.0. | false           |       |                  |
      | tools            | project           | alib@tools | alib | skipped | dependency failed | project | 1.0.0   |                                                                                        |                 |       |                  |
    Then the installation record of the project scope holds these plugins:
      | id          | version | enabled |
      | alib@tools  | 1.0.0   | false   |
      | ycore@tools | 1.0.0   | true    |

  Scenario: Apply refuses a missing anthropic-plugin-directory dependency whose listed copy falls outside a plugin's range, naming that plugin
    Given the git repository "dirp" holds these plugins:
      | name | version | path |
      | dirp | 1.0.0   |      |
    Given the marketplace "anthropic-plugin-directory" is published by the anthropics organization
    Given the marketplace "anthropic-plugin-directory" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   |              |
    Given the marketplace "anthropic-plugin-directory" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | dirp | url         | dirp       | true   |
    Given the marketplace "anthropic-plugin-directory" is added to the project scope
    Given the user has run "/claude:plugin install app@anthropic-plugin-directory --scope project"
    Given the marketplace "anthropic-plugin-directory" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | dirp@^2.0.0  |
    Given the marketplace "anthropic-plugin-directory" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | dirp | url         | dirp       | true   |
    Given the user has run "/claude:plugin marketplace update anthropic-plugin-directory --scope project"
    When the user runs "/claude:plugin apply --scope project"
    Then the result has these fields:
      | kind           | reconcile-applied-cascade      |
      | severity       | error                          |
      | needs reload   | true                           |
      | summary        | A plugin operation has failed. |
      | tally label    | Reconcile                      |
      | tally failures | 1                              |
      | tally warnings | 1                              |
    Then the result lists these plugins:
      | marketplace name           | marketplace scope | id                              | name | status   | reasons                | scope   | version | cause chain                                                                                                                          | cause truncated | leaks | rollback partial |
      | anthropic-plugin-directory | project           | dirp@anthropic-plugin-directory | dirp | failed   | version conflict       | project |         | "dirp" from the Anthropic Directory is pinned to its listed commit (version 1.0.0), which does not satisfy ^2.0.0 required by "app". | false           |       |                  |
      | anthropic-plugin-directory | project           | app@anthropic-plugin-directory  | app  | disabled | dependency unsatisfied | project | 1.0.0   | Install "dirp@anthropic-plugin-directory" or uninstall "app@anthropic-plugin-directory"                                              | false           |       |                  |
    Then the installation record of the project scope holds these plugins:
      | id                             | version | enabled |
      | app@anthropic-plugin-directory | 1.0.0   | false   |
