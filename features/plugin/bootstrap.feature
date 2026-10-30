Feature: Plugin bootstrap

  Bootstrap adds Claude Code's official marketplace to the user scope, where its
  autoupdate is on by default. A loopback https git host stands in for GitHub and
  serves the official marketplace through the GitHub base override.

  Scenario: Bootstrapping adds the official marketplace to the user scope with its autoupdate on by default
    Given the marketplace "claude-plugins-official" is published as the official marketplace
    When the user runs "/claude:plugin bootstrap"
    Then the command reports these results:
      | kind    | severity | needs reload |
      | cascade | info     | false        |
    Then the results list these marketplaces and plugins:
      | marketplace name        | marketplace scope | marketplace status |
      | claude-plugins-official | user              | added              |
    Then the git host receives these requests:
      | method | path                                                                      | status |
      | GET    | /anthropics/claude-plugins-official.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /anthropics/claude-plugins-official.git/git-upload-pack                   | 200    |
    Then the "claude-plugins.json" file of the user scope declares these marketplaces:
      | name                    | source                             |
      | claude-plugins-official | anthropics/claude-plugins-official |
    Then the "claude-plugins.json" file of the project scope does not exist

  Scenario: Bootstrapping a second time leaves the official marketplace as it is
    Given the marketplace "claude-plugins-official" is published as the official marketplace
    Given the user has run "/claude:plugin bootstrap"
    When the user runs "/claude:plugin bootstrap"
    Then the command reports these results:
      | kind    | severity | needs reload |
      | cascade | info     | false        |
    Then the results list these marketplaces and plugins:
      | marketplace name        | marketplace scope | marketplace status | marketplace reasons |
      | claude-plugins-official | user              | skipped            | already added       |
    Then the git host receives no request
    Then the "claude-plugins.json" file of the user scope declares these marketplaces:
      | name                    | source                             |
      | claude-plugins-official | anthropics/claude-plugins-official |

  Scenario: Bootstrapping keeps the autoupdate setting the user turned off for the official marketplace
    Given the marketplace "claude-plugins-official" is published as the official marketplace
    Given the user has run "/claude:plugin bootstrap"
    Given the user has run "/claude:plugin marketplace noautoupdate claude-plugins-official --scope user"
    When the user runs "/claude:plugin bootstrap"
    Then the command reports these results:
      | kind    | severity | needs reload |
      | cascade | info     | false        |
    Then the results list these marketplaces and plugins:
      | marketplace name        | marketplace scope | marketplace status | marketplace reasons |
      | claude-plugins-official | user              | skipped            | already added       |
    Then the git host receives no request
    Then the "claude-plugins.json" file of the user scope declares these marketplaces:
      | name                    | source                             | autoupdate |
      | claude-plugins-official | anthropics/claude-plugins-official | false      |

  Scenario: Bootstrapping installs the missing dependency of an installed plugin that the official marketplace offers
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | app  | 1.0.0   |
    Given the marketplace "tools" is added to the user scope
    Given the user has run "/claude:plugin install app@tools --scope user"
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies                |
      | app  | 1.0.0   | lib@claude-plugins-official |
    Given the marketplace "tools" allows dependencies on the marketplace "claude-plugins-official"
    Given the marketplace "claude-plugins-official" is published as the official marketplace
    Given the marketplace "claude-plugins-official" offers these plugins:
      | name | version |
      | lib  | 1.0.0   |
    When the user runs "/claude:plugin bootstrap"
    Then the command reports these results:
      | kind    | severity | needs reload |
      | cascade | info     | true         |
    Then the results list these marketplaces and plugins:
      | marketplace name        | marketplace scope | marketplace status | id                          | name                        | status    | reasons              | scope | version |
      | claude-plugins-official | user              | added              | lib@claude-plugins-official | lib@claude-plugins-official | installed | dependency installed | user  | 1.0.0   |
    Then the installation record of the user scope holds these plugins:
      | id                          | version | enabled |
      | app@tools                   | 1.0.0   | true    |
      | lib@claude-plugins-official | 1.0.0   | true    |

  Scenario: A bootstrap whose official marketplace is missing reports why and records nothing
    Given the marketplace "claude-plugins-official" is published as the official marketplace
    Given the git host answers 404 for the marketplace "claude-plugins-official"
    When the user runs "/claude:plugin bootstrap"
    Then the result has these fields:
      | kind         | cascade                      |
      | severity     | error                        |
      | needs reload | false                        |
      | summary      | Some operations have failed. |
    Then the result lists these plugins:
      | marketplace name                   | marketplace scope | marketplace status | id                                 | name                               | status | reasons        | scope | cause chain                                                                                  | cause truncated | leaks | rollback partial |
      | anthropics/claude-plugins-official | user              | failed             | anthropics/claude-plugins-official | anthropics/claude-plugins-official | failed | source missing | user  | HTTP Error: 404 Not Found, fetched https://{git host}/anthropics/claude-plugins-official.git | false           |       |                  |
    Then the "claude-plugins.json" file of the user scope does not exist
    Then the user scope holds no git clones

  Scenario Outline: Bootstrap rejects <rejected> with its usage
    When the user runs "/claude:plugin bootstrap <arguments>"
    Then the result has these fields:
      | kind         | usage-error                     |
      | severity     | error                           |
      | needs reload | false                           |
      | message      | <message>                       |
      | usage        | Usage: /claude:plugin bootstrap |

    Examples:
      | rejected                | arguments       | message                                                          |
      | an argument             | official        | bootstrap takes no arguments.                                    |
      | a flag it does not take | --bogus         | Unknown flag: "--bogus".                                         |
      | the --local flag        | --local         | Unknown flag: "--local".                                         |
      | the user scope          | --scope user    | bootstrap does not accept --scope; it always targets user scope. |
      | the project scope       | --scope project | bootstrap does not accept --scope; it always targets user scope. |
      | a bad scope value       | --scope bad     | Invalid --scope value: "bad". Must be "user" or "project".       |
      | a scope with no value   | --scope         | --scope requires a value: "user" or "project".                   |
