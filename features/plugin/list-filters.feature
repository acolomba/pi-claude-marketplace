Feature: Plugin list filters

  List filters keep only the plugin rows they select. The scenarios run the real
  extension in a headless Pi with local marketplaces and a loopback git host.

  Background:
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

  Scenario: The installed filter keeps every installed plugin
    When the user runs "/claude:plugin list --installed"
    Then the result has these fields:
      | kind                | cascade     |
      | severity            | info        |
      | needs reload        | false       |
      | tally label         | Plugin list |
      | tally failures      | 0           |
      | tally warnings      | 0           |
      | tally success count | 4           |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id          | name  | status              | reasons               | scope   | version |
      | extras           | user              | kilo@extras | kilo  | installed           |                       | user    | 1.0.0   |
      | tools            | project           | alpha@tools | alpha | upgradable          |                       | project | 1.0.0   |
      | tools            | project           | delta@tools | delta | partially-installed | unsupported component | project | 1.0.0   |
      | tools            | project           | eps@tools   | eps   | disabled            |                       | project | 1.0.0   |

  Scenario: The available filter keeps only the available plugins
    When the user runs "/claude:plugin list --available"
    Then the result has these fields:
      | kind                | cascade     |
      | severity            | info        |
      | needs reload        | false       |
      | tally label         | Plugin list |
      | tally failures      | 0           |
      | tally warnings      | 0           |
      | tally success count | 1           |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id         | name | status    | reasons | version |
      | extras           | user              |            |      |           |         |         |
      | tools            | project           | beta@tools | beta | available |         | 1.0.0   |

  Scenario: The unavailable filter keeps only the unavailable plugins
    When the user runs "/claude:plugin list --unavailable"
    Then the result has these fields:
      | kind                | cascade     |
      | severity            | info        |
      | needs reload        | false       |
      | tally label         | Plugin list |
      | tally failures      | 0           |
      | tally warnings      | 0           |
      | tally success count | 1           |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id         | name | status      | reasons            | version |
      | extras           | user              |            |      |             |                    |         |
      | tools            | project           | npmp@tools | npmp | unavailable | unsupported source | 1.0.0   |

  Scenario: The partial filter keeps only the partially available plugins
    When the user runs "/claude:plugin list --partial"
    Then the result has these fields:
      | kind                | cascade     |
      | severity            | info        |
      | needs reload        | false       |
      | tally label         | Plugin list |
      | tally failures      | 0           |
      | tally warnings      | 0           |
      | tally success count | 1           |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id          | name  | status              | reasons               | version |
      | extras           | user              |             |       |                     |                       |         |
      | tools            | project           | gamma@tools | gamma | partially-available | unsupported component | 1.0.0   |

  Scenario: Two filters keep the plugins of either one
    When the user runs "/claude:plugin list --available --unavailable"
    Then the result has these fields:
      | kind                | cascade     |
      | severity            | info        |
      | needs reload        | false       |
      | tally label         | Plugin list |
      | tally failures      | 0           |
      | tally warnings      | 0           |
      | tally success count | 2           |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id         | name | status      | reasons            | version |
      | extras           | user              |            |      |             |                    |         |
      | tools            | project           | beta@tools | beta | available   |                    | 1.0.0   |
      | tools            | project           | npmp@tools | npmp | unavailable | unsupported source | 1.0.0   |

  Scenario: The remote filter keeps the git-source plugin not yet cloned without reaching the git host
    When the user runs "/claude:plugin list --remote"
    Then the result has these fields:
      | kind                | cascade     |
      | severity            | info        |
      | needs reload        | false       |
      | tally label         | Plugin list |
      | tally failures      | 0           |
      | tally warnings      | 0           |
      | tally success count | 1           |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name | status | reasons |
      | extras           | user              |           |      |        |         |
      | tools            | project           | ghp@tools | ghp  | remote |         |
    Then the git host receives no request

  Scenario: Naming a marketplace keeps only its plugins
    When the user runs "/claude:plugin list tools"
    Then the result has these fields:
      | kind                | cascade     |
      | severity            | info        |
      | needs reload        | false       |
      | tally label         | Plugin list |
      | tally failures      | 0           |
      | tally warnings      | 0           |
      | tally success count | 7           |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id          | name  | status              | reasons               | scope   | version |
      | tools            | project           | alpha@tools | alpha | upgradable          |                       | project | 1.0.0   |
      | tools            | project           | beta@tools  | beta  | available           |                       |         | 1.0.0   |
      | tools            | project           | delta@tools | delta | partially-installed | unsupported component | project | 1.0.0   |
      | tools            | project           | eps@tools   | eps   | disabled            |                       | project | 1.0.0   |
      | tools            | project           | gamma@tools | gamma | partially-available | unsupported component |         | 1.0.0   |
      | tools            | project           | ghp@tools   | ghp   | remote              |                       |         |         |
      | tools            | project           | npmp@tools  | npmp  | unavailable         | unsupported source    |         | 1.0.0   |

  Scenario: The user scope filter keeps only the user installations
    When the user runs "/claude:plugin list --scope user"
    Then the result has these fields:
      | kind                | cascade     |
      | severity            | info        |
      | needs reload        | false       |
      | tally label         | Plugin list |
      | tally failures      | 0           |
      | tally warnings      | 0           |
      | tally success count | 1           |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id          | name | status    | reasons | scope | version |
      | extras           | user              | kilo@extras | kilo | installed |         | user  | 1.0.0   |

  Scenario: The project scope filter keeps only the project installations
    When the user runs "/claude:plugin list --scope project"
    Then the result has these fields:
      | kind                | cascade     |
      | severity            | info        |
      | needs reload        | false       |
      | tally label         | Plugin list |
      | tally failures      | 0           |
      | tally warnings      | 0           |
      | tally success count | 7           |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id          | name  | status              | reasons               | scope   | version |
      | tools            | project           | alpha@tools | alpha | upgradable          |                       | project | 1.0.0   |
      | tools            | project           | beta@tools  | beta  | available           |                       |         | 1.0.0   |
      | tools            | project           | delta@tools | delta | partially-installed | unsupported component | project | 1.0.0   |
      | tools            | project           | eps@tools   | eps   | disabled            |                       | project | 1.0.0   |
      | tools            | project           | gamma@tools | gamma | partially-available | unsupported component |         | 1.0.0   |
      | tools            | project           | ghp@tools   | ghp   | remote              |                       |         |         |
      | tools            | project           | npmp@tools  | npmp  | unavailable         | unsupported source    |         | 1.0.0   |
