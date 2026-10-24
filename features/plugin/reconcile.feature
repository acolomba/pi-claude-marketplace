Feature: Plugin reconcile

  A new session changes no installed plugin. It reports the warnings that come
  back every session, and /claude:plugin apply makes the changes that the
  configs a user edits by hand ask for. The scenarios run the real extension in
  a headless Pi and use a local marketplace in place of a published one.

  Background:
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name  | version |
      | demo  | 1.0.0   |
      | alpha | 1.0.0   |

  Scenario: A new session after a hand edit of the config changes no installation state
    Given the marketplace "fixtures" is added to the project scope
    Given a config in scope project and layer base, with these plugins:
      | marketplace | plugin | enabled |
      | fixtures    | demo   |         |
    When the user starts a new pi session
    Then the project scope has no installed plugins
    Then the session offers no skills

  Scenario: A new session installs a plugin that a config declares by hand and reports it
    Given the marketplace "fixtures" is added to the project scope
    Given a config in scope project and layer base, with these plugins:
      | marketplace | plugin | enabled |
      | fixtures    | demo   |         |
    When the user starts a new pi session
    Then the result has these fields:
      | kind                | reconcile-applied-cascade |
      | severity            | info                      |
      | needs reload        | false                     |
      | tally label         | Reconcile                 |
      | tally failures      | 0                         |
      | tally warnings      | 0                         |
      | tally success count | 1                         |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | installed |         | project | 1.0.0   |
    Then the session offers these skills:
      | command           | description            |
      | /skill:demo-skill | A skill of demo 1.0.0. |

  Scenario: A new session adds a marketplace that a config declares by hand and installs its plugin
    Given a config in scope project and layer base, with these marketplaces:
      | name     | source                       | autoupdate |
      | fixtures | {home}/marketplaces/fixtures |            |
    Given a config in scope project and layer base, with these plugins:
      | marketplace | plugin | enabled |
      | fixtures    | demo   |         |
    When the user starts a new pi session
    Then the result has these fields:
      | kind                | reconcile-applied-cascade |
      | severity            | info                      |
      | needs reload        | false                     |
      | tally label         | Reconcile                 |
      | tally failures      | 0                         |
      | tally warnings      | 0                         |
      | tally success count | 2                         |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | marketplace status | id            | name | status    | reasons | scope   | version |
      | fixtures         | project           | added              | demo@fixtures | demo | installed |         | project | 1.0.0   |
    Then the session offers these skills:
      | command           | description            |
      | /skill:demo-skill | A skill of demo 1.0.0. |

  Scenario: A new session uninstalls a plugin removed from a config by hand and keeps the others
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has run "/claude:plugin install alpha@fixtures --scope project"
    Given a config in scope project and layer base, with these plugins:
      | marketplace | plugin | enabled |
      | fixtures    | alpha  |         |
    When the user starts a new pi session
    Then the result has these fields:
      | kind                | reconcile-applied-cascade |
      | severity            | info                      |
      | needs reload        | false                     |
      | tally label         | Reconcile                 |
      | tally failures      | 0                         |
      | tally warnings      | 0                         |
      | tally success count | 1                         |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status      | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | uninstalled |         | project | 1.0.0   |
    Then the session offers these skills:
      | command            | description             |
      | /skill:alpha-skill | A skill of alpha 1.0.0. |

  Scenario: A new session disables a plugin set to disabled in a config by hand
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given a config in scope project and layer base, with these plugins:
      | marketplace | plugin | enabled |
      | fixtures    | demo   | false   |
    When the user starts a new pi session
    Then the result has these fields:
      | kind                | reconcile-applied-cascade |
      | severity            | info                      |
      | needs reload        | false                     |
      | tally label         | Reconcile                 |
      | tally failures      | 0                         |
      | tally warnings      | 0                         |
      | tally success count | 1                         |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status   | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | disabled |         | project | 1.0.0   |
    Then the session offers no skills

  Scenario: A new session enables a plugin set to enabled in a config by hand
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has run "/claude:plugin disable demo@fixtures --scope project"
    Given a config in scope project and layer base, with these plugins:
      | marketplace | plugin | enabled |
      | fixtures    | demo   | true    |
    When the user starts a new pi session
    Then the result has these fields:
      | kind                | reconcile-applied-cascade |
      | severity            | info                      |
      | needs reload        | false                     |
      | tally label         | Reconcile                 |
      | tally failures      | 0                         |
      | tally warnings      | 0                         |
      | tally success count | 1                         |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | installed |         | project | 1.0.0   |
    Then the session offers these skills:
      | command           | description            |
      | /skill:demo-skill | A skill of demo 1.0.0. |

  Scenario: A new session that cannot install one hand-declared plugin reports it and installs the other
    Given the marketplace "fixtures" is added to the project scope
    Given a config in scope project and layer base, with these plugins:
      | marketplace | plugin | enabled |
      | fixtures    | ghost  |         |
      | fixtures    | demo   |         |
    When the user starts a new pi session
    Then the session reports these results:
      | kind                      | severity | needs reload | summary                        | tally label | tally failures | tally warnings | tally success count |
      | reconcile-applied-cascade | error    | false        | A plugin operation has failed. | Reconcile   | 1              | 0              | 1                   |
      | reconcile-applied-cascade | error    | false        | A plugin operation has failed. | Reconcile   | 1              | 0              |                     |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id             | name  | status    | reasons         | scope   | version | leaks | rollback partial |
      | fixtures         | project           | ghost@fixtures | ghost | failed    | not in manifest | project |         |       |                  |
      | fixtures         | project           | demo@fixtures  | demo  | installed |                 | project | 1.0.0   |       |                  |
      | fixtures         | project           | ghost@fixtures | ghost | failed    | not in manifest | project |         |       |                  |
    Then the session offers these skills:
      | command           | description            |
      | /skill:demo-skill | A skill of demo 1.0.0. |

  Scenario: A new session disables a plugin that an update left needing a newer version of its dependency
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
    When the user starts a new pi session
    Then the result has these fields:
      | kind           | reconcile-applied-cascade           |
      | severity       | warning                             |
      | needs reload   | false                               |
      | summary        | A plugin operation needs attention. |
      | tally label    | Reconcile                           |
      | tally failures | 0                                   |
      | tally warnings | 1                                   |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name | status   | reasons                        | scope   | version | cause chain                                                               | cause truncated | leaks | rollback partial |
      | tools            | project           | app@tools | app  | disabled | dependency version unsatisfied | project | 2.0.0   | Update "lib@tools" to satisfy ^2.0.0, or uninstall "app@tools" | false           |       |                  |
    Then the session offers these skills:
      | command          | description           |
      | /skill:lib-skill | A skill of lib 1.0.0. |

  Scenario: Every new session warns about an installed plugin that its catalog no longer offers and keeps it working
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the marketplace "fixtures" offers these plugins:
      | name  | version |
      | alpha | 1.0.0   |
    Given the user has run "/claude:plugin marketplace update fixtures --scope project"
    When the user starts a new pi session
    Then the session reports these results:
      | kind                      | severity | needs reload | summary                             | tally label | tally failures | tally warnings |
      | reconcile-applied-cascade | warning  | false        | A plugin operation needs attention. | Reconcile   | 0              | 1              |
      | reconcile-applied-cascade | warning  | false        | A plugin operation needs attention. | Reconcile   | 0              | 1              |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status | reasons         | scope   | cause chain                                       | cause truncated | leaks | rollback partial |
      | fixtures         | project           | demo@fixtures | demo | failed | not in manifest | project | Plugin "demo" not found in marketplace "fixtures" | false           |       |                  |
      | fixtures         | project           | demo@fixtures | demo | failed | not in manifest | project | Plugin "demo" not found in marketplace "fixtures" | false           |       |                  |
    Then the session offers these skills:
      | command           | description            |
      | /skill:demo-skill | A skill of demo 1.0.0. |
    When the user starts a new pi session
    Then the session reports these results:
      | kind                      | severity | needs reload | summary                             | tally label | tally failures | tally warnings |
      | reconcile-applied-cascade | warning  | false        | A plugin operation needs attention. | Reconcile   | 0              | 1              |
      | reconcile-applied-cascade | warning  | false        | A plugin operation needs attention. | Reconcile   | 0              | 1              |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status | reasons         | scope   | cause chain                                       | cause truncated | leaks | rollback partial |
      | fixtures         | project           | demo@fixtures | demo | failed | not in manifest | project | Plugin "demo" not found in marketplace "fixtures" | false           |       |                  |
      | fixtures         | project           | demo@fixtures | demo | failed | not in manifest | project | Plugin "demo" not found in marketplace "fixtures" | false           |       |                  |
    Then the session offers these skills:
      | command           | description            |
      | /skill:demo-skill | A skill of demo 1.0.0. |

  Scenario: Every new session warns about an installed plugin whose marketplace manifest is invalid and keeps it working
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the manifest of the marketplace "fixtures" has become invalid
    When the user starts a new pi session
    Then the session reports these results:
      | kind                      | severity | needs reload | summary                             | tally label | tally failures | tally warnings |
      | reconcile-applied-cascade | warning  | false        | A plugin operation needs attention. | Reconcile   | 0              | 1              |
      | reconcile-applied-cascade | warning  | false        | A plugin operation needs attention. | Reconcile   | 0              | 1              |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status | reasons          | scope   | cause chain                                                                        | cause truncated | leaks | rollback partial |
      | fixtures         | project           | demo@fixtures | demo | failed | invalid manifest | project | cannot read the dependencies of demo@fixtures: its marketplace manifest is invalid | false           |       |                  |
      | fixtures         | project           | demo@fixtures | demo | failed | invalid manifest | project | cannot read the dependencies of demo@fixtures: its marketplace manifest is invalid | false           |       |                  |
    Then the session offers these skills:
      | command           | description            |
      | /skill:demo-skill | A skill of demo 1.0.0. |
    When the user starts a new pi session
    Then the session reports these results:
      | kind                      | severity | needs reload | summary                             | tally label | tally failures | tally warnings |
      | reconcile-applied-cascade | warning  | false        | A plugin operation needs attention. | Reconcile   | 0              | 1              |
      | reconcile-applied-cascade | warning  | false        | A plugin operation needs attention. | Reconcile   | 0              | 1              |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status | reasons          | scope   | cause chain                                                                        | cause truncated | leaks | rollback partial |
      | fixtures         | project           | demo@fixtures | demo | failed | invalid manifest | project | cannot read the dependencies of demo@fixtures: its marketplace manifest is invalid | false           |       |                  |
      | fixtures         | project           | demo@fixtures | demo | failed | invalid manifest | project | cannot read the dependencies of demo@fixtures: its marketplace manifest is invalid | false           |       |                  |
    Then the session offers these skills:
      | command           | description            |
      | /skill:demo-skill | A skill of demo 1.0.0. |

  Scenario: Every new session warns about an installed plugin whose marketplace manifest is not valid json and keeps it working
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the manifest of the marketplace "fixtures" is no longer valid json
    When the user starts a new pi session
    Then the session reports these results:
      | kind                      | severity | needs reload | summary                             | tally label | tally failures | tally warnings |
      | reconcile-applied-cascade | warning  | false        | A plugin operation needs attention. | Reconcile   | 0              | 1              |
      | reconcile-applied-cascade | warning  | false        | A plugin operation needs attention. | Reconcile   | 0              | 1              |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status | reasons          | scope   | cause chain                                                                        | cause truncated | leaks | rollback partial |
      | fixtures         | project           | demo@fixtures | demo | failed | unparseable      | project | cannot read the dependencies of demo@fixtures: its marketplace manifest is invalid | false           |       |                  |
      | fixtures         | project           | demo@fixtures | demo | failed | unparseable      | project | cannot read the dependencies of demo@fixtures: its marketplace manifest is invalid | false           |       |                  |
    Then the session offers these skills:
      | command           | description            |
      | /skill:demo-skill | A skill of demo 1.0.0. |
    When the user starts a new pi session
    Then the session reports these results:
      | kind                      | severity | needs reload | summary                             | tally label | tally failures | tally warnings |
      | reconcile-applied-cascade | warning  | false        | A plugin operation needs attention. | Reconcile   | 0              | 1              |
      | reconcile-applied-cascade | warning  | false        | A plugin operation needs attention. | Reconcile   | 0              | 1              |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status | reasons          | scope   | cause chain                                                                        | cause truncated | leaks | rollback partial |
      | fixtures         | project           | demo@fixtures | demo | failed | unparseable      | project | cannot read the dependencies of demo@fixtures: its marketplace manifest is invalid | false           |       |                  |
      | fixtures         | project           | demo@fixtures | demo | failed | unparseable      | project | cannot read the dependencies of demo@fixtures: its marketplace manifest is invalid | false           |       |                  |
    Then the session offers these skills:
      | command           | description            |
      | /skill:demo-skill | A skill of demo 1.0.0. |

  Scenario: A new session reports a hand-declared plugin pi supports only in part with the reason install gives
    Given the published plugin "demo" of the marketplace "fixtures" has an output style
    Given the marketplace "fixtures" is added to the project scope
    Given a config in scope project and layer base, with these plugins:
      | marketplace | plugin | enabled |
      | fixtures    | demo   |         |
    When the user starts a new pi session
    Then the session reports these results:
      | kind                      | severity | needs reload | summary                        | tally label | tally failures | tally warnings |
      | reconcile-applied-cascade | error    | false        | A plugin operation has failed. | Reconcile   | 1              | 0              |
      | reconcile-applied-cascade | error    | false        | A plugin operation has failed. | Reconcile   | 1              | 0              |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status | reasons               | scope   | leaks | rollback partial |
      | fixtures         | project           | demo@fixtures | demo | failed | unsupported component | project |       |                  |
      | fixtures         | project           | demo@fixtures | demo | failed | unsupported component | project |       |                  |
    Then the project scope has no installed plugins

  Scenario: Every new session warns once about a plugin its catalog no longer offers whose files are gone
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib          |
      | lib  | 1.0.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install app@tools --scope project"
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | lib  | 1.0.0   |              |
    Given the marketplace "tools" no longer holds the files of the plugin "app"
    When the user starts a new pi session
    Then the session reports these results:
      | kind                      | severity | needs reload | summary                             | tally label | tally failures | tally warnings |
      | reconcile-applied-cascade | warning  | false        | A plugin operation needs attention. | Reconcile   | 0              | 1              |
      | reconcile-applied-cascade | warning  | false        | A plugin operation needs attention. | Reconcile   | 0              | 1              |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id        | name | status | reasons         | scope   | cause chain                                                                                                       | cause truncated | leaks | rollback partial |
      | tools            | project           | app@tools | app  | failed | not in manifest | project | cannot read the dependencies of app@tools: not declared by its marketplace, and its installed copy cannot be read | false           |       |                  |
      | tools            | project           | app@tools | app  | failed | not in manifest | project | cannot read the dependencies of app@tools: not declared by its marketplace, and its installed copy cannot be read | false           |       |                  |
