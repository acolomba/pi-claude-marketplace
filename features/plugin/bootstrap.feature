Feature: Plugin bootstrap

  Bootstrap adds Claude Code's official marketplace to the user scope and turns
  on its autoupdate. A loopback https git host stands in for GitHub and serves
  the official marketplace through the GitHub base override.

  Scenario: Bootstrapping a second time leaves the official marketplace as it is
    Given the marketplace "claude-plugins-official" is published as the official marketplace
    Given the user has run "/claude:plugin bootstrap"
    When the user runs "/claude:plugin bootstrap"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name                    | scope | status  | reasons            |
      | claude-plugins-official | user  | skipped | already autoupdate |
    Then the git host receives no request
    Then the "claude-plugins.json" file of the user scope declares these marketplaces:
      | name                    | source                             | autoupdate |
      | claude-plugins-official | anthropics/claude-plugins-official | true       |
