Feature: Marketplace remove

  Removing a marketplace drops it from a scope, with its declaration and the
  plugins installed from it. The scenarios run the real extension in a headless
  Pi, read its JSON results, and use local marketplaces in place of published ones.

  Scenario: Removing a marketplace with --local clears only its local declaration
    Given the marketplace "base" is published as a dir source
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "extras" is published as a dir source
    Given the marketplace "base" is added to the project scope
    Given the user has run "/claude:plugin marketplace add {home}/marketplaces/tools --scope project --local"
    Given the user has run "/claude:plugin marketplace add {home}/marketplaces/extras --scope project --local"
    When the user runs "/claude:plugin marketplace remove tools --scope project --local"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope   | status  |
      | tools | project | removed |
    Then the "claude-plugins.local.json" file of the project scope declares these marketplaces:
      | name   | source                     |
      | extras | {home}/marketplaces/extras |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name | source                   |
      | base | {home}/marketplaces/base |
