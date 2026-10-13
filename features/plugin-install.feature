Feature: Plugin install

  Installing a plugin from an added marketplace materializes it in the chosen scope.
  The scenarios run the real extension in a headless Pi, read its JSON results,
  and use a local marketplace in place of a published one.

  Background:
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" is added to the project scope

  Scenario: The user installs a plugin
    When the user runs "/claude:plugin install demo@fixtures --scope project"
    Then the result severity is "info"
    Then the result needs a reload
    Then the result lists these plugins:
      | id            | status    | scope   | version |
      | demo@fixtures | installed | project | 1.0.0   |

  Scenario: The plugin list shows the installed plugin
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    When the user runs "/claude:plugin list --scope project"
    Then the result severity is "info"
    Then the result needs no reload
    Then the result lists these plugins:
      | id            | status    | version |
      | demo@fixtures | installed | 1.0.0   |

  Scenario: The user installs a plugin the marketplace does not offer
    When the user runs "/claude:plugin install missing@fixtures --scope project"
    Then the result severity is "error"
    Then the result needs no reload
    Then the result lists these plugins:
      | id               | status | reasons         |
      | missing@fixtures | failed | not in manifest |

  Scenario: The user installs a plugin that is already installed
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    When the user runs "/claude:plugin install demo@fixtures --scope project"
    Then the result severity is "error"
    Then the result needs no reload
    Then the result lists these plugins:
      | id            | status | reasons           |
      | demo@fixtures | failed | already installed |
