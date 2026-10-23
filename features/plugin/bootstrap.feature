Feature: Plugin bootstrap

  Bootstrap adds Claude Code's official marketplace to the user scope and turns
  on its autoupdate. The scenarios run the real extension in a headless Pi
  against a loopback https git host, which serves the official marketplace
  through the GitHub base override.

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
