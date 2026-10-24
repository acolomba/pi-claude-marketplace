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
