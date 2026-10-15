Feature: Plugin uninstall

  Uninstalling a plugin removes it and its record from the chosen scope.
  The scenarios run the real extension in a headless Pi, read its JSON results,
  and use a local marketplace in place of a published one.

  Background:
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" is added to the project scope

  Scenario: Uninstalling an installed plugin reports it uninstalled from the chosen scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    When the user runs "/claude:plugin uninstall demo@fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status      | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | uninstalled |         | project | 1.0.0   |

  Scenario: A new session no longer offers the skills of the uninstalled plugin
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has run "/claude:plugin uninstall demo@fixtures --scope project"
    When the user starts a new pi session
    Then the session offers no skills

  Scenario: The plugin list shows the uninstalled plugin as available
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has run "/claude:plugin uninstall demo@fixtures --scope project"
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

  Scenario: Uninstalling a plugin that is not installed fails as not installed
    When the user runs "/claude:plugin uninstall demo@fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status | reasons       | scope   | leaks | rollback partial |
      | fixtures         | project           | demo@fixtures | demo | failed | not installed | project |       |                  |
