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
    Then the result severity is "info"
    Then the result needs a reload
    Then the result lists these plugins:
      | id            | status      | scope   | version |
      | demo@fixtures | uninstalled | project | 1.0.0   |

  Scenario: The plugin list shows the uninstalled plugin as available
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has run "/claude:plugin uninstall demo@fixtures --scope project"
    When the user runs "/claude:plugin list --scope project"
    Then the result lists these plugins:
      | id            | status    | version |
      | demo@fixtures | available | 1.0.0   |

  Scenario: The user uninstalls a plugin that is not installed
    When the user runs "/claude:plugin uninstall demo@fixtures --scope project"
    Then the result severity is "error"
    Then the result needs no reload
    Then the result lists these plugins:
      | id            | status | reasons       |
      | demo@fixtures | failed | not installed |
