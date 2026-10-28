Feature: Plugin list

  The list shows the plugins every added marketplace offers, with each one's status
  and install scope, and its filters keep only the rows they select. The scenarios run
  the real extension in a headless Pi, with local marketplaces and a loopback git host.

  Scenario: Completion uses the installed git version
    Given the git repository "ghp" holds these plugins:
      | name | version | path |
      | ghp  | 1.0.0   |      |
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | ghp  | github      | ghp        | false  |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install ghp@tools --scope project"
    Given the marketplace "tools" publishes this manifest:
      """
      {
        "name": "tools",
        "owner": { "name": "features" },
        "plugins": [
          {
            "name": "ghp",
            "source": { "source": "github", "repo": "acme/ghp" },
            "version": "2.0.0"
          }
        ]
      }
      """
    Given the user has run "/claude:plugin marketplace update tools --scope project"
    When the user runs "/claude:plugin list --scope project"
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name | status    | reasons | scope   | version |
      | tools            | project           | ghp@tools | ghp  | installed |         | project | 1.0.0   |
    When the user requests plugin completions for "update --partial --scope project "
    Then the plugin completion set for "update --partial --scope project " is empty

  Scenario: The list shows each kind of plugin with its status and scope
    Given the git repository "ghp" holds these plugins:
      | name | version | path |
      | ghp  | 1.0.0   |      |
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins:
      | name  | version |
      | alpha | 1.0.0   |
      | beta  | 1.0.0   |
      | delta | 1.0.0   |
      | eps   | 1.0.0   |
      | gamma | 1.0.0   |
    Given the published plugin "delta" of the marketplace "tools" has an output style
    Given the published plugin "gamma" of the marketplace "tools" has an output style
    Given the marketplace "extras" is published as a dir source
    Given the marketplace "extras" offers these plugins:
      | name | version |
      | kilo | 1.0.0   |
    Given the marketplace "tools" is added to the project scope
    Given the marketplace "extras" is added to the user scope
    Given the user has run "/claude:plugin install alpha@tools --scope project"
    Given the user has run "/claude:plugin install delta@tools --scope project --partial"
    Given the user has run "/claude:plugin install eps@tools --scope project"
    Given the user has run "/claude:plugin disable eps@tools --scope project"
    Given the user has run "/claude:plugin install kilo@extras --scope user"
    Given the marketplace "tools" offers these plugins:
      | name  | version |
      | alpha | 2.0.0   |
    Given the marketplace "tools" publishes this manifest:
      """
      {
        "name": "tools",
        "owner": { "name": "features" },
        "plugins": [
          { "name": "alpha", "source": "./plugins/alpha", "version": "2.0.0" },
          { "name": "beta", "source": "./plugins/beta", "version": "1.0.0" },
          { "name": "delta", "source": "./plugins/delta", "version": "1.0.0" },
          { "name": "eps", "source": "./plugins/eps", "version": "1.0.0" },
          { "name": "gamma", "source": "./plugins/gamma", "version": "1.0.0" },
          { "name": "npmp", "source": { "source": "npm", "package": "npmp" }, "version": "1.0.0" }
        ]
      }
      """
    Given the marketplace "tools" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | ghp  | github      | ghp        | false  |
    When the user runs "/claude:plugin list"
    Then the result has these fields:
      | kind                | cascade     |
      | severity            | info        |
      | needs reload        | false       |
      | tally label         | Plugin list |
      | tally failures      | 0           |
      | tally warnings      | 0           |
      | tally success count | 8           |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id          | name  | status              | reasons               | scope   | version |
      | extras           | user              | kilo@extras | kilo  | installed           |                       | user    | 1.0.0   |
      | tools            | project           | alpha@tools | alpha | upgradable          |                       | project | 1.0.0   |
      | tools            | project           | beta@tools  | beta  | available           |                       |         | 1.0.0   |
      | tools            | project           | delta@tools | delta | partially-installed | unsupported component | project | 1.0.0   |
      | tools            | project           | eps@tools   | eps   | disabled            |                       | project | 1.0.0   |
      | tools            | project           | gamma@tools | gamma | partially-available | unsupported component |         | 1.0.0   |
      | tools            | project           | ghp@tools   | ghp   | remote              |                       |         |         |
      | tools            | project           | npmp@tools  | npmp  | unavailable         | unsupported source    |         | 1.0.0   |
    Then the git host receives no request


  Scenario: Naming a marketplace no scope holds fails as not added
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" is added to the project scope
    When the user runs "/claude:plugin list extras"
    Then the result has these fields:
      | kind         | marketplace-not-added               |
      | severity     | error                               |
      | needs reload | false                               |
      | summary      | A marketplace operation has failed. |
      | name         | extras                              |
      | reasons      | marketplace not added               |

  Scenario: Naming a marketplace no scope holds with a scope fails as not added to that scope
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" is added to the project scope
    When the user runs "/claude:plugin list extras --scope project"
    Then the result has these fields:
      | kind         | marketplace-not-added               |
      | severity     | error                               |
      | needs reload | false                               |
      | summary      | A marketplace operation has failed. |
      | name         | extras                              |
      | scope        | project                             |
      | reasons      | marketplace not added               |

  Scenario: Naming a marketplace with a scope that does not hold it fails as not added to that scope
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" is added to the project scope
    When the user runs "/claude:plugin list tools --scope user"
    Then the result has these fields:
      | kind         | marketplace-not-added               |
      | severity     | error                               |
      | needs reload | false                               |
      | summary      | A marketplace operation has failed. |
      | name         | tools                               |
      | scope        | user                                |
      | reasons      | marketplace not added to user scope |

  Scenario: The project scope filter lists a user marketplace from the project scope when a project installation added it
    Given the marketplace "extras" is published as a dir source
    Given the marketplace "extras" offers these plugins:
      | name | version |
      | kilo | 1.0.0   |
      | lima | 1.0.0   |
      | mike | 1.0.0   |
    Given the marketplace "extras" is added to the user scope
    Given the user has run "/claude:plugin install kilo@extras --scope project"
    Given the user has run "/claude:plugin install lima@extras --scope user"
    When the user runs "/claude:plugin list --scope project"
    Then the result has these fields:
      | kind                | cascade     |
      | severity            | info        |
      | needs reload        | false       |
      | tally label         | Plugin list |
      | tally failures      | 0           |
      | tally warnings      | 0           |
      | tally success count | 3           |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id          | name | status    | reasons | scope   | version |
      | extras           | project           | kilo@extras | kilo | installed |         | project | 1.0.0   |
      | extras           | project           | lima@extras | lima | available |         |         | 1.0.0   |
      | extras           | project           | mike@extras | mike | available |         |         | 1.0.0   |

  Scenario: The user scope filter offers a plugin installed only in the project scope as available
    Given the marketplace "extras" is published as a dir source
    Given the marketplace "extras" offers these plugins:
      | name | version |
      | kilo | 1.0.0   |
      | lima | 1.0.0   |
      | mike | 1.0.0   |
    Given the marketplace "extras" is added to the user scope
    Given the user has run "/claude:plugin install kilo@extras --scope project"
    Given the user has run "/claude:plugin install lima@extras --scope user"
    When the user runs "/claude:plugin list --scope user"
    Then the result has these fields:
      | kind                | cascade     |
      | severity            | info        |
      | needs reload        | false       |
      | tally label         | Plugin list |
      | tally failures      | 0           |
      | tally warnings      | 0           |
      | tally success count | 3           |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id          | name | status    | reasons | scope | version |
      | extras           | user              | kilo@extras | kilo | available |         |       | 1.0.0   |
      | extras           | user              | lima@extras | lima | installed |         | user  | 1.0.0   |
      | extras           | user              | mike@extras | mike | available |         |       | 1.0.0   |

  Scenario: The list shows the version a path-source plugin's plugin.json declares over its entry's
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins:
      | name  | version |
      | alpha | 2.0.0   |
    Given the marketplace "tools" publishes this manifest:
      """
      {
        "name": "tools",
        "owner": { "name": "features" },
        "plugins": [{ "name": "alpha", "source": "./plugins/alpha", "version": "1.0.0" }]
      }
      """
    Given the marketplace "tools" is added to the project scope
    When the user runs "/claude:plugin list --scope project"
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id          | name  | status    | reasons | version |
      | tools            | project           | alpha@tools | alpha | available |         | 2.0.0   |

  Scenario: The list shows an installed path-source plugin whose plugin.json version matches the record as installed, not upgradable
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins:
      | name  | version |
      | alpha | 2.0.0   |
    Given the marketplace "tools" publishes this manifest:
      """
      {
        "name": "tools",
        "owner": { "name": "features" },
        "plugins": [{ "name": "alpha", "source": "./plugins/alpha", "version": "1.0.0" }]
      }
      """
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install alpha@tools --scope project"
    When the user runs "/claude:plugin list --scope project"
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id          | name  | status    | reasons | scope   | version |
      | tools            | project           | alpha@tools | alpha | installed |         | project | 2.0.0   |

  Scenario: The list names a path-source plugin whose directory is missing unavailable as source missing
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" publishes this manifest:
      """
      {
        "name": "tools",
        "owner": { "name": "features" },
        "plugins": [{ "name": "ghost", "source": "./plugins/ghost", "version": "1.0.0" }]
      }
      """
    Given the marketplace "tools" is added to the project scope
    When the user runs "/claude:plugin list --scope project"
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id          | name  | status      | reasons        | version |
      | tools            | project           | ghost@tools | ghost | unavailable | source missing | 1.0.0   |

  Scenario: The list shows the plugin.json version of a fetched git-source plugin whose entry declares none
    Given the git repository "ghp" holds these plugins:
      | name | version | path |
      | ghp  | 1.0.0   |      |
    Given the marketplace "gits" is published as a dir source
    Given the marketplace "gits" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | ghp  | github      | ghp        | false  |
    Given the marketplace "gits" is added to the project scope
    Given the user has run "/claude:plugin fetch ghp@gits --scope project"
    When the user runs "/claude:plugin list --scope project"
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id       | name | status    | reasons | version |
      | gits             | project           | ghp@gits | ghp  | available |         | 1.0.0   |
    Then the git host receives no request

  Scenario: The list shows a dependency recorded at its release tag's commit as upgradable when the catalog offers that version without the commit
    Given the git repository "lib" holds these plugins:
      | name | version | path |
      | lib  | 2.0.0   |      |
    Given the git repository "lib" has a revision only the tag "lib--v2.0.0" reaches, holding these plugins:
      | name  | version | path  |
      | lib   | 2.0.0   |       |
      | other | 1.0.0   | other |
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib@^2.0.0   |
    Given the marketplace "tools" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | lib  | url         | lib        | false  |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install app@tools --scope project"
    Given the user has run "/claude:plugin fetch lib@tools --scope project"
    When the user runs "/claude:plugin list --scope project"
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name | status     | reasons | scope   | version                |
      | tools            | project           | app@tools | app  | installed  |         | project | 1.0.0                  |
      | tools            | project           | lib@tools | lib  | upgradable |         | project | 2.0.0-{lib revision 2} |

  Scenario: The list shows an installed plugin as partially upgradable when its new version adds an unsupported component
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | app  | 1.0.0   |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install app@tools --scope project"
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | app  | 1.1.0   |
    Given the published plugin "app" of the marketplace "tools" has an output style
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
      | marketplace name | marketplace scope | id        | name | status               | reasons               | scope   | version |
      | tools            | project           | app@tools | app  | partially-upgradable | unsupported component | project | 1.0.0   |
