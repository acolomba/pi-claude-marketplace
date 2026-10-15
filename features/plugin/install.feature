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
    Then the result has these fields:
      | severity    | info |
      | needsReload | true |
      | noOp        |      |
      | summary     |      |
    Then the result lists these plugins:
      | id            | status    | reasons | scope   | version |
      | demo@fixtures | installed |         | project | 1.0.0   |

  Scenario: A new session offers the skills of the installed plugin
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    When the user starts a new pi session
    Then the session offers these skills:
      | command           | description            |
      | /skill:demo-skill | A skill of demo 1.0.0. |

  Scenario: The plugin list shows the installed plugin
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    When the user runs "/claude:plugin list --scope project"
    Then the result has these fields:
      | severity    | info  |
      | needsReload | false |
      | noOp        |       |
      | summary     |       |
    Then the result lists these plugins:
      | id            | status    | reasons | scope   | version |
      | demo@fixtures | installed |         | project | 1.0.0   |

  Scenario: The user installs a plugin the marketplace does not offer
    When the user runs "/claude:plugin install missing@fixtures --scope project"
    Then the result has these fields:
      | severity    | error                          |
      | needsReload | false                          |
      | noOp        |                                |
      | summary     | A plugin operation has failed. |
    Then the result lists these plugins:
      | id               | status | reasons         |
      | missing@fixtures | failed | not in manifest |

  Scenario: The user installs a plugin that is already installed
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    When the user runs "/claude:plugin install demo@fixtures --scope project"
    Then the result has these fields:
      | severity    | error                          |
      | needsReload | false                          |
      | noOp        |                                |
      | summary     | A plugin operation has failed. |
    Then the result lists these plugins:
      | id            | status | reasons           |
      | demo@fixtures | failed | already installed |
