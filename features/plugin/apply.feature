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

  Scenario: Apply that cannot install one hand-declared plugin reports it and installs the other
    Given the marketplace "fixtures" is added to the project scope
    Given a config in scope project and layer base, with these plugins:
      | marketplace | plugin | enabled |
      | fixtures    | ghost  |         |
      | fixtures    | demo   |         |
    When the user runs "/claude:plugin apply --scope project"
    Then the result has these fields:
      | kind                | reconcile-applied-cascade      |
      | severity            | error                          |
      | needs reload        | true                           |
      | summary             | A plugin operation has failed. |
      | tally label         | Reconcile                      |
      | tally failures      | 1                              |
      | tally warnings      | 0                              |
      | tally success count | 1                              |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id             | name  | status    | reasons         | scope   | version | leaks | rollback partial |
      | fixtures         | project           | ghost@fixtures | ghost | failed    | not in manifest | project |         |       |                  |
      | fixtures         | project           | demo@fixtures  | demo  | installed |                 | project | 1.0.0   |       |                  |
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

  Scenario: Apply disables a plugin that an update left needing a newer version of its dependency
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib          |
      | lib  | 1.0.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install app@tools --scope project"
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 2.0.0   | lib@^2.0.0   |
      | lib  | 1.0.0   |              |
    Given the user has run "/claude:plugin update app@tools --scope project"
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
      | tools            | project           | app@tools | app  | disabled | dependency version unsatisfied | project | 2.0.0   | Update "lib@tools" to satisfy ^2.0.0, or uninstall "app@tools" | false           |       |                  |
    When the user starts a new pi session
    Then the session offers these skills:
      | command          | description           |
      | /skill:lib-skill | A skill of lib 1.0.0. |

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
    When the user runs "/claude:plugin apply --scope project"
    Then the result has these fields:
      | kind         | reconcile-pending-empty |
      | severity     | info                    |
      | needs reload | false                   |
    Then the installation record of the project scope holds these plugins:
      | id            | version | enabled |
      | demo@fixtures | 1.0.0   | true    |

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

  Scenario: Apply moves a plugin and the dependency its new version needs in one pass, after which pending lists nothing
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib          |
      | lib  | 1.0.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install app@tools --scope project"
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 2.0.0   | lib@^2.0.0   |
      | lib  | 2.0.0   |              |
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
      | marketplace name | marketplace scope | id        | name | status  | reasons | scope   | from  | to    |
      | tools            | project           | app@tools | app  | updated |         | project | 1.0.0 | 2.0.0 |
      | tools            | project           | lib@tools | lib  | updated |         | project | 1.0.0 | 2.0.0 |
    Then the installation record of the project scope holds these plugins:
      | id        | version | enabled |
      | app@tools | 2.0.0   | true    |
      | lib@tools | 2.0.0   | true    |
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

  Scenario: Apply moves a path-source and a git-source plugin to the versions a marketplace update brought
    Given the git repository "ghp" holds these plugins:
      | name | version | path |
      | ghp  | 1.0.0   |      |
    Given the marketplace "fixtures" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | ghp  | github      | ghp        | true   |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has run "/claude:plugin install ghp@fixtures --scope project"
    Given the git repository "ghp" holds these plugins:
      | name | version | path |
      | ghp  | 2.0.0   |      |
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.1.0   |
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
      | fixtures         | project           | demo@fixtures | demo | updated |         | project | 1.0.0 | 1.1.0 |
      | fixtures         | project           | ghp@fixtures  | ghp  | updated |         | project | 1.0.0 | 2.0.0 |
    Then the installation record of the project scope holds these plugins:
      | id            | version | enabled |
      | demo@fixtures | 1.1.0   | true    |
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
