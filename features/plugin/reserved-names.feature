Feature: Plugin reserved names

  Names that are Object.prototype members, such as constructor and __proto__, work as
  ordinary plugin names or are refused as Claude Code refuses them. The scenarios run the
  real extension in a headless Pi with local marketplaces and a Claude Code settings file.

  Scenario: Installing a plugin named constructor records it as an ordinary plugin (D-08-07)
    Given the marketplace "mp" is published as a dir source
    Given the marketplace "mp" offers these plugins:
      | name        | version |
      | constructor | 1.0.0   |
      | hello       | 1.0.0   |
    Given the marketplace "mp" is added to the project scope
    When the user runs "/claude:plugin install constructor@mp --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id             | name        | status    | reasons | scope   | version |
      | mp               | project           | constructor@mp | constructor | installed |         | project | 1.0.0   |
    Then the installation record of the project scope holds these plugins:
      | id             | version | enabled |
      | constructor@mp | 1.0.0   | true    |
    Then the "claude-plugins.json" file of the project scope declares these plugins:
      | id             |
      | constructor@mp |
    Then the project scope stages these skills and prompts:
      | kind  | name              |
      | skill | constructor-skill |
