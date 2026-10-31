Feature: Plugin update rollback

  An update failure keeps the installed version, skills, and record.
  A retry succeeds after the cause is removed.

  Background:
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.1.0   |
    Given a directory blocks the mcp-adapter.json file of the project scope

  Scenario: An update that fails in its mcp phase keeps the installed version, its record, and its declaration
    When the user runs "/claude:plugin update demo@fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status | reasons    | scope   | from  | version | cause chain                   | cause truncated | leaks | rollback partial |
      | fixtures         | project           | demo@fixtures | demo | failed | unreadable | project | 1.0.0 | 1.1.0   | {mcp-adapter.json read error} | false           |       |                  |
    Then the installation record of the project scope holds these plugins:
      | id            | version | enabled |
      | demo@fixtures | 1.0.0   | true    |
    Then the "claude-plugins.json" file of the project scope declares these plugins:
      | id            |
      | demo@fixtures |
    Then the project scope stages these skills and prompts:
      | kind  | name       |
      | skill | demo-skill |

  Scenario: An autoupdate that fails in its mcp phase reports the cause the direct update reports
    Given the user has run "/claude:plugin marketplace autoupdate fixtures --scope project"
    When the user runs "/claude:plugin marketplace update fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | marketplace status | id            | name | status | reasons    | scope   | from  | version | cause chain                   | cause truncated | leaks | rollback partial |
      | fixtures         | project           | updated            | demo@fixtures | demo | failed | unreadable | project | 1.0.0 | 1.1.0   | {mcp-adapter.json read error} | false           |       |                  |
    Then the installation record of the project scope holds these plugins:
      | id            | version | enabled |
      | demo@fixtures | 1.0.0   | true    |

  Scenario: The plugin list shows the installed version after a failed update
    Given the user has run "/claude:plugin update demo@fixtures --scope project", which failed
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
      | marketplace name | marketplace scope | id            | name | status     | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | upgradable |         | project | 1.0.0   |

  Scenario: Info on the plugin shows the installed version after a failed update
    Given the user has run "/claude:plugin update demo@fixtures --scope project", which failed
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
      | plugin version                 | 1.0.0         |
      | plugin components resolved     | true          |
      | plugin components skills       | demo-skill    |

  Scenario: A new session offers the skills of the installed version after a failed update
    Given the user has run "/claude:plugin update demo@fixtures --scope project", which failed
    When the user starts a new pi session
    Then the session reports these results:
      | kind    | severity | needs reload | needs apply | tally label       | tally failures | tally warnings | tally success count |
      | cascade | info     | false        | true        | Reconcile pending | 0              | 0              | 1                   |
      | cascade | info     | false        | true        | Reconcile pending | 0              | 0              | 1                   |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status      | reasons | scope   | from  | to    |
      | fixtures         | project           | demo@fixtures | demo | will update |         | project | 1.0.0 | 1.1.0 |
      | fixtures         | project           | demo@fixtures | demo | will update |         | project | 1.0.0 | 1.1.0 |
    Then the session offers these skills:
      | command           | description            |
      | /skill:demo-skill | A skill of demo 1.0.0. |

  Scenario: An update that failed while a directory blocked the mcp-adapter.json file succeeds once the directory is removed
    Given the user has run "/claude:plugin update demo@fixtures --scope project", which failed
    Given the directory that blocks the mcp-adapter.json file of the project scope is removed
    When the user runs "/claude:plugin update demo@fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status  | reasons | scope   | from  | to    |
      | fixtures         | project           | demo@fixtures | demo | updated |         | project | 1.0.0 | 1.1.0 |
    Then the installation record of the project scope holds these plugins:
      | id            | version | enabled |
      | demo@fixtures | 1.1.0   | true    |
