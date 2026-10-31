Feature: Plugin info

  Info on a plugin shows what a marketplace offers under that name and where
  the plugin is installed. The scenarios run the real extension in a headless
  Pi and use a local marketplace, or a loopback https git host, in place of a published one.

  Scenario: Info on a plugin installed in both scopes shows its installation in each
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" is added to the user scope
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    When the user runs "/claude:plugin info demo@fixtures"
    Then the result has these fields:
      | kind         | plugin-info-cascade |
      | severity     | info                |
      | needs reload | false               |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace details autoupdate | plugin id     | plugin name | plugin status | plugin reasons | plugin scope | plugin version | plugin components resolved | plugin components skills |
      | fixtures         | project           | false                          | demo@fixtures | demo        | installed     |                | project      | 1.0.0          | true                       | demo-skill               |
      | fixtures         | user              | false                          | demo@fixtures | demo        | installed     |                | user         | 1.0.0          | true                       | demo-skill               |

  Scenario: Info on an installed plugin shows its installed version, scope, marketplace, and skills
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 2.0.0   |
    When the user runs "/claude:plugin info demo@fixtures"
    Then the result has these fields:
      | kind                           | plugin-info   |
      | marketplace details autoupdate | false         |
      | marketplace name               | fixtures      |
      | marketplace scope              | project       |
      | needs reload                   | false         |
      | plugin components resolved     | true          |
      | plugin components skills       | demo-skill    |
      | plugin id                      | demo@fixtures |
      | plugin name                    | demo          |
      | plugin reasons                 |               |
      | plugin scope                   | project       |
      | plugin status                  | installed     |
      | plugin version                 | 1.0.0         |
      | severity                       | info          |

  Scenario: Info on a plugin that is not installed shows the skills an install would provide
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" is added to the project scope
    When the user runs "/claude:plugin info demo@fixtures"
    Then the result has these fields:
      | kind                           | plugin-info   |
      | marketplace details autoupdate | false         |
      | marketplace name               | fixtures      |
      | marketplace scope              | project       |
      | needs reload                   | false         |
      | plugin components resolved     | true          |
      | plugin components skills       | demo-skill    |
      | plugin id                      | demo@fixtures |
      | plugin name                    | demo          |
      | plugin reasons                 |               |
      | plugin status                  | available     |
      | plugin version                 | 1.0.0         |
      | severity                       | info          |

  Scenario: Info on a partially available plugin reports an unsupported component and the skills an install would keep
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has an output style
    Given the marketplace "fixtures" is added to the project scope
    When the user runs "/claude:plugin info demo@fixtures"
    Then the result has these fields:
      | kind                           | plugin-info           |
      | marketplace details autoupdate | false                 |
      | marketplace name               | fixtures              |
      | marketplace scope              | project               |
      | needs reload                   | false                 |
      | plugin components resolved     | true                  |
      | plugin components skills       | demo-skill            |
      | plugin id                      | demo@fixtures         |
      | plugin name                    | demo                  |
      | plugin reasons                 | unsupported component |
      | plugin status                  | partially-available   |
      | plugin version                 | 1.0.0                 |
      | severity                       | info                  |

  Scenario: Info on a plugin from an npm source names it unavailable as an unsupported source
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" publishes this manifest:
      """
      {
        "name": "fixtures",
        "owner": { "name": "features" },
        "plugins": [
          { "name": "npmp", "source": { "source": "npm", "package": "npmp" }, "version": "1.0.0" }
        ]
      }
      """
    Given the marketplace "fixtures" is added to the project scope
    When the user runs "/claude:plugin info npmp@fixtures"
    Then the result has these fields:
      | kind                           | plugin-info        |
      | marketplace details autoupdate | false              |
      | marketplace name               | fixtures           |
      | marketplace scope              | project            |
      | needs reload                   | false              |
      | plugin components resolved     | false              |
      | plugin id                      | npmp@fixtures      |
      | plugin name                    | npmp               |
      | plugin reasons                 | unsupported source |
      | plugin status                  | unavailable        |
      | plugin version                 | 1.0.0              |
      | severity                       | info               |

  Scenario: Info on a remote plugin that was never fetched leaves its components unresolved and makes no request
    Given the git repository "ghp" holds these plugins:
      | name | version | path |
      | ghp  | 1.0.0   |      |
    Given the marketplace "gits" is published as a url source
    Given the marketplace "gits" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | ghp  | github      | ghp        | false  |
    Given the marketplace "gits" is added to the project scope
    When the user runs "/claude:plugin info ghp@gits"
    Then the result has these fields:
      | kind                           | plugin-info |
      | marketplace details autoupdate | false       |
      | marketplace name               | gits        |
      | marketplace scope              | project     |
      | needs reload                   | false       |
      | plugin components resolved     | false       |
      | plugin id                      | ghp@gits    |
      | plugin name                    | ghp         |
      | plugin reasons                 |             |
      | plugin status                  | remote      |
      | severity                       | info        |
    Then the git host receives no request

  Scenario: Info with --fetch reads the plugin repository and reports its new revision
    Given the git repository "ghp" holds these plugins:
      | name | version | path |
      | ghp  | 1.0.0   |      |
    Given the marketplace "gits" is published as a url source
    Given the marketplace "gits" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | ghp  | github      | ghp        | false  |
    Given the marketplace "gits" is added to the project scope
    Given the user has run "/claude:plugin info ghp@gits --fetch"
    Given the git repository "ghp" holds these plugins:
      | name | version | path |
      | ghp  | 2.0.0   |      |
    When the user runs "/claude:plugin info ghp@gits --fetch"
    Then the result has these fields:
      | kind                           | plugin-info |
      | marketplace details autoupdate | false       |
      | marketplace name               | gits        |
      | marketplace scope              | project     |
      | needs reload                   | false       |
      | plugin components resolved     | true        |
      | plugin components skills       | ghp-skill   |
      | plugin id                      | ghp@gits    |
      | plugin name                    | ghp         |
      | plugin reasons                 |             |
      | plugin status                  | available   |
      | plugin version                 | 2.0.0       |
      | severity                       | info        |
    Then the git host receives these requests:
      | method | path                                            | status |
      | GET    | /acme/ghp.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/ghp.git/git-upload-pack                   | 200    |

  Scenario: Info without --fetch shows the revision fetched last and makes no request
    Given the git repository "ghp" holds these plugins:
      | name | version | path |
      | ghp  | 1.0.0   |      |
    Given the marketplace "gits" is published as a url source
    Given the marketplace "gits" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | ghp  | github      | ghp        | false  |
    Given the marketplace "gits" is added to the project scope
    Given the user has run "/claude:plugin info ghp@gits --fetch"
    Given the git repository "ghp" holds these plugins:
      | name | version | path |
      | ghp  | 2.0.0   |      |
    When the user runs "/claude:plugin info ghp@gits"
    Then the result has these fields:
      | kind                           | plugin-info |
      | marketplace details autoupdate | false       |
      | marketplace name               | gits        |
      | marketplace scope              | project     |
      | needs reload                   | false       |
      | plugin components resolved     | true        |
      | plugin components skills       | ghp-skill   |
      | plugin id                      | ghp@gits    |
      | plugin name                    | ghp         |
      | plugin reasons                 |             |
      | plugin status                  | available   |
      | plugin version                 | 1.0.0       |
      | severity                       | info        |
    Then the git host receives no request

  Scenario: Info with --fetch on an installed plugin shows the installed revision after the repository moves
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
    When the user runs "/claude:plugin info ghp@gits --fetch"
    Then the result has these fields:
      | kind                           | plugin-info |
      | marketplace details autoupdate | false       |
      | marketplace name               | gits        |
      | marketplace scope              | project     |
      | needs reload                   | false       |
      | plugin components resolved     | true        |
      | plugin components skills       | ghp-skill   |
      | plugin id                      | ghp@gits    |
      | plugin name                    | ghp         |
      | plugin reasons                 |             |
      | plugin scope                   | project     |
      | plugin status                  | installed   |
      | plugin version                 | 1.0.0       |
      | severity                       | info        |
    Then the git host receives these requests:
      | method | path                                            | status |
      | GET    | /acme/ghp.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/ghp.git/git-upload-pack                   | 200    |

  Scenario: Info on a plugin the marketplace does not offer fails as not in manifest
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" is added to the project scope
    When the user runs "/claude:plugin info nope@fixtures"
    Then the result has these fields:
      | kind                           | plugin-info                    |
      | marketplace details autoupdate | false                          |
      | marketplace name               | fixtures                       |
      | marketplace scope              | project                        |
      | needs reload                   | false                          |
      | plugin components resolved     | true                           |
      | plugin id                      | nope@fixtures                  |
      | plugin name                    | nope                           |
      | plugin reasons                 | not in manifest                |
      | plugin scope                   | project                        |
      | plugin status                  | failed                         |
      | severity                       | error                          |
      | summary                        | A plugin operation has failed. |

  Scenario: Info on a path-source plugin shows the version its plugin.json declares over its entry's
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 2.0.0   |
    Given the marketplace "fixtures" publishes this manifest:
      """
      {
        "name": "fixtures",
        "owner": { "name": "features" },
        "plugins": [{ "name": "demo", "source": "./plugins/demo", "version": "1.0.0" }]
      }
      """
    Given the marketplace "fixtures" is added to the project scope
    When the user runs "/claude:plugin info demo@fixtures"
    Then the result has these fields:
      | kind                           | plugin-info   |
      | marketplace details autoupdate | false         |
      | marketplace name               | fixtures      |
      | marketplace scope              | project       |
      | needs reload                   | false         |
      | plugin components resolved     | true          |
      | plugin components skills       | demo-skill    |
      | plugin id                      | demo@fixtures |
      | plugin name                    | demo          |
      | plugin reasons                 |               |
      | plugin status                  | available     |
      | plugin version                 | 2.0.0         |
      | severity                       | info          |

  Scenario: Info on a path-source plugin whose directory is missing names it unavailable as source missing
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" publishes this manifest:
      """
      {
        "name": "fixtures",
        "owner": { "name": "features" },
        "plugins": [{ "name": "ghost", "source": "./plugins/ghost", "version": "1.0.0" }]
      }
      """
    Given the marketplace "fixtures" is added to the project scope
    When the user runs "/claude:plugin info ghost@fixtures"
    Then the result has these fields:
      | kind                           | plugin-info    |
      | marketplace details autoupdate | false          |
      | marketplace name               | fixtures       |
      | marketplace scope              | project        |
      | needs reload                   | false          |
      | plugin components resolved     | true           |
      | plugin id                      | ghost@fixtures |
      | plugin name                    | ghost          |
      | plugin reasons                 | source missing |
      | plugin status                  | unavailable    |
      | plugin version                 | 1.0.0          |
      | severity                       | info           |

  Scenario: Info with --fetch on a plugin never fetched clones its repository with one request round
    Given the git repository "ghp" holds these plugins:
      | name | version | path |
      | ghp  | 1.0.0   |      |
    Given the marketplace "gits" is published as a url source
    Given the marketplace "gits" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | ghp  | github      | ghp        | false  |
    Given the marketplace "gits" is added to the project scope
    When the user runs "/claude:plugin info ghp@gits --fetch"
    Then the result has these fields:
      | kind                           | plugin-info |
      | marketplace details autoupdate | false       |
      | marketplace name               | gits        |
      | marketplace scope              | project     |
      | needs reload                   | false       |
      | plugin components resolved     | true        |
      | plugin components skills       | ghp-skill   |
      | plugin id                      | ghp@gits    |
      | plugin name                    | ghp         |
      | plugin reasons                 |             |
      | plugin status                  | available   |
      | plugin version                 | 1.0.0       |
      | severity                       | info        |
    Then the git host receives these requests:
      | method | path                                            | status |
      | GET    | /acme/ghp.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/ghp.git/git-upload-pack                   | 200    |

  Scenario: Info with --fetch on a plugin the git host answers with 404 names it source missing
    Given the git repository "ghp" holds these plugins:
      | name | version | path |
      | ghp  | 1.0.0   |      |
    Given the marketplace "gits" is published as a dir source
    Given the marketplace "gits" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | ghp  | github      | ghp        | false  |
    Given the marketplace "gits" is added to the project scope
    Given the git host answers 404 for the plugin "ghp"
    When the user runs "/claude:plugin info ghp@gits --fetch"
    Then the result has these fields:
      | kind                           | plugin-info    |
      | marketplace details autoupdate | false          |
      | marketplace name               | gits           |
      | marketplace scope              | project        |
      | needs reload                   | false          |
      | plugin components resolved     | false          |
      | plugin id                      | ghp@gits       |
      | plugin name                    | ghp            |
      | plugin reasons                 | source missing |
      | plugin status                  | remote         |
      | severity                       | info           |
    Then the git host receives these requests:
      | method | path                                            | status |
      | GET    | /acme/ghp.git/info/refs?service=git-upload-pack | 404    |

  Scenario: Info with --fetch while another process holds the state lock fails as lock held
    Given the git repository "ghp" holds these plugins:
      | name | version | path |
      | ghp  | 1.0.0   |      |
    Given the marketplace "gits" is published as a dir source
    Given the marketplace "gits" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | ghp  | github      | ghp        | false  |
    Given the marketplace "gits" is added to the project scope
    Given another process holds the state lock of the project scope
    When the user runs "/claude:plugin info ghp@gits --fetch"
    Then the result has these fields:
      | kind                           | plugin-info                    |
      | marketplace details autoupdate | false                          |
      | marketplace name               | gits                           |
      | marketplace scope              | project                        |
      | needs reload                   | false                          |
      | plugin components resolved     | true                           |
      | plugin id                      | ghp@gits                       |
      | plugin name                    | ghp                            |
      | plugin reasons                 | lock held                      |
      | plugin scope                   | project                        |
      | plugin status                  | failed                         |
      | severity                       | error                          |
      | summary                        | A plugin operation has failed. |
    Then the git host receives no request
