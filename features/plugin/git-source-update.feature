Feature: Plugin git source update

  Updating a plugin whose source is a git repository fetches the repository's
  new revision and installs it. A loopback https git host serves the
  marketplace and plugin repositories and logs the requests Pi makes.
  A reinstall installs the revision the cached repository already holds, without a request.

  Scenario: Updating a git-source plugin fetches its new revision
    Given the git repository "ghp" holds these plugins:
      | name | version | path |
      | ghp  | 1.0.0   |      |
    Given the marketplace "gits" is published as a url source
    Given the marketplace "gits" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | ghp  | github      | ghp        | false  |
    Given the marketplace "gits" is added to the project scope
    Given the user has run "/claude:plugin install ghp@gits --scope project"
    Given the git repository "ghp" holds these plugins:
      | name | version | path |
      | ghp  | 2.0.0   |      |
    When the user runs "/claude:plugin update ghp@gits --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id       | name | status  | reasons | scope   | from  | to    |
      | gits             | project           | ghp@gits | ghp  | updated |         | project | 1.0.0 | 2.0.0 |
    Then the git host receives these requests:
      | method | path                                             | status |
      | GET    | /acme/gits.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/gits.git/git-upload-pack                   | 200    |
      | GET    | /acme/ghp.git/info/refs?service=git-upload-pack  | 200    |
      | POST   | /acme/ghp.git/git-upload-pack                    | 200    |
    Then the project scope holds these git clones:
      | clone       | origin                           | revision         |
      | marketplace | https://{git host}/acme/gits.git |                  |
      | plugin      | https://github.com/acme/ghp.git  |                  |
      | plugin      | https://github.com/acme/ghp.git  | {ghp revision 2} |
    Then the git-source plugin "ghp" installed in the project scope runs revision 2 of its repository

  Scenario: Updating a plugin to a revision the clone cache already holds makes no request
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
    Given the git repository "mono" holds these plugins:
      | name | version | path         |
      | subp | 2.0.0   | plugins/subp |
      | subq | 2.0.0   | plugins/subq |
    Given the marketplace "gits" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | subp | git-subdir  | mono       | true   |
      | subq | git-subdir  | mono       | true   |
    Given the user has run "/claude:plugin update subp@gits --scope project"
    When the user runs "/claude:plugin update subq@gits --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name | status  | reasons | scope   | from  | to    |
      | gits             | project           | subq@gits | subq | updated |         | project | 1.0.0 | 2.0.0 |
    Then the git host receives no request
    When the user starts a new pi session
    Then the session offers these skills:
      | command           | description            |
      | /skill:subp-skill | A skill of subp 2.0.0. |
      | /skill:subq-skill | A skill of subq 2.0.0. |

  Scenario: Updating a git-source plugin to a new commit with the same declared version updates it
    Given the git repository "ghp" holds these plugins:
      | name | version | path |
      | ghp  | 1.0.0   |      |
    Given the marketplace "gits" is published as a dir source
    Given the marketplace "gits" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | ghp  | github      | ghp        | false  |
    Given the marketplace "gits" is added to the project scope
    Given the user has run "/claude:plugin install ghp@gits --scope project"
    Given the git repository "ghp" holds these plugins:
      | name | version | path |
      | ghp  | 1.0.0   |      |
    When the user runs "/claude:plugin update ghp@gits --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id       | name | status  | reasons | scope   | from  | to    | from commit    | to commit      |
      | gits             | project           | ghp@gits | ghp  | updated |         | project | 1.0.0 | 1.0.0 | {ghp commit 1} | {ghp commit 2} |
    Then the git-source plugin "ghp" installed in the project scope runs revision 2 of its repository

  Scenario: Reinstalling a git-source plugin after a fetch installs the fetched revision with no request
    Given the git repository "ghp" holds these plugins:
      | name | version | path |
      | ghp  | 1.0.0   |      |
    Given the marketplace "gits" is published as a dir source
    Given the marketplace "gits" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | ghp  | github      | ghp        | false  |
    Given the marketplace "gits" is added to the project scope
    Given the user has run "/claude:plugin install ghp@gits --scope project"
    Given the git repository "ghp" holds these plugins:
      | name | version | path |
      | ghp  | 2.0.0   |      |
    Given the user has run "/claude:plugin fetch ghp@gits --scope project"
    When the user runs "/claude:plugin reinstall ghp@gits --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id       | name | status      | reasons | scope   | from  | version |
      | gits             | project           | ghp@gits | ghp  | reinstalled |         | project | 1.0.0 | 2.0.0   |
    Then the git host receives no request
    Then the git-source plugin "ghp" installed in the project scope runs revision 2 of its repository
    Then the project scope holds these git clones:
      | clone  | origin                          | revision         |
      | plugin | https://github.com/acme/ghp.git |                  |
      | plugin | https://github.com/acme/ghp.git | {ghp revision 2} |

  Scenario: Reinstalling a git-source plugin that a fetch moved to a new commit at the same version names both commits
    Given the git repository "ghp" holds these plugins:
      | name | version | path |
      | ghp  | 1.0.0   |      |
    Given the marketplace "gits" is published as a dir source
    Given the marketplace "gits" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | ghp  | github      | ghp        | false  |
    Given the marketplace "gits" is added to the project scope
    Given the user has run "/claude:plugin install ghp@gits --scope project"
    Given the git repository "ghp" holds these plugins:
      | name | version | path |
      | ghp  | 1.0.0   |      |
    Given the user has run "/claude:plugin fetch ghp@gits --scope project"
    When the user runs "/claude:plugin reinstall ghp@gits --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id       | name | status      | reasons | scope   | from  | version | from commit    | to commit      |
      | gits             | project           | ghp@gits | ghp  | reinstalled |         | project | 1.0.0 | 1.0.0   | {ghp commit 1} | {ghp commit 2} |
    Then the git host receives no request
    Then the git-source plugin "ghp" installed in the project scope runs revision 2 of its repository

  Scenario Outline: An unpinned git-source plugin fails <verb> as lock held while another process holds the state lock
    Given the git repository "ghp" holds these plugins:
      | name | version | path |
      | ghp  | 1.0.0   |      |
    Given the marketplace "gits" is published as a dir source
    Given the marketplace "gits" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | ghp  | github      | ghp        | false  |
    Given the marketplace "gits" is added to the project scope
    Given the user has run "/claude:plugin install ghp@gits --scope project"
    Given another process holds the state lock of the project scope
    When the user runs "/claude:plugin <verb> ghp@gits --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id       | name | status | version | reasons   | scope   | cause chain                                                                                                                                                                                | cause truncated | leaks | rollback partial |
      | gits             | project           | ghp@gits | ghp  | failed | 1.0.0   | lock held | project | Another pi-claude-marketplace operation is in progress for project scope ({project dir}/.pi/pi-claude-marketplace/.state-lock). Retry after it completes., Lock file is already being held | false           |       |                  |
    Then the git host receives no request
    Then the git-source plugin "ghp" installed in the project scope runs revision 1 of its repository

    Examples:
      | verb      |
      | update    |
      | reinstall |

  Scenario Outline: An update fails as <reason> when the git host <refusal> and keeps the installed revision
    Given the git repository "ghp" holds these plugins:
      | name | version | path |
      | ghp  | 1.0.0   |      |
    Given the marketplace "gits" is published as a dir source
    Given the marketplace "gits" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | ghp  | github      | ghp        | false  |
    Given the marketplace "gits" is added to the project scope
    Given the user has run "/claude:plugin install ghp@gits --scope project"
    Given the git repository "ghp" holds these plugins:
      | name | version | path |
      | ghp  | 2.0.0   |      |
    Given the git host <refusal> for the plugin "ghp"
    When the user runs "/claude:plugin update ghp@gits --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id       | name | status | reasons  | scope   | version | leaks | rollback partial | cause chain   | cause truncated |
      | gits             | project           | ghp@gits | ghp  | failed | <reason> | project | 1.0.0   |       |                  | <cause chain> | false           |
    Then the git host receives these requests:
      | method | path                                            | status   |
      | GET    | /acme/ghp.git/info/refs?service=git-upload-pack | <status> |
    Then the git-source plugin "ghp" installed in the project scope runs revision 1 of its repository

    Examples:
      | refusal              | reason              | status  | cause chain                                                                  |
      | answers 404          | source missing      | 404     | HTTP Error: 404 Not Found, fetched https://{git host}/acme/ghp.git           |
      | drops the connection | network unreachable | dropped | socket hang up, fetched https://{git host}/acme/ghp.git                      |
      | answers 503          | network error       | 503     | HTTP Error: 503 Service Unavailable, fetched https://{git host}/acme/ghp.git |
