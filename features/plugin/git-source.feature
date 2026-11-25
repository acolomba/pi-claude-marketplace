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
      | POST   | /acme/<repository>.git/git-upload-pack                   | 200    |
    When the user reloads pi
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

  Scenario: A plugin whose commit a mirror an earlier version made already holds installs from a copy of the mirror with its linked skill as a link
    Given the git repository "mono" holds these plugins:
      | name | version | path         |
      | subp | 1.0.0   | plugins/subp |
      | subq | 1.0.0   | plugins/subq |
    Given the marketplace "gits" is published as a dir source
    Given the marketplace "gits" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | subp | git-subdir  | mono       | false  |
    Given the marketplace "gits" is added to the project scope
    Given the user has run "/claude:plugin install subp@gits --scope project"
    Given the plugin "subq" of the git repository "mono" links a file of its skill to another file of the skill
    Given the user has run "/claude:plugin fetch subp@gits --scope project"
    Given the plugin mirror of the git repository "mono" in the project scope has the git settings an earlier version made
    Given the marketplace "gits" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | subq | git-subdir  | mono       | false  |
    When the user runs "/claude:plugin install subq@gits --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name | status    | reasons | scope   | version |
      | gits             | project           | subq@gits | subq | installed |         | project | 1.0.0   |
    Then the git host receives these requests:
      | method | path                                             | status |
      | GET    | /acme/mono.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/mono.git/git-upload-pack                   | 200    |
    Then the git-source plugin "subq" installed in the project scope runs revision 2 of its repository
    Then the staged skill "subq-skill" of the project scope holds these supporting files:
      | file       | text               |
      | linked.txt | -> notes.txt       |
      | notes.txt  | The notes of subq. |

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
    When the user reloads pi
    Then the session offers no skills

    Examples:
      | refusal              | reason              | status  | cause chain                                                                                            |
      | answers 404          | source missing      | 404     | git clone --depth failed: repository-not-found, exit code 128, fetched https://{git host}/acme/ghp.git |
      | drops the connection | network unreachable | dropped | git clone --depth failed: network, exit code 128, fetched https://{git host}/acme/ghp.git              |
      | answers 503          | network error       | 503     | git clone --depth failed: network, exit code 128, fetched https://{git host}/acme/ghp.git              |

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
    When the user reloads pi
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
      | refusal              | reason              | status  | cause chain                                                                                            |
      | answers 404          | source missing      | 404     | git clone --depth failed: repository-not-found, exit code 128, fetched https://{git host}/acme/ghp.git |
      | drops the connection | network unreachable | dropped | git clone --depth failed: network, exit code 128, fetched https://{git host}/acme/ghp.git              |
      | answers 503          | network error       | 503     | git clone --depth failed: network, exit code 128, fetched https://{git host}/acme/ghp.git              |

  Scenario Outline: An install fails on a constrained dependency as <reason> when the git host <refusal> while its tags are read and installs nothing
    Given the git repository "ghp" holds these plugins:
      | name | version | path |
      | ghp  | 1.0.0   |      |
    Given the marketplace "gits" is published as a dir source
    Given the marketplace "gits" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | ghp@^1.0.0   |
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
      | marketplace name | marketplace scope | id       | name     | status | reasons           | scope   | leaks | rollback partial | cause chain                                                           | cause truncated |
      | gits             | project           | app@gits | app      | failed | dependency failed | project |       |                  |                                                                       |                 |
      | gits             | project           | ghp@gits | ghp@gits | failed | <reason>          | project |       |                  | Dependency "ghp@gits" could not be checked against ^1.0.0 (<reason>). | false           |
    Then the git host receives these requests:
      | method | path                                            | status   |
      | GET    | /acme/ghp.git/info/refs?service=git-upload-pack | <status> |
    Then the project scope has no installed plugins
    Then the project scope holds no git clones

    Examples:
      | refusal              | reason              | status  |
      | answers 404          | source missing      | 404     |
      | drops the connection | network unreachable | dropped |
      | answers 503          | network error       | 503     |

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
    When the user reloads pi
    Then the session reports these results:
      | kind    | severity | needs reload | needs apply | tally label       | tally failures | tally warnings | tally success count |
      | cascade | info     | false        | true        | Reconcile pending | 0              | 0              | 1                   |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id       | name | status       | reasons | scope   |
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
      | marketplace name | marketplace scope | id       | name | status | reasons           | scope   | leaks | rollback partial | cause chain                                                                                            | cause truncated |
      | gits             | project           | app@gits | app  | failed | dependency failed | project |       |                  | git clone --depth failed: repository-not-found, exit code 128, fetched https://{git host}/acme/ghp.git | false           |
    Then the project scope has no installed plugins
    When the user reloads pi
    Then the session reports these results:
      | kind    | severity | needs reload | needs apply | tally label       | tally failures | tally warnings | tally success count |
      | cascade | info     | false        | true        | Reconcile pending | 0              | 0              | 1                   |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id       | name | status       | reasons | scope   |
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
      | POST   | /acme/ghp.git/git-upload-pack                   | 200    |
      | GET    | /acme/ghp.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/ghp.git/git-upload-pack                   | 200    |
      | POST   | /acme/ghp.git/git-upload-pack                   | 200    |
      | GET    | /acme/ghp.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/ghp.git/git-upload-pack                   | 200    |
      | POST   | /acme/ghp.git/git-upload-pack                   | 200    |
    Then the project scope has no installed plugins
    Then the project scope holds no git clones

  Scenario: A pinned plugin whose git host refuses fetches by SHA installs through the unshallow fallback
    Given the git repository "ghp" holds these plugins:
      | name | version | path |
      | ghp  | 1.0.0   |      |
    Given the git repository "ghp" holds these plugins:
      | name | version | path |
      | ghp  | 2.0.0   |      |
    Given the marketplace "gits" is published as a dir source
    Given the marketplace "gits" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | ghp  | github      | ghp        | false  |
    Given the marketplace "gits" pins the plugin "ghp" to the commit "{ghp commit 1}"
    Given the git host refuses fetches by sha for the plugin "ghp"
    Given the marketplace "gits" is added to the project scope
    When the user runs "/claude:plugin install ghp@gits --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id       | name | status    | reasons | scope   | version |
      | gits             | project           | ghp@gits | ghp  | installed |         | project | 1.0.0   |
    Then the git host receives these requests:
      | method | path                                            | status |
      | GET    | /acme/ghp.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/ghp.git/git-upload-pack                   | 200    |
      | POST   | /acme/ghp.git/git-upload-pack                   | 200    |
      | GET    | /acme/ghp.git/info/refs?service=git-upload-pack | 200    |
      | GET    | /acme/ghp.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/ghp.git/git-upload-pack                   | 200    |
      | POST   | /acme/ghp.git/git-upload-pack                   | 200    |
    Then the git-source plugin "ghp" installed in the project scope runs revision 1 of its repository
    When the user starts a new pi session
    Then the session offers these skills:
      | command          | description           |
      | /skill:ghp-skill | A skill of ghp 1.0.0. |

  Scenario: Installing a plugin pinned to an abbreviated commit is refused before git runs
    Given the git repository "urlp" holds these plugins:
      | name | version | path |
      | urlp | 1.0.0   |      |
    Given the marketplace "gits" is published as a dir source
    Given the marketplace "gits" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | urlp | url         | urlp       | false  |
    Given the marketplace "gits" pins the plugin "urlp" to the commit "{urlp revision 1}"
    Given the marketplace "gits" is added to the project scope
    When the user runs "/claude:plugin install urlp@gits --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name | status      | reasons            |
      | gits             | project           | urlp@gits | urlp | unavailable | unsupported source |
    Then the project scope has no installed plugins
    Then the project scope holds no git clones
    Then the git host receives no request

  Scenario: Installing a plugin whose ref starts with a dash is refused before git runs
    Given the git repository "urlp" holds these plugins:
      | name | version | path |
      | urlp | 1.0.0   |      |
    Given the marketplace "gits" is published as a dir source
    Given the marketplace "gits" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | urlp | url         | urlp       | false  |
    Given the marketplace "gits" names the ref "-x" for the plugin "urlp"
    Given the marketplace "gits" is added to the project scope
    When the user runs "/claude:plugin install urlp@gits --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name | status      | reasons            |
      | gits             | project           | urlp@gits | urlp | unavailable | unsupported source |
    Then the project scope has no installed plugins
    Then the project scope holds no git clones
    Then the git host receives no request

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
      | POST   | /acme/ghp.git/git-upload-pack                   | 200    |
      | GET    | /acme/ghp.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/ghp.git/git-upload-pack                   | 200    |
      | POST   | /acme/ghp.git/git-upload-pack                   | 200    |
    Then the git-source plugin "ghp" installed in the project scope runs revision 2 of its repository
    When the user reloads pi
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
      | plugin | https://{git host}/acme/urlp.git | {urlp revision 1} |
      | plugin | https://{git host}/acme/urlp.git | {urlp revision 1} |
    Then the git-source plugin "urlp" installed in the project scope runs revision 1 of its repository

  Scenario: Installation records expose git revisions
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
    Then the installation record of the project scope holds these plugins:
      | id       | version          | enabled |
      | ghp@gits | {ghp revision 2} | true    |
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
    Given the marketplace "anthropic-plugin-directory" is published by the anthropics organization
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
    Given the marketplace "anthropic-plugin-directory" is published by the anthropics organization
    Given the marketplace "anthropic-plugin-directory" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | dirp | github      | dirp       | true   |
    Given the marketplace "anthropic-plugin-directory" is added to the project scope
    Given the user has run "/claude:plugin install dirp@anthropic-plugin-directory --scope project"
    When the user runs "/claude:plugin list --scope project"
    Then the result lists these plugins:
      | marketplace name           | marketplace scope | id                              | name | status    | reasons | scope   | version                 |
      | anthropic-plugin-directory | project           | dirp@anthropic-plugin-directory | dirp | installed |         | project | 1.0.0-{dirp revision 1} |

  Scenario: Installing a git-source plugin whose manifest links outside its plugin directory refuses it and installs nothing
    Given the git repository "app" holds these plugins:
      | name | version | path | dependencies |
      | app  | 1.0.0   |      | lib          |
    Given the git repository "app" links the manifest of the plugin "app" to a file outside the repository
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | lib  | 1.2.0   |              |
    Given the marketplace "tools" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | app  | url         | app        | true   |
    Given the marketplace "tools" is added to the project scope
    When the user runs "/claude:plugin install app@tools --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name | status      | reasons             |
      | tools            | project           | app@tools | app  | unavailable | unreadable manifest |
    Then the project scope has no installed plugins
    Then the project scope holds these git clones:
      | clone  | origin                          | revision         |
      | plugin | https://{git host}/acme/app.git | {app revision 2} |
