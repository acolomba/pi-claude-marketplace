Feature: Marketplace info

  Info shows what the extension knows about an added marketplace: where it comes from and how it updates.
  The scenarios run the real extension in a headless Pi, read its JSON results,
  and use local marketplaces in place of published ones.

  Scenario: Info on a directory marketplace shows its absolute path and autoupdate state
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the user has run "/claude:plugin marketplace add {home}/marketplaces/tools --scope project"
    When the user runs "/claude:plugin marketplace info tools --scope project"
    Then the result has these fields:
      | kind                    | marketplace-info          |
      | name                    | tools                     |
      | scope                   | project                   |
      | details autoupdate      | false                     |
      | details last updated at | {scenario time}           |
      | source kind             | path                      |
      | source abs path         | {home}/marketplaces/tools |
      | severity                | info                      |
      | needs reload            | false                     |
