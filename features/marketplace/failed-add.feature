Feature: Marketplace failed add

  A marketplace add that fails leaves nothing behind, so the same add succeeds
  once its cause is gone. The scenarios run the real extension in a headless Pi
  and use local marketplaces in place of published ones.

  Scenario: Adding a marketplace succeeds once its invalid manifest is repaired
    Given the marketplace "tools" is published as a dir source
    Given the manifest of the marketplace "tools" to add is not valid json
    Given the user has run "/claude:plugin marketplace add {home}/marketplaces/tools --scope project", which failed
    Given the marketplace "tools" source is repaired with a changed valid manifest
    When the user runs "/claude:plugin marketplace add {home}/marketplaces/tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope   | status |
      | tools | project | added  |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name  | source                    |
      | tools | {home}/marketplaces/tools |
