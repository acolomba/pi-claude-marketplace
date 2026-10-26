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
      | marketplace name | marketplace scope | id            | name     | status    | reasons | scope   | version |
      | gits             | project           | <plugin>@gits | <plugin> | installed |         | project | 1.0.0   |
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
      | marketplace name | marketplace scope | id        | name | status    | reasons | scope   | version |
      | gits             | project           | subq@gits | subq | installed |         | project | 1.0.0   |
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
      | marketplace name | marketplace scope | id        | name | status      | reasons | scope   | version |
      | gits             | project           | subp@gits | subp | uninstalled |         | project | 1.0.0   |
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
      | marketplace name | marketplace scope | id       | name | status      | reasons | scope   | version |
      | gits             | project           | ghp@gits | ghp  | uninstalled |         | project | 1.0.0   |
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

  Scenario Outline: An install fails on the dependency as <reason> when the git host <refusal> for the dependency and installs nothing
    Given the git repository "ghp" holds these plugins:
      | name | version | path |
      | ghp  | 1.0.0   |      |
    Given the marketplace "gits" is published as a dir source
    Given the marketplace "gits" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | ghp          |
      | ghp  | 1.0.0   |              |
    Given the marketplace "gits" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | ghp  | github      | ghp        | false  |
    Given the marketplace "gits" is added to the project scope
    Given the git host <refusal> for the plugin "ghp"
    When the user runs "/claude:plugin install app@gits --scope project"
    Then the result has these fields:
      | kind         | cascade                             |
      | severity     | error                               |
      | needs reload | false                               |
      | summary      | Some plugin operations have failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id       | name     | status | reasons           | scope   | leaks | rollback partial | cause chain   | cause truncated |
      | gits             | project           | app@gits | app      | failed | dependency failed | project |       |                  |               |                 |
      | gits             | project           | ghp@gits | ghp@gits | failed | <reason>          | project |       |                  | <cause chain> | false           |
    Then the git host receives these requests:
      | method | path                                            | status   |
      | GET    | /acme/ghp.git/info/refs?service=git-upload-pack | <status> |
    Then the project scope has no installed plugins
    Then the project scope holds no git clones

    Examples:
      | refusal              | reason              | status  | cause chain                                                                  |
      | answers 404          | source missing      | 404     | HTTP Error: 404 Not Found, fetched https://{git host}/acme/ghp.git           |
      | drops the connection | network unreachable | dropped | socket hang up, fetched https://{git host}/acme/ghp.git                      |
      | answers 503          | network error       | 503     | HTTP Error: 503 Service Unavailable, fetched https://{git host}/acme/ghp.git |

  Scenario: Apply reports a declared plugin whose clone the git host refuses as source missing
    Given the git repository "ghp" holds these plugins:
      | name | version | path |
      | ghp  | 1.0.0   |      |
    Given the marketplace "gits" is published as a dir source
    Given the marketplace "gits" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | ghp  | github      | ghp        | false  |
    Given the marketplace "gits" is added to the project scope
    Given the git host answers 404 for the plugin "ghp"
    Given a config in scope project and layer base, with these plugins:
      | marketplace | plugin | enabled |
      | gits        | ghp    |         |
    When the user runs "/claude:plugin apply --scope project"
    Then the result has these fields:
      | kind           | reconcile-applied-cascade      |
      | severity       | error                          |
      | needs reload   | false                          |
      | summary        | A plugin operation has failed. |
      | tally label    | Reconcile                      |
      | tally failures | 1                              |
      | tally warnings | 0                              |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id       | name | status | reasons        | scope   | leaks | rollback partial |
      | gits             | project           | ghp@gits | ghp  | failed | source missing | project |       |                  |
    Then the project scope has no installed plugins
    When the user starts a new pi session
    Then the session reports these results:
      | kind    | severity | needs reload | needs apply | tally label       | tally failures | tally warnings | tally success count |
      | cascade | info     | false        | true        | Reconcile pending | 0              | 0              | 1                   |
      | cascade | info     | false        | true        | Reconcile pending | 0              | 0              | 1                   |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id       | name | status       | reasons | scope   |
      | gits             | project           | ghp@gits | ghp  | will install |         | project |
      | gits             | project           | ghp@gits | ghp  | will install |         | project |
    Then the session offers no skills

  Scenario: Apply reports a declared plugin whose dependency's clone the git host refuses as dependency failed
    Given the git repository "ghp" holds these plugins:
      | name | version | path |
      | ghp  | 1.0.0   |      |
    Given the marketplace "gits" is published as a dir source
    Given the marketplace "gits" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | ghp          |
      | ghp  | 1.0.0   |              |
    Given the marketplace "gits" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | ghp  | github      | ghp        | false  |
    Given the marketplace "gits" is added to the project scope
    Given the git host answers 404 for the plugin "ghp"
    Given a config in scope project and layer base, with these plugins:
      | marketplace | plugin | enabled |
      | gits        | app    |         |
    When the user runs "/claude:plugin apply --scope project"
    Then the result has these fields:
      | kind           | reconcile-applied-cascade      |
      | severity       | error                          |
      | needs reload   | false                          |
      | summary        | A plugin operation has failed. |
      | tally label    | Reconcile                      |
      | tally failures | 1                              |
      | tally warnings | 0                              |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id       | name | status | reasons           | scope   | leaks | rollback partial | cause chain                                                        | cause truncated |
      | gits             | project           | app@gits | app  | failed | dependency failed | project |       |                  | HTTP Error: 404 Not Found, fetched https://{git host}/acme/ghp.git | false           |
    Then the project scope has no installed plugins
    When the user starts a new pi session
    Then the session reports these results:
      | kind    | severity | needs reload | needs apply | tally label       | tally failures | tally warnings | tally success count |
      | cascade | info     | false        | true        | Reconcile pending | 0              | 0              | 1                   |
      | cascade | info     | false        | true        | Reconcile pending | 0              | 0              | 1                   |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id       | name | status       | reasons | scope   |
      | gits             | project           | app@gits | app  | will install |         | project |
      | gits             | project           | app@gits | app  | will install |         | project |
    Then the session offers no skills

  Scenario: An install of a plugin pinned to a commit its repository lacks fails as source missing and leaves nothing behind
    Given the git repository "ghp" holds these plugins:
      | name | version | path |
      | ghp  | 1.0.0   |      |
    Given the marketplace "gits" is published as a dir source
    Given the marketplace "gits" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | ghp  | github      | ghp        | true   |
    Given the marketplace "gits" pins the plugin "ghp" to a commit its repository lacks
    Given the marketplace "gits" is added to the project scope
    When the user runs "/claude:plugin install ghp@gits --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id       | name | status | reasons        | scope   | leaks | rollback partial | cause chain                                                                                       | cause truncated |
      | gits             | project           | ghp@gits | ghp  | failed | source missing | project |       |                  | A fresh clone from the git host does not hold the commit 0123456789abcdef0123456789abcdef01234567 | false           |
    Then the git host receives these requests:
      | method | path                                            | status |
      | GET    | /acme/ghp.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/ghp.git/git-upload-pack                   | 200    |
    Then the project scope has no installed plugins
    Then the project scope holds no git clones

  Scenario: A plugin pinned to a commit only a tag reaches installs through the clone of the ref the marketplace names
    Given the git repository "ghp" holds these plugins:
      | name | version | path |
      | ghp  | 1.0.0   |      |
    Given the git repository "ghp" has a revision only the tag "v2.0.0" reaches, holding these plugins:
      | name | version | path |
      | ghp  | 2.0.0   |      |
    Given the marketplace "gits" is published as a dir source
    Given the marketplace "gits" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | ghp  | github      | ghp        | true   |
    Given the marketplace "gits" names the ref "main" for the plugin "ghp"
    Given the marketplace "gits" is added to the project scope
    When the user runs "/claude:plugin install ghp@gits --scope project"
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id       | name | status    | reasons | scope   | version |
      | gits             | project           | ghp@gits | ghp  | installed |         | project | 2.0.0   |
    Then the git host receives these requests:
      | method | path                                            | status |
      | GET    | /acme/ghp.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/ghp.git/git-upload-pack                   | 200    |
      | GET    | /acme/ghp.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/ghp.git/git-upload-pack                   | 200    |
    Then the git-source plugin "ghp" installed in the project scope runs revision 2 of its repository
    When the user starts a new pi session
    Then the session offers these skills:
      | command          | description           |
      | /skill:ghp-skill | A skill of ghp 2.0.0. |

  Scenario: Clone cleanup keeps an installed plugin's copy and mirror and removes a mirror no installation uses
    Given the git repository "ghp" holds these plugins:
      | name | version | path |
      | ghp  | 1.0.0   |      |
    Given the git repository "urlp" holds these plugins:
      | name | version | path |
      | urlp | 1.0.0   |      |
    Given the marketplace "gits" is published as a dir source
    Given the marketplace "gits" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "gits" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | ghp  | github      | ghp        | false  |
      | urlp | url         | urlp       | false  |
    Given the marketplace "gits" is added to the project scope
    Given the user has run "/claude:plugin install demo@gits --scope project"
    Given the user has run "/claude:plugin install urlp@gits --scope project"
    Given the user has run "/claude:plugin fetch ghp@gits --scope project"
    When the user runs "/claude:plugin uninstall demo@gits --scope project"
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name | status      | reasons | scope   | version |
      | gits             | project           | demo@gits | demo | uninstalled |         | project | 1.0.0   |
    Then the project scope holds these git clones:
      | clone  | origin                           | revision          |
      | plugin | https://{git host}/acme/urlp.git |                   |
      | plugin | https://{git host}/acme/urlp.git | {urlp revision 1} |
    Then the git-source plugin "urlp" installed in the project scope runs revision 1 of its repository

  Scenario: A git-source plugin that declares no version records the first 12 hex digits of its commit
    Given the git repository "ghp" holds these plugins:
      | name | version | path |
      | ghp  | 1.0.0   |      |
    Given the git-source plugin "ghp" of the git repository "ghp" declares no version
    Given the marketplace "gits" is published as a dir source
    Given the marketplace "gits" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | ghp  | github      | ghp        | false  |
    Given the marketplace "gits" is added to the project scope
    When the user runs "/claude:plugin install ghp@gits --scope project"
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id       | name | status    | reasons | scope   | version          |
      | gits             | project           | ghp@gits | ghp  | installed |         | project | {ghp revision 2} |
    When the user runs "/claude:plugin list --scope project"
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id       | name | status    | reasons | scope   | version          |
      | gits             | project           | ghp@gits | ghp  | installed |         | project | {ghp revision 2} |
    When the user runs "/claude:plugin info ghp@gits"
    Then the result has these fields:
      | kind                           | plugin-info      |
      | marketplace details autoupdate | false            |
      | marketplace name               | gits             |
      | marketplace scope              | project          |
      | needs reload                   | false            |
      | plugin components resolved     | true             |
      | plugin components skills       | ghp-skill        |
      | plugin id                      | ghp@gits         |
      | plugin name                    | ghp              |
      | plugin reasons                 |                  |
      | plugin scope                   | project          |
      | plugin status                  | installed        |
      | plugin version                 | {ghp revision 2} |
      | severity                       | info             |

  Scenario: A git-subdir plugin that declares no version records its commit and a hash of its path
    Given the git repository "mono" holds these plugins:
      | name | version | path         |
      | subp | 1.0.0   | plugins/subp |
    Given the git-source plugin "subp" of the git repository "mono" declares no version
    Given the marketplace "gits" is published as a dir source
    Given the marketplace "gits" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | subp | git-subdir  | mono       | false  |
    Given the marketplace "gits" is added to the project scope
    When the user runs "/claude:plugin install subp@gits --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name | status    | reasons | scope   | version                    |
      | gits             | project           | subp@gits | subp | installed |         | project | {mono revision 2}-3989e95a |

  Scenario: A pinned plugin of the anthropic-plugin-directory marketplace records its version with its pin
    Given the git repository "dirp" holds these plugins:
      | name | version | path |
      | dirp | 1.0.0   |      |
    Given the marketplace "anthropic-plugin-directory" is published as a dir source
    Given the marketplace "anthropic-plugin-directory" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | dirp | github      | dirp       | true   |
    Given the marketplace "anthropic-plugin-directory" is added to the project scope
    When the user runs "/claude:plugin install dirp@anthropic-plugin-directory --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name           | marketplace scope | id                              | name | status    | reasons | scope   | version                 |
      | anthropic-plugin-directory | project           | dirp@anthropic-plugin-directory | dirp | installed |         | project | 1.0.0-{dirp revision 1} |

  Scenario: A pinned plugin of the anthropic-plugin-directory marketplace lists as installed, not upgradable
    Given the git repository "dirp" holds these plugins:
      | name | version | path |
      | dirp | 1.0.0   |      |
    Given the marketplace "anthropic-plugin-directory" is published as a dir source
    Given the marketplace "anthropic-plugin-directory" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | dirp | github      | dirp       | true   |
    Given the marketplace "anthropic-plugin-directory" is added to the project scope
    Given the user has run "/claude:plugin install dirp@anthropic-plugin-directory --scope project"
    When the user runs "/claude:plugin list --scope project"
    Then the result lists these plugins:
      | marketplace name           | marketplace scope | id                              | name | status    | reasons | scope   | version                 |
      | anthropic-plugin-directory | project           | dirp@anthropic-plugin-directory | dirp | installed |         | project | 1.0.0-{dirp revision 1} |
