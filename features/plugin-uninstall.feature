Feature: Plugin uninstall

  Uninstalling a plugin removes it and its record from the chosen scope.
  The scenarios run the real extension in a headless Pi, read its JSON results,
  and use a local marketplace in place of a published one.

  Background:
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" is added to the project scope

  Scenario: The user uninstalls an installed plugin
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    When the user runs "/claude:plugin uninstall demo@fixtures --scope project"
    Then the result has these fields:
      | severity    | info |
      | needsReload | true |
      | noOp        |      |
      | summary     |      |
    Then the result lists these plugins:
      | id            | status      | reasons | scope   | version |
      | demo@fixtures | uninstalled |         | project | 1.0.0   |

  Scenario: A new session no longer offers the skills of the uninstalled plugin
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has run "/claude:plugin uninstall demo@fixtures --scope project"
    When the user starts a new pi session
    Then the session offers no skills

  Scenario: The plugin list shows the uninstalled plugin as available
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has run "/claude:plugin uninstall demo@fixtures --scope project"
    When the user runs "/claude:plugin list --scope project"
    Then the result lists these plugins:
      | id            | status    | reasons | scope | version |
      | demo@fixtures | available |         |       | 1.0.0   |

  Scenario: The user uninstalls a plugin that is not installed
    When the user runs "/claude:plugin uninstall demo@fixtures --scope project"
    Then the result has these fields:
      | severity    | error                          |
      | needsReload | false                          |
      | noOp        |                                |
      | summary     | A plugin operation has failed. |
    Then the result lists these plugins:
      | id            | status | reasons       |
      | demo@fixtures | failed | not installed |
