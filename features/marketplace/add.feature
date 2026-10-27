Feature: Marketplace add

  Adding a marketplace records it in a scope under the name its manifest declares.
  The scenarios run the real extension in a headless Pi, read its JSON results, and
  use local marketplaces and a loopback https git host in place of published ones.

  Scenario Outline: Adding a marketplace records it in the chosen scope
    Given the marketplace "tools" is published as a <source kind> source
    When the user runs "/claude:plugin marketplace add <source> --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope   | status |
      | tools | project | added  |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name  | source   |
      | tools | <source> |

    Examples:
      | source kind | source                                                    |
      | dir         | {home}/marketplaces/tools                                 |
      | file        | {home}/marketplaces/tools/.claude-plugin/marketplace.json |

    @url
    Examples:
      | source kind | source                            |
      | url         | https://{git host}/acme/tools.git |

    @github
    Examples:
      | source kind | source     |
      | github      | acme/tools |

  Scenario: Adding a marketplace without a scope records it in the user scope
    Given the marketplace "tools" is published as a dir source
    When the user runs "/claude:plugin marketplace add {home}/marketplaces/tools"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope | status |
      | tools | user  | added  |
    Then the "claude-plugins.json" file of the user scope declares these marketplaces:
      | name  | source                    |
      | tools | {home}/marketplaces/tools |

  Scenario: Adding a marketplace by a home-relative path keeps the ~ form in the base config of the user scope
    Given the marketplace "tools" is published as a dir source
    When the user runs "/claude:plugin marketplace add ~/marketplaces/tools"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope | status |
      | tools | user  | added  |
    Then the "claude-plugins.json" file of the user scope declares these marketplaces:
      | name  | source               |
      | tools | ~/marketplaces/tools |

  Scenario Outline: Adding a marketplace the user scope holds to the project scope records it in both scopes
    Given the marketplace "tools" is published as a <source kind> source
    Given the marketplace "tools" is added to the user scope
    When the user runs "/claude:plugin marketplace add <source> --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope   | status |
      | tools | project | added  |
    Then the "claude-plugins.json" file of the user scope declares these marketplaces:
      | name  | source   |
      | tools | <source> |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name  | source   |
      | tools | <source> |

    Examples:
      | source kind | source                                                    |
      | dir         | {home}/marketplaces/tools                                 |
      | file        | {home}/marketplaces/tools/.claude-plugin/marketplace.json |

    @url
    Examples:
      | source kind | source                            |
      | url         | https://{git host}/acme/tools.git |

    @github
    Examples:
      | source kind | source     |
      | github      | acme/tools |

  Scenario: Adding a marketplace with --local declares it only in the local layer
    Given the marketplace "extras" is published as a dir source
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "extras" is added to the project scope
    When the user runs "/claude:plugin marketplace add {home}/marketplaces/tools --scope project --local"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope   | status |
      | tools | project | added  |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name   | source                     |
      | extras | {home}/marketplaces/extras |
    Then the "claude-plugins.local.json" file of the project scope declares these marketplaces:
      | name  | source                    |
      | tools | {home}/marketplaces/tools |

  Scenario Outline: Adding with --local a marketplace that the base layer declares also declares it in the local layer
    Given the marketplace "tools" is published as a <source kind> source
    Given the marketplace "tools" is added to the project scope
    When the user runs "/claude:plugin marketplace add <source> --scope project --local"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope   | status |
      | tools | project | added  |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name  | source   |
      | tools | <source> |
    Then the "claude-plugins.local.json" file of the project scope declares these marketplaces:
      | name  | source   |
      | tools | <source> |

    Examples:
      | source kind | source                                                    |
      | dir         | {home}/marketplaces/tools                                 |
      | file        | {home}/marketplaces/tools/.claude-plugin/marketplace.json |

    @url
    Examples:
      | source kind | source                            |
      | url         | https://{git host}/acme/tools.git |

    @github
    Examples:
      | source kind | source     |
      | github      | acme/tools |

  Scenario: Adding without --local a marketplace that the local layer declares also declares it in the base layer
    Given the marketplace "tools" is published as a dir source
    Given the user has run "/claude:plugin marketplace add {home}/marketplaces/tools --scope project --local"
    When the user runs "/claude:plugin marketplace add {home}/marketplaces/tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope   | status |
      | tools | project | added  |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name  | source                    |
      | tools | {home}/marketplaces/tools |
    Then the "claude-plugins.local.json" file of the project scope declares these marketplaces:
      | name  | source                    |
      | tools | {home}/marketplaces/tools |

  Scenario: A marketplace added with --local to a scope with no base config stays out of it in a new session
    Given the marketplace "tools" is published as a dir source
    Given the user has run "/claude:plugin marketplace add {home}/marketplaces/tools --scope project --local"
    When the user starts a new pi session
    Then the "claude-plugins.json" file of the project scope does not exist
    Then the "claude-plugins.local.json" file of the project scope declares these marketplaces:
      | name  | source                    |
      | tools | {home}/marketplaces/tools |

  Scenario Outline: An added marketplace is still listed in a new session
    Given the marketplace "tools" is published as a <source kind> source
    Given the marketplace "tools" is added to the project scope
    Given the user has started a new pi session
    When the user runs "/claude:plugin marketplace list"
    Then the result has these fields:
      | kind                | cascade          |
      | severity            | info             |
      | needs reload        | false            |
      | tally label         | Marketplace list |
      | tally failures      | 0                |
      | tally warnings      | 0                |
      | tally success count | 1                |
    Then the result lists these marketplaces:
      | name  | scope   | details autoupdate | details last updated at |
      | tools | project | false              | {scenario time}         |

    Examples:
      | source kind |
      | dir         |
      | file        |

    @url
    Examples:
      | source kind |
      | url         |

    @github
    Examples:
      | source kind |
      | github      |

  Scenario Outline: Adding again a marketplace from the source it was added from changes nothing
    Given the marketplace "tools" is published as a <source kind> source
    Given the marketplace "tools" is added to the project scope
    When the user runs "/claude:plugin marketplace add <source> --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope   | status  | reasons       |
      | tools | project | skipped | already added |
    Then the git host receives no request
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name  | source   |
      | tools | <source> |

    Examples:
      | source kind | source                                                    |
      | dir         | {home}/marketplaces/tools                                 |
      | file        | {home}/marketplaces/tools/.claude-plugin/marketplace.json |

    @url
    Examples:
      | source kind | source                            |
      | url         | https://{git host}/acme/tools.git |

    @github
    Examples:
      | source kind | source     |
      | github      | acme/tools |

  Scenario Outline: Adding again a marketplace whose checkout is gone restores it and keeps its installed plugins
    Given the marketplace "tools" is published as a <source kind> source
    Given the marketplace "tools" offers these plugins:
      | name      | version |
      | formatter | 1.0.0   |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install formatter@tools --scope project"
    Given the project scope has lost the checkout of the marketplace "tools"
    When the user runs "/claude:plugin marketplace add <source> --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope   | status |
      | tools | project | added  |
    Then the installation record of the project scope holds these plugins:
      | id              | version | enabled |
      | formatter@tools | 1.0.0   | true    |
    Then the git host receives these requests:
      | method | path                                              | status |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/tools.git/git-upload-pack                   | 200    |

    @url
    Examples:
      | source kind | source                            |
      | url         | https://{git host}/acme/tools.git |

    @github
    Examples:
      | source kind | source     |
      | github      | acme/tools |

  Scenario Outline: Adding again a local marketplace whose manifest is gone fails as source missing
    Given the marketplace "tools" is published as a <source kind> source
    Given the marketplace "tools" is added to the project scope
    Given the published source of the marketplace "tools" is removed
    When the user runs "/claude:plugin marketplace add <source> --scope project"
    Then the result has these fields:
      | kind         | cascade                             |
      | severity     | error                               |
      | needs reload | false                               |
      | summary      | A marketplace operation has failed. |
    Then the result lists these marketplaces:
      | name     | scope   | status | reasons        |
      | <source> | project | failed | source missing |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name  | source   |
      | tools | <source> |

    Examples:
      | source kind | source                                                    |
      | dir         | {home}/marketplaces/tools                                 |
      | file        | {home}/marketplaces/tools/.claude-plugin/marketplace.json |

  Scenario Outline: Adding a marketplace whose name the scope already holds fails as a duplicate name
    Given the marketplace "tools" is published as a <source kind> source
    Given the marketplace "tools" is added to the project scope
    Given a second marketplace declaring the name "tools" is ready to add from "tools-copy"
    When the user runs "/claude:plugin marketplace add <second source> --scope project"
    Then the result has these fields:
      | kind         | cascade                             |
      | severity     | error                               |
      | needs reload | false                               |
      | summary      | A marketplace operation has failed. |
    Then the result lists these marketplaces:
      | name  | scope   | status | reasons        |
      | tools | project | failed | duplicate name |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name  | source   |
      | tools | <source> |

    Examples:
      | source kind | source                    | second source                  |
      | dir         | {home}/marketplaces/tools | {home}/marketplaces/tools-copy |

    @url
    Examples:
      | source kind | source                            | second source                          |
      | url         | https://{git host}/acme/tools.git | https://{git host}/acme/tools-copy.git |

  Scenario: Adding again a hosted marketplace from the source it was added from changes nothing
    Given the marketplace "tools" is published as a hosted source
    Given the marketplace "tools" is added to the project scope
    When the user runs "/claude:plugin marketplace add https://{git host}/acme/tools/marketplace.json --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope   | status  | reasons       |
      | tools | project | skipped | already added |
    Then the git host receives no request
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name  | source                                         |
      | tools | https://{git host}/acme/tools/marketplace.json |

  Scenario: Adding again a hosted marketplace whose stored catalog is gone restores it and keeps its installed plugins
    Given the git repository "ghp" holds these plugins:
      | name | version | path |
      | ghp  | 1.0.0   |      |
    Given the marketplace "tools" is published as a hosted source
    Given the marketplace "tools" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | ghp  | url         | ghp        | false  |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install ghp@tools --scope project"
    Given the project scope has lost the checkout of the marketplace "tools"
    When the user runs "/claude:plugin marketplace add https://{git host}/acme/tools/marketplace.json --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope   | status |
      | tools | project | added  |
    Then the installation record of the project scope holds these plugins:
      | id        | version | enabled |
      | ghp@tools | 1.0.0   | true    |
    Then the git host receives these requests:
      | method | path                         | status |
      | GET    | /acme/tools/marketplace.json | 200    |

  Scenario: Adding a hosted marketplace whose name the scope already holds fails as a duplicate name
    Given the marketplace "tools" is published as a hosted source
    Given the marketplace "tools" is added to the project scope
    Given a second marketplace declaring the name "tools" is ready to add from "tools-copy"
    When the user runs "/claude:plugin marketplace add https://{git host}/acme/tools-copy/marketplace.json --scope project"
    Then the result has these fields:
      | kind         | cascade                             |
      | severity     | error                               |
      | needs reload | false                               |
      | summary      | A marketplace operation has failed. |
    Then the result lists these marketplaces:
      | name  | scope   | status | reasons        |
      | tools | project | failed | duplicate name |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name  | source                                         |
      | tools | https://{git host}/acme/tools/marketplace.json |
    Then the git host receives these requests:
      | method | path                              | status |
      | GET    | /acme/tools-copy/marketplace.json | 200    |

  Scenario: Adding again with --local a marketplace that the local layer declares changes nothing
    Given the marketplace "tools" is published as a dir source
    Given the user has run "/claude:plugin marketplace add {home}/marketplaces/tools --scope project --local"
    When the user runs "/claude:plugin marketplace add {home}/marketplaces/tools --scope project --local"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope   | status  | reasons       |
      | tools | project | skipped | already added |
    Then the git host receives no request
    Then the "claude-plugins.local.json" file of the project scope declares these marketplaces:
      | name  | source                    |
      | tools | {home}/marketplaces/tools |
    Then the "claude-plugins.json" file of the project scope does not exist

  Scenario: Adding with --local another spelling of a marketplace that the base layer declares fails as a duplicate name
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" is added to the project scope
    When the user runs "/claude:plugin marketplace add ~/marketplaces/tools --scope project --local"
    Then the result has these fields:
      | kind         | cascade                             |
      | severity     | error                               |
      | needs reload | false                               |
      | summary      | A marketplace operation has failed. |
    Then the result lists these marketplaces:
      | name  | scope   | status | reasons        |
      | tools | project | failed | duplicate name |
    Then the "claude-plugins.local.json" file of the project scope does not exist

  Scenario Outline: Adding a path that holds no marketplace manifest fails as source missing, named as typed
    Given the directory "<directory>" to add <directory state>
    When the user runs "/claude:plugin marketplace add <source> --scope project"
    Then the result has these fields:
      | kind         | cascade                             |
      | severity     | error                               |
      | needs reload | false                               |
      | summary      | A marketplace operation has failed. |
    Then the result lists these marketplaces:
      | name     | scope   | status | reasons        |
      | <source> | project | failed | source missing |
    Then the "claude-plugins.json" file of the project scope does not exist

    Examples:
      | directory | directory state               | source                                                      |
      | missing   | does not exist                | {home}/marketplaces/missing                                 |
      | missing   | does not exist                | ~/marketplaces/missing                                      |
      | missing   | does not exist                | {home}/marketplaces/missing/.claude-plugin/marketplace.json |
      | empty     | holds no marketplace manifest | {home}/marketplaces/empty                                   |

  Scenario Outline: Adding a marketplace whose manifest cannot be read fails as permission denied
    Given the marketplace "tools" is published as a <source kind> source
    Given the manifest of the marketplace "tools" to add cannot be read
    When the user runs "/claude:plugin marketplace add <source> --scope project"
    Then the result has these fields:
      | kind         | cascade                             |
      | severity     | error                               |
      | needs reload | false                               |
      | summary      | A marketplace operation has failed. |
    Then the result lists these marketplaces:
      | name     | scope   | status | reasons           |
      | <source> | project | failed | permission denied |
    Then the "claude-plugins.json" file of the project scope does not exist

    Examples:
      | source kind | source                                                    |
      | dir         | {home}/marketplaces/tools                                 |
      | file        | {home}/marketplaces/tools/.claude-plugin/marketplace.json |

  Scenario Outline: Adding a marketplace with a malformed or schema-invalid manifest fails as unparseable or invalid manifest
    Given the marketplace "tools" is published as a <source kind> source
    Given the manifest of the marketplace "tools" to add <manifest problem>
    When the user runs "/claude:plugin marketplace add <source> --scope project"
    Then the result has these fields:
      | kind         | cascade                             |
      | severity     | error                               |
      | needs reload | false                               |
      | summary      | A marketplace operation has failed. |
    Then the result lists these marketplaces:
      | name     | scope   | status | reasons  |
      | <source> | project | failed | <reason> |
    Then the "claude-plugins.json" file of the project scope does not exist

    Examples:
      | manifest problem           | source kind | source                                                    | reason           |
      | is not valid json          | dir         | {home}/marketplaces/tools                                 | unparseable      |
      | breaks the manifest schema | dir         | {home}/marketplaces/tools                                 | invalid manifest |
      | is not valid json          | file        | {home}/marketplaces/tools/.claude-plugin/marketplace.json | unparseable      |
      | breaks the manifest schema | file        | {home}/marketplaces/tools/.claude-plugin/marketplace.json | invalid manifest |

    @url
    Examples:
      | manifest problem           | source kind | source                            | reason           |
      | is not valid json          | url         | https://{git host}/acme/tools.git | unparseable      |
      | breaks the manifest schema | url         | https://{git host}/acme/tools.git | invalid manifest |
