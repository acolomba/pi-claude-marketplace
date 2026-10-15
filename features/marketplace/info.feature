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

  Scenario: Info on a marketplace neither scope holds fails as not added
    When the user runs "/claude:plugin marketplace info tools"
    Then the result has these fields:
      | kind         | marketplace-not-added               |
      | severity     | error                               |
      | needs reload | false                               |
      | summary      | A marketplace operation has failed. |
      | name         | tools                               |
      | reasons      | marketplace not added               |

  Scenario: Info on a marketplace both scopes hold shows one block per scope, project first
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "tools" is added to the user scope
    Given the marketplace "tools" is added to the project scope
    When the user runs "/claude:plugin marketplace info tools"
    Then the result has these fields:
      | kind         | marketplace-info-cascade |
      | severity     | info                     |
      | needs reload | false                    |
    Then the result lists these marketplaces:
      | name  | scope   | details autoupdate | details last updated at | source kind | source abs path           |
      | tools | project | false              | {scenario time}         | path        | {home}/marketplaces/tools |
      | tools | user    | false              | {scenario time}         | path        | {home}/marketplaces/tools |
