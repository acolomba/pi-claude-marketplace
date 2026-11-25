Feature: Marketplace ssh source

  A marketplace whose git address is an ssh address clones over the user's ssh (D-SG-17).
  An ssh stand-in first on Pi's path serves the git host's repositories, and records every launch.

  Scenario: Adding a marketplace from a git@host:path address clones it over ssh
    Given the marketplace "tools" is published as a url source
    Given the user's ssh authenticates to "127.0.0.1" as "acme"
    When the user runs "/claude:plugin marketplace add git@127.0.0.1:acme/tools.git --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope   | status |
      | tools | project | added  |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name  | source                       |
      | tools | git@127.0.0.1:acme/tools.git |
    Then the user's ssh receives these launches:
      | argv                                                                                                     |
      | -o BatchMode=yes -o StrictHostKeyChecking=yes -o SendEnv=GIT_PROTOCOL git@127.0.0.1 git-upload-pack 'acme/tools.git' |
    Then the git host receives no request
