Feature: Plugin git source

  A plugin whose source is a git repository installs from a clone of that repository,
  and the git host's request log shows when Pi reaches the network.
  A loopback https git host serves the plugin repositories.

  Scenario Outline: Installing a plugin from a <plugin source kind> source clones its repository from the git host
    Given the git repository "<repository>" holds these plugins:
      | name     | version | path   |
      | <plugin> | 1.0.0   | <path> |
    Given the marketplace "gits" is published as a dir source
    Given the marketplace "gits" offers these plugins from git repositories:
      | name     | source kind          | repository   | pinned |
      | <plugin> | <plugin source kind> | <repository> | false  |
    Given the marketplace "gits" is added to the project scope
    When the user runs "/claude:plugin install <plugin>@gits --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name     | status    | reasons | scope   | version                   |
      | gits             | project           | <plugin>@gits | <plugin> | installed |         | project | {<repository> revision 1} |
    Then the git host receives these requests:
      | method | path                                                     | status |
      | GET    | /acme/<repository>.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/<repository>.git/git-upload-pack                   | 200    |
    When the user starts a new pi session
    Then the session offers these skills:
      | command               | description                |
      | /skill:<plugin>-skill | A skill of <plugin> 1.0.0. |

    Examples:
      | plugin source kind | plugin | repository | path         |
      | github             | ghp    | ghp        |              |
      | url                | urlp   | urlp       |              |
      | git-subdir         | subp   | mono       | plugins/subp |

  Scenario: A plugin pinned to the commit another installed plugin was cloned at installs with no request
    Given the git repository "mono" holds these plugins:
      | name | version | path         |
      | subp | 1.0.0   | plugins/subp |
      | subq | 1.0.0   | plugins/subq |
    Given the marketplace "gits" is published as a dir source
    Given the marketplace "gits" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | subp | git-subdir  | mono       | true   |
      | subq | git-subdir  | mono       | true   |
    Given the marketplace "gits" is added to the project scope
    Given the user has run "/claude:plugin install subp@gits --scope project"
    When the user runs "/claude:plugin install subq@gits --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name | status    | reasons | scope   | version           |
      | gits             | project           | subq@gits | subq | installed |         | project | {mono revision 1} |
    Then the git host receives no request

  Scenario: Uninstalling one of two plugins pinned to one commit keeps the clone the other still uses
    Given the git repository "mono" holds these plugins:
      | name | version | path         |
      | subp | 1.0.0   | plugins/subp |
      | subq | 1.0.0   | plugins/subq |
    Given the marketplace "gits" is published as a dir source
    Given the marketplace "gits" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | subp | git-subdir  | mono       | true   |
      | subq | git-subdir  | mono       | true   |
    Given the marketplace "gits" is added to the project scope
    Given the user has run "/claude:plugin install subp@gits --scope project"
    Given the user has run "/claude:plugin install subq@gits --scope project"
    When the user runs "/claude:plugin uninstall subp@gits --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name | status      | reasons | scope   | version           |
      | gits             | project           | subp@gits | subp | uninstalled |         | project | {mono revision 1} |
    Then the project scope holds these git clones:
      | clone  | origin                           | revision          |
      | plugin | https://{git host}/acme/mono.git | {mono revision 1} |

  Scenario: Uninstalling the only installation of a git-source plugin removes its clone
    Given the git repository "ghp" holds these plugins:
      | name | version | path |
      | ghp  | 1.0.0   |      |
    Given the marketplace "gits" is published as a dir source
    Given the marketplace "gits" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | ghp  | github      | ghp        | false  |
    Given the marketplace "gits" is added to the project scope
    Given the user has run "/claude:plugin install ghp@gits --scope project"
    When the user runs "/claude:plugin uninstall ghp@gits --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id       | name | status      | reasons | scope   | version          |
      | gits             | project           | ghp@gits | ghp  | uninstalled |         | project | {ghp revision 1} |
    Then the project scope holds no git clones

  Scenario Outline: An install fails as <reason> when the git host <refusal> and leaves nothing behind
    Given the git repository "ghp" holds these plugins:
      | name | version | path |
      | ghp  | 1.0.0   |      |
    Given the marketplace "gits" is published as a dir source
    Given the marketplace "gits" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | ghp  | github      | ghp        | false  |
    Given the marketplace "gits" is added to the project scope
    Given the git host <refusal> for the plugin "ghp"
    When the user runs "/claude:plugin install ghp@gits --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id       | name | status | reasons  | scope   | leaks | rollback partial | cause chain   | cause truncated |
      | gits             | project           | ghp@gits | ghp  | failed | <reason> | project |       |                  | <cause chain> | false           |
    Then the git host receives these requests:
      | method | path                                            | status   |
      | GET    | /acme/ghp.git/info/refs?service=git-upload-pack | <status> |
    Then the project scope has no installed plugins
    Then the project scope holds no git clones
    When the user starts a new pi session
    Then the session offers no skills

    Examples:
      | refusal              | reason              | status  | cause chain                                                                  |
      | answers 404          | source missing      | 404     | HTTP Error: 404 Not Found, fetched https://{git host}/acme/ghp.git           |
      | drops the connection | network unreachable | dropped | socket hang up, fetched https://{git host}/acme/ghp.git                      |
      | answers 503          | network error       | 503     | HTTP Error: 503 Service Unavailable, fetched https://{git host}/acme/ghp.git |

  Scenario: An install fails as authentication required when the git host asks for a credential the user has not stored
    Given the git repository "ghp" holds these plugins:
      | name | version | path |
      | ghp  | 1.0.0   |      |
    Given the marketplace "gits" is published as a dir source
    Given the marketplace "gits" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | ghp  | github      | ghp        | false  |
    Given the marketplace "gits" is added to the project scope
    Given the git host requires the user "alice" with the password "secret" for the plugin "ghp"
    When the user runs "/claude:plugin install ghp@gits --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id       | name | status | reasons                 | scope   | leaks | rollback partial |
      | gits             | project           | ghp@gits | ghp  | failed | authentication required | project |       |                  |
    Then the git host receives these requests:
      | method | path                                            | status |
      | GET    | /acme/ghp.git/info/refs?service=git-upload-pack | 401    |
    Then the project scope has no installed plugins
    Then the project scope holds no git clones
    When the user starts a new pi session
    Then the session offers no skills
