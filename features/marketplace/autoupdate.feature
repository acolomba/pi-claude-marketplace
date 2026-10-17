Feature: Marketplace autoupdate

  Autoupdate turns automatic updates on and off for an added marketplace, and a
  scope's two configuration files combine the setting. The scenarios run the real
  extension in a headless Pi and use local marketplaces in place of published ones.

  Scenario: A local declaration without autoupdate takes the setting from the shared declaration
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin marketplace autoupdate tools --scope project"
    Given the user has run "/claude:plugin marketplace add {home}/marketplaces/tools --scope project --local"
    When the user runs "/claude:plugin marketplace list --scope project"
    Then the result has these fields:
      | kind                | cascade          |
      | severity            | info             |
      | needs reload        | false            |
      | tally label         | Marketplace list |
      | tally failures      | 0                |
      | tally warnings      | 0                |
      | tally success count | 1                |
    Then the result lists these marketplaces:
      | name  | scope   | details autoupdate | details last updated at |
      | tools | project | true               | {scenario time}         |
    Then the "claude-plugins.local.json" file of the project scope declares these marketplaces:
      | name  | source                    |
      | tools | {home}/marketplaces/tools |
