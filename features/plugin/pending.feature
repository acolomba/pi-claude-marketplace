Feature: Plugin pending

  Pending lists what the next session would change to bring a scope in line
  with the configs a user edits by hand. The scenarios run the real extension
  in a headless Pi and use a local marketplace in place of a published one.

  Background:
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |

  Scenario: Pending lists the install that a marketplace and a plugin declared by hand in the base config would cause
    Given a config in scope project and layer base, with these marketplaces:
      | name     | source                       | autoupdate |
      | fixtures | {home}/marketplaces/fixtures |            |
    Given a config in scope project and layer base, with these plugins:
      | marketplace | plugin | enabled |
      | fixtures    | demo   |         |
    When the user runs "/claude:plugin pending --scope project"
    Then the result has these fields:
      | kind                | cascade           |
      | severity            | info              |
      | needs reload        | false             |
      | tally label         | Reconcile pending |
      | tally failures      | 0                 |
      | tally warnings      | 0                 |
      | tally success count | 1                 |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status       | reasons | scope   |
      | fixtures         | project           | demo@fixtures | demo | will install |         | project |

  Scenario: Pending lists the install that a marketplace and a plugin declared by hand in the local config would cause
    Given a config in scope project and layer local, with these marketplaces:
      | name     | source                       | autoupdate |
      | fixtures | {home}/marketplaces/fixtures |            |
    Given a config in scope project and layer local, with these plugins:
      | marketplace | plugin | enabled |
      | fixtures    | demo   |         |
    When the user runs "/claude:plugin pending --scope project"
    Then the result has these fields:
      | kind                | cascade           |
      | severity            | info              |
      | needs reload        | false             |
      | tally label         | Reconcile pending |
      | tally failures      | 0                 |
      | tally warnings      | 0                 |
      | tally success count | 1                 |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status       | reasons | scope   |
      | fixtures         | project           | demo@fixtures | demo | will install |         | project |
