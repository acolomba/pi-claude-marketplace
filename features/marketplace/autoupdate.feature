Feature: Marketplace autoupdate

  Autoupdate turns automatic updates on and off for an added marketplace, and a scope's
  two layers combine the setting. The scenarios run the real extension in a headless Pi
  and use local marketplaces and a loopback https git host in place of published ones.

  Scenario: Enabling autoupdate turns it on for a marketplace
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" is added to the project scope
    When the user runs "/claude:plugin marketplace autoupdate tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope   | status             |
      | tools | project | autoupdate enabled |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name  | source                    | autoupdate |
      | tools | {home}/marketplaces/tools | true       |

  Scenario: Enabling autoupdate on a marketplace that has it on skips it as already autoupdate
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin marketplace autoupdate tools --scope project"
    When the user runs "/claude:plugin marketplace autoupdate tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope   | status  | reasons            |
      | tools | project | skipped | already autoupdate |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name  | source                    | autoupdate |
      | tools | {home}/marketplaces/tools | true       |

  Scenario: Disabling autoupdate turns it off for a marketplace
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin marketplace autoupdate tools --scope project"
    When the user runs "/claude:plugin marketplace noautoupdate tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope   | status              |
      | tools | project | autoupdate disabled |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name  | source                    | autoupdate |
      | tools | {home}/marketplaces/tools | false      |

  Scenario Outline: A newly added marketplace has autoupdate off
    Given the marketplace "tools" is published as a <source kind> source
    Given the user has run "/claude:plugin marketplace add <source> --scope project"
    When the user runs "/claude:plugin marketplace noautoupdate tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope   | status  | reasons               |
      | tools | project | skipped | already no autoupdate |
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

  Scenario: An enabled autoupdate shows in the marketplace list of a new session
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin marketplace autoupdate tools --scope project"
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
      | tools | project | true               | {scenario time}         |

  Scenario: An enabled autoupdate shows in the marketplace info of a new session
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin marketplace autoupdate tools --scope project"
    Given the user has started a new pi session
    When the user runs "/claude:plugin marketplace info tools --scope project"
    Then the marketplace info result has these fields:
      | kind                    | marketplace-info          |
      | name                    | tools                     |
      | scope                   | project                   |
      | details autoupdate      | true                      |
      | details last updated at | {scenario time}           |
      | source kind             | path                      |
      | source abs path         | {home}/marketplaces/tools |
      | source url              |                           |
      | source owner            |                           |
      | source repo             |                           |
      | source ref              |                           |
      | severity                | info                      |
      | needs reload            | false                     |

  Scenario: Enabling autoupdate for every marketplace lists the changed marketplaces of each scope before the ones already on
    Given the marketplace "zeta" is published as a dir source
    Given the marketplace "alpha" is published as a dir source
    Given the marketplace "mid" is published as a dir source
    Given the marketplace "bravo" is published as a dir source
    Given the marketplace "yankee" is published as a dir source
    Given the marketplace "zeta" is added to the project scope
    Given the marketplace "alpha" is added to the project scope
    Given the marketplace "mid" is added to the project scope
    Given the marketplace "bravo" is added to the user scope
    Given the marketplace "yankee" is added to the user scope
    Given the user has run "/claude:plugin marketplace autoupdate zeta --scope project"
    Given the user has run "/claude:plugin marketplace autoupdate mid --scope project"
    Given the user has run "/claude:plugin marketplace autoupdate bravo --scope user"
    When the user runs "/claude:plugin marketplace autoupdate"
    Then the result has these fields:
      | kind                | cascade                |
      | severity            | info                   |
      | needs reload        | false                  |
      | tally label         | Marketplace autoupdate |
      | tally failures      | 0                      |
      | tally warnings      | 0                      |
      | tally success count | 5                      |
    Then the result lists these marketplaces:
      | name   | scope   | status             | reasons            |
      | alpha  | project | autoupdate enabled |                    |
      | zeta   | project | skipped            | already autoupdate |
      | mid    | project | skipped            | already autoupdate |
      | yankee | user    | autoupdate enabled |                    |
      | bravo  | user    | skipped            | already autoupdate |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name  | source                    | autoupdate |
      | zeta  | {home}/marketplaces/zeta  | true       |
      | alpha | {home}/marketplaces/alpha | true       |
      | mid   | {home}/marketplaces/mid   | true       |
    Then the "claude-plugins.json" file of the user scope declares these marketplaces:
      | name   | source                     | autoupdate |
      | bravo  | {home}/marketplaces/bravo  | true       |
      | yankee | {home}/marketplaces/yankee | true       |

  Scenario: Enabling autoupdate without a scope judges each scope that holds the marketplace on its own
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" is added to the project scope
    Given the marketplace "tools" is added to the user scope
    Given the user has run "/claude:plugin marketplace autoupdate tools --scope project"
    When the user runs "/claude:plugin marketplace autoupdate tools"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope   | status             | reasons            |
      | tools | project | skipped            | already autoupdate |
      | tools | user    | autoupdate enabled |                    |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name  | source                    | autoupdate |
      | tools | {home}/marketplaces/tools | true       |
    Then the "claude-plugins.json" file of the user scope declares these marketplaces:
      | name  | source                    | autoupdate |
      | tools | {home}/marketplaces/tools | true       |

  Scenario: Enabling autoupdate without a scope changes both scopes that hold the marketplace
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" is added to the project scope
    Given the marketplace "tools" is added to the user scope
    When the user runs "/claude:plugin marketplace autoupdate tools"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope   | status             |
      | tools | project | autoupdate enabled |
      | tools | user    | autoupdate enabled |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name  | source                    | autoupdate |
      | tools | {home}/marketplaces/tools | true       |
    Then the "claude-plugins.json" file of the user scope declares these marketplaces:
      | name  | source                    | autoupdate |
      | tools | {home}/marketplaces/tools | true       |

  Scenario: A local declaration without autoupdate takes the setting from the declaration in the base layer
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin marketplace autoupdate tools --scope project"
    Given the user has run "/claude:plugin marketplace add {home}/marketplaces/tools --scope project --local"
    When the user runs "/claude:plugin marketplace list --scope project"
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
      | tools | project | true               | {scenario time}         |
    Then the "claude-plugins.local.json" file of the project scope declares these marketplaces:
      | name  | source                    |
      | tools | {home}/marketplaces/tools |

  Scenario: Enabling autoupdate without --local on a marketplace added with --local fails as marketplace in local layer only
    Given the marketplace "tools" is published as a dir source
    Given the user has run "/claude:plugin marketplace add {home}/marketplaces/tools --scope project --local"
    When the user runs "/claude:plugin marketplace autoupdate tools --scope project"
    Then the result has these fields:
      | kind         | cascade                      |
      | severity     | error                        |
      | needs reload | false                        |
      | summary      | Some operations have failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace status | id    | name  | status | reasons                         | scope   | cause chain                                                                                                                 | cause truncated | leaks | rollback partial |
      | tools            | project           | failed             | tools | tools | failed | marketplace in local layer only | project | The marketplace tools is declared only in the local config (claude-plugins.local.json). Run the command again with --local. | false           |       |                  |
    Then the "claude-plugins.local.json" file of the project scope declares these marketplaces:
      | name  | source                    |
      | tools | {home}/marketplaces/tools |
    Then the "claude-plugins.json" file of the project scope does not exist

  Scenario: Disabling autoupdate with --local on a marketplace only the base layer declares fails as marketplace in base layer only
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" is added to the project scope
    When the user runs "/claude:plugin marketplace noautoupdate tools --scope project --local"
    Then the result has these fields:
      | kind         | cascade                      |
      | severity     | error                        |
      | needs reload | false                        |
      | summary      | Some operations have failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace status | id    | name  | status | reasons                        | scope   | cause chain                                                                                                             | cause truncated | leaks | rollback partial |
      | tools            | project           | failed             | tools | tools | failed | marketplace in base layer only | project | The marketplace tools is declared only in the base config (claude-plugins.json). Run the command again without --local. | false           |       |                  |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name  | source                    |
      | tools | {home}/marketplaces/tools |
    Then the "claude-plugins.local.json" file of the project scope does not exist

  Scenario: Enabling autoupdate without a scope changes only the scopes whose base layer declares the marketplace
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" is added to the user scope
    Given the user has run "/claude:plugin marketplace add {home}/marketplaces/tools --scope project --local"
    When the user runs "/claude:plugin marketplace autoupdate tools"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope | status             |
      | tools | user  | autoupdate enabled |
    Then the "claude-plugins.json" file of the user scope declares these marketplaces:
      | name  | source                    | autoupdate |
      | tools | {home}/marketplaces/tools | true       |
    Then the "claude-plugins.local.json" file of the project scope declares these marketplaces:
      | name  | source                    |
      | tools | {home}/marketplaces/tools |
    Then the "claude-plugins.json" file of the project scope does not exist

  Scenario: Enabling autoupdate for every marketplace sets the base config and leaves a local entry without a value to inherit it
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "extras" is published as a dir source
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin marketplace add {home}/marketplaces/tools --scope project --local"
    Given the marketplace "extras" is added to the project scope
    When the user runs "/claude:plugin marketplace autoupdate --scope project"
    Then the result has these fields:
      | kind                | cascade                |
      | severity            | info                   |
      | needs reload        | false                  |
      | tally label         | Marketplace autoupdate |
      | tally failures      | 0                      |
      | tally warnings      | 0                      |
      | tally success count | 2                      |
    Then the result lists these marketplaces:
      | name   | scope   | status             |
      | tools  | project | autoupdate enabled |
      | extras | project | autoupdate enabled |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name   | source                     | autoupdate |
      | tools  | {home}/marketplaces/tools  | true       |
      | extras | {home}/marketplaces/extras | true       |
    Then the "claude-plugins.local.json" file of the project scope declares these marketplaces:
      | name  | source                    |
      | tools | {home}/marketplaces/tools |

  Scenario: Enabling autoupdate for every marketplace writes a local entry the base config does not declare
    Given the marketplace "tools" is published as a dir source
    Given the user has run "/claude:plugin marketplace add {home}/marketplaces/tools --scope project --local"
    When the user runs "/claude:plugin marketplace autoupdate --scope project"
    Then the result has these fields:
      | kind                | cascade                |
      | severity            | info                   |
      | needs reload        | false                  |
      | tally label         | Marketplace autoupdate |
      | tally failures      | 0                      |
      | tally warnings      | 0                      |
      | tally success count | 1                      |
    Then the result lists these marketplaces:
      | name  | scope   | status             |
      | tools | project | autoupdate enabled |
    Then the "claude-plugins.local.json" file of the project scope declares these marketplaces:
      | name  | source                    | autoupdate |
      | tools | {home}/marketplaces/tools | true       |
    Then the "claude-plugins.json" file of the project scope does not exist

  Scenario: Disabling autoupdate for every marketplace skips a local entry without a value that the base config does not declare
    Given the marketplace "tools" is published as a dir source
    Given the user has run "/claude:plugin marketplace add {home}/marketplaces/tools --scope project --local"
    When the user runs "/claude:plugin marketplace noautoupdate --scope project"
    Then the result has these fields:
      | kind                | cascade                  |
      | severity            | info                     |
      | needs reload        | false                    |
      | tally label         | Marketplace noautoupdate |
      | tally failures      | 0                        |
      | tally warnings      | 0                        |
      | tally success count | 1                        |
    Then the result lists these marketplaces:
      | name  | scope   | status  | reasons               |
      | tools | project | skipped | already no autoupdate |
    Then the "claude-plugins.local.json" file of the project scope declares these marketplaces:
      | name  | source                    |
      | tools | {home}/marketplaces/tools |
    Then the "claude-plugins.json" file of the project scope does not exist

  Scenario: Disabling autoupdate for every marketplace sets the base config and leaves a local entry without a value to inherit it
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin marketplace autoupdate tools --scope project"
    Given the user has run "/claude:plugin marketplace add {home}/marketplaces/tools --scope project --local"
    When the user runs "/claude:plugin marketplace noautoupdate --scope project"
    Then the result has these fields:
      | kind                | cascade                  |
      | severity            | info                     |
      | needs reload        | false                    |
      | tally label         | Marketplace noautoupdate |
      | tally failures      | 0                        |
      | tally warnings      | 0                        |
      | tally success count | 1                        |
    Then the result lists these marketplaces:
      | name  | scope   | status              |
      | tools | project | autoupdate disabled |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name  | source                    | autoupdate |
      | tools | {home}/marketplaces/tools | false      |
    Then the "claude-plugins.local.json" file of the project scope declares these marketplaces:
      | name  | source                    |
      | tools | {home}/marketplaces/tools |

  Scenario: Disabling autoupdate with --local writes the setting to the local config only
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin marketplace add {home}/marketplaces/tools --scope project --local"
    Given the user has run "/claude:plugin marketplace autoupdate tools --scope project"
    When the user runs "/claude:plugin marketplace noautoupdate tools --scope project --local"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope   | status              |
      | tools | project | autoupdate disabled |
    Then the "claude-plugins.local.json" file of the project scope declares these marketplaces:
      | name  | source                    | autoupdate |
      | tools | {home}/marketplaces/tools | false      |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name  | source                    | autoupdate |
      | tools | {home}/marketplaces/tools | true       |

  Scenario: Disabling autoupdate with --local on a marketplace only the local layer declares skips it as already no autoupdate
    Given the marketplace "tools" is published as a dir source
    Given the user has run "/claude:plugin marketplace add {home}/marketplaces/tools --scope project --local"
    When the user runs "/claude:plugin marketplace noautoupdate tools --scope project --local"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope   | status  | reasons               |
      | tools | project | skipped | already no autoupdate |
    Then the "claude-plugins.local.json" file of the project scope declares these marketplaces:
      | name  | source                    |
      | tools | {home}/marketplaces/tools |
    Then the "claude-plugins.json" file of the project scope does not exist

  Scenario: Disabling autoupdate with --local skips a local entry without a value while the base layer has it off
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin marketplace add {home}/marketplaces/tools --scope project --local"
    When the user runs "/claude:plugin marketplace noautoupdate tools --scope project --local"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope   | status  | reasons               |
      | tools | project | skipped | already no autoupdate |
    Then the "claude-plugins.local.json" file of the project scope declares these marketplaces:
      | name  | source                    |
      | tools | {home}/marketplaces/tools |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name  | source                    |
      | tools | {home}/marketplaces/tools |

  Scenario: Disabling autoupdate with --local skips a local entry without a value while the base layer has it set off
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin marketplace autoupdate tools --scope project"
    Given the user has run "/claude:plugin marketplace noautoupdate tools --scope project"
    Given the user has run "/claude:plugin marketplace add {home}/marketplaces/tools --scope project --local"
    When the user runs "/claude:plugin marketplace noautoupdate tools --scope project --local"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope   | status  | reasons               |
      | tools | project | skipped | already no autoupdate |
    Then the "claude-plugins.local.json" file of the project scope declares these marketplaces:
      | name  | source                    |
      | tools | {home}/marketplaces/tools |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name  | source                    | autoupdate |
      | tools | {home}/marketplaces/tools | false      |

  Scenario: Enabling autoupdate with --local skips a local entry without a value while the base layer has it on
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin marketplace autoupdate tools --scope project"
    Given the user has run "/claude:plugin marketplace add {home}/marketplaces/tools --scope project --local"
    When the user runs "/claude:plugin marketplace autoupdate tools --scope project --local"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope   | status  | reasons            |
      | tools | project | skipped | already autoupdate |
    Then the "claude-plugins.local.json" file of the project scope declares these marketplaces:
      | name  | source                    |
      | tools | {home}/marketplaces/tools |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name  | source                    | autoupdate |
      | tools | {home}/marketplaces/tools | true       |

  Scenario: Enabling autoupdate with --local writes a local entry that has it off while the base layer has it on
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin marketplace autoupdate tools --scope project"
    Given the user has run "/claude:plugin marketplace add {home}/marketplaces/tools --scope project --local"
    Given the user has run "/claude:plugin marketplace noautoupdate tools --scope project --local"
    When the user runs "/claude:plugin marketplace autoupdate tools --scope project --local"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope   | status             |
      | tools | project | autoupdate enabled |
    Then the "claude-plugins.local.json" file of the project scope declares these marketplaces:
      | name  | source                    | autoupdate |
      | tools | {home}/marketplaces/tools | true       |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name  | source                    | autoupdate |
      | tools | {home}/marketplaces/tools | true       |

  Scenario: Enabling autoupdate for every marketplace writes a local entry that has it off
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin marketplace autoupdate tools --scope project"
    Given the user has run "/claude:plugin marketplace add {home}/marketplaces/tools --scope project --local"
    Given the user has run "/claude:plugin marketplace noautoupdate tools --scope project --local"
    When the user runs "/claude:plugin marketplace autoupdate --scope project"
    Then the result has these fields:
      | kind                | cascade                |
      | severity            | info                   |
      | needs reload        | false                  |
      | tally label         | Marketplace autoupdate |
      | tally failures      | 0                      |
      | tally warnings      | 0                      |
      | tally success count | 1                      |
    Then the result lists these marketplaces:
      | name  | scope   | status             |
      | tools | project | autoupdate enabled |
    Then the "claude-plugins.local.json" file of the project scope declares these marketplaces:
      | name  | source                    | autoupdate |
      | tools | {home}/marketplaces/tools | true       |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name  | source                    | autoupdate |
      | tools | {home}/marketplaces/tools | true       |

  Scenario: Disabling autoupdate with --local fails as invalid manifest when the base config cannot be read
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin marketplace add {home}/marketplaces/tools --scope project --local"
    Given a config in scope project and layer base, with this text:
      """
      { "schemaVersion": 1,
      """
    When the user runs "/claude:plugin marketplace noautoupdate tools --scope project --local"
    Then the result has these fields:
      | kind         | cascade                      |
      | severity     | error                        |
      | needs reload | false                        |
      | summary      | Some operations have failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace status | id    | name  | status | reasons          | scope   | cause chain                                                 | cause truncated | leaks | rollback partial |
      | tools            | project           | failed             | tools | tools | failed | invalid manifest | project | Config file "claude-plugins.json" failed schema validation. | false           |       |                  |
    Then the "claude-plugins.local.json" file of the project scope declares these marketplaces:
      | name  | source                    |
      | tools | {home}/marketplaces/tools |
    Then the "claude-plugins.json" file of the project scope holds this text:
      """
      { "schemaVersion": 1,
      """

  Scenario: A local autoupdate setting overrides the base-layer setting in the marketplace list
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin marketplace add {home}/marketplaces/tools --scope project --local"
    Given the user has run "/claude:plugin marketplace autoupdate tools --scope project"
    Given the user has run "/claude:plugin marketplace noautoupdate tools --scope project --local"
    When the user runs "/claude:plugin marketplace list --scope project"
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

  Scenario: Enabling autoupdate in the base layer reports already autoupdate while the local layer keeps it off
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin marketplace add {home}/marketplaces/tools --scope project --local"
    Given the user has run "/claude:plugin marketplace autoupdate tools --scope project"
    Given the user has run "/claude:plugin marketplace noautoupdate tools --scope project --local"
    When the user runs "/claude:plugin marketplace autoupdate tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope   | status  | reasons            |
      | tools | project | skipped | already autoupdate |
    Then the "claude-plugins.local.json" file of the project scope declares these marketplaces:
      | name  | source                    | autoupdate |
      | tools | {home}/marketplaces/tools | false      |

  Scenario: Disabling autoupdate for every marketplace with --local changes only the local config
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "extras" is published as a dir source
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin marketplace add {home}/marketplaces/tools --scope project --local"
    Given the marketplace "extras" is added to the project scope
    Given the user has run "/claude:plugin marketplace autoupdate tools --scope project"
    Given the user has run "/claude:plugin marketplace autoupdate extras --scope project"
    When the user runs "/claude:plugin marketplace noautoupdate --scope project --local"
    Then the result has these fields:
      | kind                | cascade                  |
      | severity            | info                     |
      | needs reload        | false                    |
      | tally label         | Marketplace noautoupdate |
      | tally failures      | 0                        |
      | tally warnings      | 0                        |
      | tally success count | 1                        |
    Then the result lists these marketplaces:
      | name  | scope   | status              |
      | tools | project | autoupdate disabled |
    Then the "claude-plugins.local.json" file of the project scope declares these marketplaces:
      | name  | source                    | autoupdate |
      | tools | {home}/marketplaces/tools | false      |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name   | source                     | autoupdate |
      | tools  | {home}/marketplaces/tools  | true       |
      | extras | {home}/marketplaces/extras | true       |

  Scenario Outline: A flip of a marketplace neither scope holds fails as not added without a scope
    Given the marketplace "other" is published as a dir source
    Given the marketplace "other" is added to the project scope
    When the user runs "/claude:plugin marketplace <verb> <name>"
    Then the result has these fields:
      | kind         | marketplace-not-added               |
      | severity     | error                               |
      | needs reload | false                               |
      | summary      | A marketplace operation has failed. |
      | name         | <name>                              |
      | reasons      | marketplace not added               |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name  | source                    |
      | other | {home}/marketplaces/other |
    Then the "claude-plugins.json" file of the user scope does not exist

    Examples:
      | verb         | name  |
      | autoupdate   | tools |
      | noautoupdate | tools |
      | autoupdate   | 工具  |

  Scenario Outline: A flip with a scope that does not hold the marketplace reports it not added to that scope
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" is added to the <added scope> scope
    When the user runs "/claude:plugin marketplace <verb> tools --scope <requested scope>"
    Then the result has these fields:
      | kind         | marketplace-not-added               |
      | severity     | error                               |
      | needs reload | false                               |
      | summary      | A marketplace operation has failed. |
      | name         | tools                               |
      | scope        | <requested scope>                   |
      | reasons      | <reasons>                           |
    Then the "claude-plugins.json" file of the <added scope> scope declares these marketplaces:
      | name  | source                    |
      | tools | {home}/marketplaces/tools |
    Then the "claude-plugins.json" file of the <requested scope> scope does not exist

    Examples:
      | verb         | added scope | requested scope | reasons                                |
      | autoupdate   | project     | user            | marketplace not added to user scope    |
      | noautoupdate | project     | user            | marketplace not added to user scope    |
      | autoupdate   | user        | project         | marketplace not added to project scope |
      | noautoupdate | user        | project         | marketplace not added to project scope |

  Scenario: Enabling autoupdate for every marketplace with none added reports an empty result
    When the user runs "/claude:plugin marketplace autoupdate"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists no marketplaces
    Then the "claude-plugins.json" file of the project scope does not exist
    Then the "claude-plugins.json" file of the user scope does not exist
