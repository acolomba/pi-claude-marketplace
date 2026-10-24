Feature: Plugin apply

  Apply makes the changes that pending lists, so a scope matches the configs a
  user edits by hand. The scenarios run the real extension in a headless Pi and
  use a local marketplace in place of a published one.

  Background:
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |

  Scenario: Apply installs a plugin that a config declares by hand and reports it
    Given the marketplace "fixtures" is added to the project scope
    Given a config in scope project and layer base, with these plugins:
      | marketplace | plugin | enabled |
      | fixtures    | demo   |         |
    When the user runs "/claude:plugin apply --scope project"
    Then the result has these fields:
      | kind                | reconcile-applied-cascade |
      | severity            | info                      |
      | needs reload        | false                     |
      | tally label         | Reconcile                 |
      | tally failures      | 0                         |
      | tally warnings      | 0                         |
      | tally success count | 1                         |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | installed |         | project | 1.0.0   |
    Then the installation record of the project scope holds these plugins:
      | id            | version | enabled |
      | demo@fixtures | 1.0.0   | true    |
