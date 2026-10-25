Feature: Plugin fetch

  Fetch refreshes the cached copy of each git-source plugin a marketplace offers,
  installed or not, without installing a new version. A loopback https git host
  serves the plugin repositories and logs the requests Pi makes.

  Scenario: Fetching a plugin succeeds again once the git host serves its repository again
    Given the git repository "ghp" holds these plugins:
      | name | version | path |
      | ghp  | 1.0.0   |      |
    Given the marketplace "gits" is published as a dir source
    Given the marketplace "gits" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | ghp  | github      | ghp        | false  |
    Given the marketplace "gits" is added to the project scope
    Given the user has run "/claude:plugin install ghp@gits --scope project"
    Given the git host answers 404 for the plugin "ghp"
    Given the user has run "/claude:plugin fetch ghp@gits --scope project", which failed
    Given the git host serves the plugin "ghp" again
    When the user runs "/claude:plugin fetch ghp@gits --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id       | name | status    | reasons |
      | gits             | project           | ghp@gits | ghp  | available |         |
    Then the git host receives these requests:
      | method | path                                            | status |
      | GET    | /acme/ghp.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/ghp.git/git-upload-pack                   | 200    |

  Scenario: Fetching a git-source plugin downloads its new revision from the git host
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
    When the user runs "/claude:plugin fetch ghp@gits --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id       | name | status    | reasons |
      | gits             | project           | ghp@gits | ghp  | available |         |
    Then the git host receives these requests:
      | method | path                                            | status |
      | GET    | /acme/ghp.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/ghp.git/git-upload-pack                   | 200    |
    Then the fetched copy of the plugin "ghp" in the project scope holds revision 2 of its repository

  Scenario: A fetch installs no new version, so the plugin list shows the installed one as upgradable
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
    When the user runs "/claude:plugin list --scope project"
    Then the result has these fields:
      | kind                | cascade     |
      | severity            | info        |
      | needs reload        | false       |
      | tally label         | Plugin list |
      | tally failures      | 0           |
      | tally warnings      | 0           |
      | tally success count | 1           |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id       | name | status     | reasons | scope   | version |
      | gits             | project           | ghp@gits | ghp  | upgradable |         | project | 1.0.0   |
    Then the git host receives no request

  Scenario: A fetch leaves the installed plugin running the revision it installed until an update
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
    When the user runs "/claude:plugin fetch ghp@gits --scope project"
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id       | name | status    | reasons |
      | gits             | project           | ghp@gits | ghp  | available |         |
    Then the fetched copy of the plugin "ghp" in the project scope holds revision 2 of its repository
    Then the git-source plugin "ghp" installed in the project scope runs revision 1 of its repository
    Then the project scope holds these git clones:
      | clone  | origin                          | revision         |
      | plugin | https://github.com/acme/ghp.git |                  |
      | plugin | https://github.com/acme/ghp.git | {ghp revision 1} |
    When the user starts a new pi session
    Then the session reports these results:
      | kind    | severity | needs reload | needs apply | tally label       | tally failures | tally warnings | tally success count |
      | cascade | info     | false        | true        | Reconcile pending | 0              | 0              | 1                   |
      | cascade | info     | false        | true        | Reconcile pending | 0              | 0              | 1                   |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id       | name | status      | reasons | scope   | from  | to    |
      | gits             | project           | ghp@gits | ghp  | will update |         | project | 1.0.0 | 2.0.0 |
      | gits             | project           | ghp@gits | ghp  | will update |         | project | 1.0.0 | 2.0.0 |
    Then the session offers these skills:
      | command          | description           |
      | /skill:ghp-skill | A skill of ghp 1.0.0. |

  Scenario: Fetching a marketplace fetches each git-source plugin and reports the one the git host refuses
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
      | urlp | url         | urlp       | true   |
    Given the marketplace "gits" is added to the project scope
    Given the git host answers 404 for the plugin "ghp"
    When the user runs "/claude:plugin fetch @gits --scope project"
    Then the result has these fields:
      | kind                | cascade                        |
      | severity            | error                          |
      | needs reload        | false                          |
      | summary             | A plugin operation has failed. |
      | tally label         | Plugin fetch                   |
      | tally failures      | 1                              |
      | tally warnings      | 0                              |
      | tally success count | 2                              |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name | status    | reasons        | scope   | version | cause chain                                                        | cause truncated | leaks | rollback partial |
      | gits             | project           | demo@gits | demo | skipped   | up-to-date     | project | 1.0.0   |                                                                    |                 |       |                  |
      | gits             | project           | ghp@gits  | ghp  | failed    | source missing | project |         | HTTP Error: 404 Not Found, fetched https://{git host}/acme/ghp.git | false           |       |                  |
      | gits             | project           | urlp@gits | urlp | available |                |         |         |                                                                    |                 |       |                  |
    Then the git host receives these requests:
      | method | path                                             | status |
      | GET    | /acme/ghp.git/info/refs?service=git-upload-pack  | 404    |
      | GET    | /acme/urlp.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/urlp.git/git-upload-pack                   | 200    |
    Then the project scope holds these git clones:
      | clone  | origin                           | revision          |
      | plugin | https://{git host}/acme/urlp.git | {urlp revision 1} |

  Scenario: A bare fetch fetches the git-source plugins of every marketplace in the scope
    Given the git repository "ghp" holds these plugins:
      | name | version | path |
      | ghp  | 1.0.0   |      |
    Given the git repository "urlp" holds these plugins:
      | name | version | path |
      | urlp | 1.0.0   |      |
    Given the marketplace "gits" is published as a dir source
    Given the marketplace "gits" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | ghp  | github      | ghp        | false  |
    Given the marketplace "more" is published as a dir source
    Given the marketplace "more" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | urlp | url         | urlp       | false  |
    Given the git repository "mono" holds these plugins:
      | name | version | path         |
      | subp | 1.0.0   | plugins/subp |
    Given the marketplace "others" is published as a dir source
    Given the marketplace "others" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | subp | git-subdir  | mono       | false  |
    Given the marketplace "gits" is added to the project scope
    Given the marketplace "more" is added to the project scope
    Given the marketplace "others" is added to the user scope
    When the user runs "/claude:plugin fetch --scope project"
    Then the result has these fields:
      | kind                | cascade      |
      | severity            | info         |
      | needs reload        | false        |
      | tally label         | Plugin fetch |
      | tally failures      | 0            |
      | tally warnings      | 0            |
      | tally success count | 2            |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name | status    | reasons |
      | gits             | project           | ghp@gits  | ghp  | available |         |
      | more             | project           | urlp@more | urlp | available |         |
    # A new copy of an unpinned plugin is cloned once, so each repository
    # answers one round.
    Then the git host receives these requests:
      | method | path                                             | status |
      | GET    | /acme/ghp.git/info/refs?service=git-upload-pack  | 200    |
      | POST   | /acme/ghp.git/git-upload-pack                    | 200    |
      | GET    | /acme/urlp.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/urlp.git/git-upload-pack                   | 200    |

  Scenario: Fetching a path-source plugin makes no request and reports it up to date
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" is added to the project scope
    When the user runs "/claude:plugin fetch demo@fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status  | reasons    | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | skipped | up-to-date | project | 1.0.0   |
    Then the git host receives no request

  Scenario: Fetching a pinned plugin whose clone is present makes no request and reports it up to date
    Given the git repository "mono" holds these plugins:
      | name | version | path         |
      | subp | 1.0.0   | plugins/subp |
    Given the marketplace "gits" is published as a dir source
    Given the marketplace "gits" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | subp | git-subdir  | mono       | true   |
    Given the marketplace "gits" is added to the project scope
    Given the user has run "/claude:plugin install subp@gits --scope project"
    When the user runs "/claude:plugin fetch subp@gits --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name | status  | reasons    | scope   |
      | gits             | project           | subp@gits | subp | skipped | up-to-date | project |
    Then the git host receives no request

  Scenario: Fetching a git-source plugin while another process holds the state lock fails as lock held
    Given the git repository "ghp" holds these plugins:
      | name | version | path |
      | ghp  | 1.0.0   |      |
    Given the marketplace "gits" is published as a dir source
    Given the marketplace "gits" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | ghp  | github      | ghp        | false  |
    Given the marketplace "gits" is added to the project scope
    Given another process holds the state lock of the project scope
    When the user runs "/claude:plugin fetch ghp@gits --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id       | name | status | reasons   | scope   | cause chain                                                                                                                                                                                | cause truncated | leaks | rollback partial |
      | gits             | project           | ghp@gits | ghp  | failed | lock held | project | Another pi-claude-marketplace operation is in progress for project scope ({project dir}/.pi/pi-claude-marketplace/.state-lock). Retry after it completes., Lock file is already being held | false           |       |                  |
    Then the git host receives no request
    Then the project scope holds no git clones
