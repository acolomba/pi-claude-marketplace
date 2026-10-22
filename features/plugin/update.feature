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
