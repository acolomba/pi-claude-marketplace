Feature: Marketplace ssh source

  A marketplace whose git address is an ssh address clones over the user's ssh (D-SG-17).
  An ssh stand-in first on Pi's path serves the git host's repositories, and records every launch.
  A github.com ssh address reaches the git host through the GitHub base override's rewrite (D-SG-21), and its result names the ssh transport it was written for (D-SG-22, OQ-3).

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
      | argv                                                                                                                 |
      | -o BatchMode=yes -o StrictHostKeyChecking=yes -o SendEnv=GIT_PROTOCOL git@127.0.0.1 git-upload-pack 'acme/tools.git' |
    Then the git host receives no request

  Scenario: Applying a config that declares an ssh:// marketplace adds it over ssh
    Given the marketplace "tools" is published as a url source
    Given the user's ssh authenticates to "127.0.0.1" as "acme"
    Given a config in scope project and layer base, with these marketplaces:
      | name  | source                             | autoupdate |
      | tools | ssh://git@127.0.0.1/acme/tools.git |            |
    When the user runs "/claude:plugin apply --scope project"
    Then the result has these fields:
      | kind                | reconcile-applied-cascade |
      | severity            | info                      |
      | needs reload        | false                     |
      | tally label         | Reconcile                 |
      | tally failures      | 0                         |
      | tally warnings      | 0                         |
      | tally success count | 1                         |
    Then the result lists these marketplaces:
      | name  | scope   | status |
      | tools | project | added  |
    Then the user's ssh receives these launches:
      | argv                                                                                                                  |
      | -o BatchMode=yes -o StrictHostKeyChecking=yes -o SendEnv=GIT_PROTOCOL git@127.0.0.1 git-upload-pack '/acme/tools.git' |
    Then the git host receives no request

  Scenario: Adding a github marketplace by its scp address clones it as written and names ssh
    Given the marketplace "tools" is published as a github source
    Given the user's ssh authenticates to "github.com" as "acme"
    When the user runs "/claude:plugin marketplace add git@github.com:acme/tools.git --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope   | status | clone note | clone url                     |
      | tools | project | added  | via-ssh    | git@github.com:acme/tools.git |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name  | source                        |
      | tools | git@github.com:acme/tools.git |
    Then the user's ssh receives no launch
    Then the git host receives these requests:
      | method | path                                              | status |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/tools.git/git-upload-pack                   | 200    |
      | POST   | /acme/tools.git/git-upload-pack                   | 200    |
