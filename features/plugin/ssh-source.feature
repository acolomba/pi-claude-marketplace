Feature: Plugin ssh source

  A plugin whose source names an ssh git address installs over the user's ssh, and a
  git-subdir address that Claude Code's validator refuses never reaches git (D-SG-17).
  An ssh stand-in first on Pi's path serves the git host's repositories, and records every launch.

  Scenario: Installing a plugin whose url source is a git@host:path address clones it over ssh
    Given the git repository "sshp" holds these plugins:
      | name | version | path |
      | sshp | 1.0.0   |      |
    Given the marketplace "gits" is published as a dir source
    Given the marketplace "gits" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | sshp | ssh         | sshp       | false  |
    Given the marketplace "gits" is added to the project scope
    Given the user's ssh authenticates to "127.0.0.1" as "acme"
    When the user runs "/claude:plugin install sshp@gits --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name | status    | reasons | scope   | version |
      | gits             | project           | sshp@gits | sshp | installed |         | project | 1.0.0   |
    Then the user's ssh receives these launches:
      | argv                                                                                                                |
      | -o BatchMode=yes -o StrictHostKeyChecking=yes -o SendEnv=GIT_PROTOCOL git@127.0.0.1 git-upload-pack 'acme/sshp.git' |
    Then the git host receives no request

  Scenario: A git-subdir source whose url is an ext:: command is refused before git runs
    Given the marketplace "gits" is published as a dir source
    Given the marketplace "gits" publishes this manifest:
      """
      {
        "name": "gits",
        "owner": { "name": "features" },
        "plugins": [
          {
            "name": "extp",
            "source": { "source": "git-subdir", "url": "ext::sh -c id", "path": "plugins/extp" }
          }
        ]
      }
      """
    Given the marketplace "gits" is added to the project scope
    When the user runs "/claude:plugin install extp@gits --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name | status      | reasons            |
      | gits             | project           | extp@gits | extp | unavailable | unsupported source |
    Then the user's ssh receives no launch
    Then the git host receives no request
