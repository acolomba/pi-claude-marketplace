Feature: Plugin update

  Updating a plugin replaces the installed version with the one the marketplace offers now.
  The scenarios run the real extension in a headless Pi, read its JSON results,
  and use a local marketplace in place of a published one.

  Background:
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"

  Scenario: The user updates a plugin to a new version
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.1.0   |
    When the user runs "/claude:plugin update demo@fixtures --scope project"
    Then the result has these fields:
      | severity    | info |
      | needsReload | true |
      | noOp        |      |
      | summary     |      |
    Then the result lists these plugins:
      | id            | status  | reasons | scope   | from  | to    |
      | demo@fixtures | updated |         | project | 1.0.0 | 1.1.0 |

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
    Then the result lists these plugins:
      | id            | status    | reasons | scope   | version |
      | demo@fixtures | installed |         | project | 1.1.0   |

  Scenario: The user updates a plugin that is up to date
    When the user runs "/claude:plugin update demo@fixtures --scope project"
    Then the result has these fields:
      | severity    | info  |
      | needsReload | false |
      | noOp        |       |
      | summary     |       |
    Then the result lists these plugins:
      | id            | status  | reasons    | scope   |
      | demo@fixtures | skipped | up-to-date | project |
