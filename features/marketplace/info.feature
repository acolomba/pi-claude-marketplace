Feature: Marketplace info

  Info shows what the extension knows about an added marketplace: where it comes from and how it updates.
  The scenarios run the real extension in a headless Pi, read its JSON results, and use local marketplaces
  and a loopback https git host whose repositories carry a `stable` branch beside `main` with the same files.

  Scenario Outline: Info shows the source identity and description
    Given the marketplace "tools" is published as a <source kind> source
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "tools" has the description "Tools for formatting"
    Given the user has run "/claude:plugin marketplace add <source> --scope project"
    When the user runs "/claude:plugin marketplace info tools --scope project"
    Then the marketplace info result has these fields:
      | kind                    | marketplace-info          |
      | name                    | tools                     |
      | scope                   | project                   |
      | details autoupdate      | false                     |
      | details last updated at | {scenario time}           |
      | source kind             | <expected source kind>    |
      | source abs path         | <source abs path>         |
      | source url              | <source url>              |
      | source owner            | <source owner>            |
      | source repo             | <source repo>             |
      | source ref              | <source ref>              |
      | description             | Tools for formatting      |
      | severity                | info                      |
      | needs reload            | false                     |

    Examples:
      | source kind | source                                                    | expected source kind | source abs path                                           | source url | source owner | source repo | source ref |
      | dir         | {home}/marketplaces/tools                                 | path                 | {home}/marketplaces/tools                                 |            |              |             |            |
      | file        | {home}/marketplaces/tools/.claude-plugin/marketplace.json | path                 | {home}/marketplaces/tools/.claude-plugin/marketplace.json |            |              |             |            |

    @url
    Examples:
      | source kind | source                                   | expected source kind | source abs path | source url                    | source owner | source repo | source ref |
      | url         | https://{git host}/acme/tools.git#stable | url                  |                 | https://{git host}/acme/tools |              |             | stable     |

    @github
    Examples:
      | source kind | source            | expected source kind | source abs path | source url | source owner | source repo | source ref |
      | github      | acme/tools#stable | github               |                 |            | acme         | tools       | stable     |

  Scenario: Info preserves the declared order of allowed marketplaces
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "tools" allows dependencies on the marketplace "zebra"
    Given the marketplace "tools" allows dependencies on the marketplace "alpha"
    Given the marketplace "tools" is added to the project scope
    When the user runs "/claude:plugin marketplace info tools --scope project"
    Then the marketplace info result has these fields:
      | kind                    | marketplace-info          |
      | name                    | tools                     |
      | scope                   | project                   |
      | details autoupdate      | false                     |
      | details last updated at | {scenario time}           |
      | source kind             | path                      |
      | source abs path         | {home}/marketplaces/tools |
      | source url              |                           |
      | source owner            |                           |
      | source repo             |                           |
      | source ref              |                           |
      | allowed marketplaces    | zebra, alpha              |
      | severity                | info                      |
      | needs reload            | false                     |

  Scenario: Info on a marketplace neither scope holds fails as not added
    When the user runs "/claude:plugin marketplace info tools"
    Then the result has these fields:
      | kind         | marketplace-not-added               |
      | severity     | error                               |
      | needs reload | false                               |
      | summary      | A marketplace operation has failed. |
      | name         | tools                               |
      | reasons      | marketplace not added               |

  Scenario: Info reports a missing project scope without falling back
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "tools" is added to the user scope
    When the user runs "/claude:plugin marketplace info tools --scope project"
    Then the command reports these results:
      | kind                  | severity | needs reload | summary                             | name  | scope   | reasons                                |
      | marketplace-not-added | error    | false        | A marketplace operation has failed. | tools | project | marketplace not added to project scope |

  Scenario: Info reports a missing user scope without falling back
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "tools" is added to the project scope
    When the user runs "/claude:plugin marketplace info tools --scope user"
    Then the command reports these results:
      | kind                  | severity | needs reload | summary                             | name  | scope | reasons                             |
      | marketplace-not-added | error    | false        | A marketplace operation has failed. | tools | user  | marketplace not added to user scope |

  Scenario: Info on a marketplace both scopes hold shows one block per scope, project first
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "tools" is added to the user scope
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin marketplace autoupdate tools --scope project"
    When the user runs "/claude:plugin marketplace info tools"
    Then the result has these fields:
      | kind         | marketplace-info-cascade |
      | severity     | info                     |
      | needs reload | false                    |
    Then the result lists these marketplaces:
      | name  | scope   | details autoupdate | details last updated at | source kind | source abs path           |
      | tools | project | true               | {scenario time}         | path        | {home}/marketplaces/tools |
      | tools | user    | false              | {scenario time}         | path        | {home}/marketplaces/tools |

  Scenario: Info reports an invalid project before a healthy user
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "tools" and a separate info source "tools-user" are added to the project and user scopes
    Given the manifest of the marketplace "tools" has become invalid
    When the user runs "/claude:plugin marketplace info tools"
    Then the command reports these results:
      | kind             | severity | needs reload | summary                        | name  | scope | details autoupdate | details last updated at | source kind | source abs path                | marketplace name | marketplace scope | marketplace details autoupdate | plugin status | plugin name | plugin id   | plugin reasons   | plugin scope | plugin components resolved |
      | plugin-info      | error    | false        | A plugin operation has failed. |       |       |                    |                         |             |                                | tools            | project           | false                          | failed        | tools       | tools@tools | invalid manifest | project      | false                      |
      | marketplace-info | info     | false        |                                | tools | user  | false              | {scenario time}         | path        | {home}/marketplaces/tools-user |                  |                   |                                |               |             |             |                  |              |                            |

  Scenario: Info keeps a healthy project when the user manifest is invalid
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "tools" and a separate info source "tools-project" are added to the user and project scopes
    Given the manifest of the marketplace "tools" has become invalid
    When the user runs "/claude:plugin marketplace info tools"
    Then the command reports these results:
      | kind             | severity | needs reload | summary                        | name  | scope   | details autoupdate | details last updated at | source kind | source abs path                   | marketplace name | marketplace scope | marketplace details autoupdate | plugin status | plugin name | plugin id   | plugin reasons   | plugin scope | plugin components resolved |
      | marketplace-info | info     | false        |                                | tools | project | false              | {scenario time}         | path        | {home}/marketplaces/tools-project |                  |                   |                                |               |             |             |                  |              |                            |
      | plugin-info      | error    | false        | A plugin operation has failed. |       |         |                    |                         |             |                                   | tools            | user              | false                          | failed        | tools       | tools@tools | invalid manifest | user         | false                      |

  Scenario: Info on a marketplace whose manifest became invalid reports a failed invalid manifest row
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" is added to the project scope
    Given the manifest of the marketplace "tools" has become invalid
    When the user runs "/claude:plugin marketplace info tools --scope project"
    Then the result has these fields:
      | kind                           | plugin-info                    |
      | severity                       | error                          |
      | needs reload                   | false                          |
      | summary                        | A plugin operation has failed. |
      | marketplace name               | tools                          |
      | marketplace scope              | project                        |
      | marketplace details autoupdate | false                          |
      | plugin status                  | failed                         |
      | plugin name                    | tools                          |
      | plugin id                      | tools@tools                    |
      | plugin reasons                 | invalid manifest               |
      | plugin scope                   | project                        |
      | plugin components resolved     | false                          |
