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
