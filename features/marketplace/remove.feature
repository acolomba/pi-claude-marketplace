Feature: Marketplace remove

  Removing a marketplace drops its declaration from one config of a scope and uninstalls
  the plugins that config declares from it. The scenarios run the real extension in a
  headless Pi and use local marketplaces and a loopback https git host in place of published ones.

  Scenario Outline: Removing an empty marketplace needs no reload
    Given the marketplace "tools" is published as a <source kind> source
    Given the marketplace "extras" is published as a dir source
    Given the user has run "/claude:plugin marketplace add <source> --scope <scope>"
    Given the marketplace "extras" is added to the <scope> scope
    When the user runs "/claude:plugin marketplace remove tools --scope <scope>"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope   | status  |
      | tools | <scope> | removed |
    Then the "claude-plugins.json" file of the <scope> scope declares these marketplaces:
      | name   | source                     |
      | extras | {home}/marketplaces/extras |

    Examples:
      | scope   | source kind | source                                                    |
      | project | dir         | {home}/marketplaces/tools                                 |
      | project | file        | {home}/marketplaces/tools/.claude-plugin/marketplace.json |
      | user    | dir         | {home}/marketplaces/tools                                 |
      | user    | file        | {home}/marketplaces/tools/.claude-plugin/marketplace.json |

    @url
    Examples:
      | scope   | source kind | source                            |
      | project | url         | https://{git host}/acme/tools.git |
      | user    | url         | https://{git host}/acme/tools.git |

    @github
    Examples:
      | scope   | source kind | source     |
      | project | github      | acme/tools |
      | user    | github      | acme/tools |

  Scenario: The rm alias removes a marketplace without a reload
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "extras" is published as a dir source
    Given the marketplace "tools" is added to the project scope
    Given the marketplace "extras" is added to the project scope
    When the user runs "/claude:plugin marketplace rm tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope   | status  |
      | tools | project | removed |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name   | source                     |
      | extras | {home}/marketplaces/extras |

  Scenario: Removing a marketplace uninstalls every plugin in installation order
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins:
      | name  | version |
      | zebra | 1.0.0   |
      | amber | 1.0.0   |
      | elm   | 1.0.0   |
    Given the marketplace "extras" is published as a dir source
    Given the marketplace "extras" offers these plugins:
      | name     | version |
      | sentinel | 1.0.0   |
    Given the marketplace "tools" is added to the project scope
    Given the marketplace "extras" is added to the project scope
    Given the user has run "/claude:plugin install zebra@tools --scope project"
    Given the user has run "/claude:plugin install amber@tools --scope project"
    Given the user has run "/claude:plugin install elm@tools --scope project"
    Given the user has run "/claude:plugin install sentinel@extras --scope project"
    When the user runs "/claude:plugin marketplace remove tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace status | id          | name  | status      | reasons | scope   |
      | tools            | project           | removed            | zebra@tools | zebra | uninstalled |         | project |
      | tools            | project           | removed            | amber@tools | amber | uninstalled |         | project |
      | tools            | project           | removed            | elm@tools   | elm   | uninstalled |         | project |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name   | source                     |
      | extras | {home}/marketplaces/extras |
    Then the "claude-plugins.json" file of the project scope declares these plugins:
      | id              |
      | sentinel@extras |

  Scenario: The rm alias uninstalls its only plugin and needs a reload
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install demo@tools --scope project"
    When the user runs "/claude:plugin marketplace rm tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace status | id         | name | status      | reasons | scope   |
      | tools            | project           | removed            | demo@tools | demo | uninstalled |         | project |
    Then the "claude-plugins.json" file of the project scope declares no marketplaces
    Then the "claude-plugins.json" file of the project scope declares no plugins

  Scenario: A new session offers none of the removed plugins' skills
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins:
      | name  | version |
      | zebra | 1.0.0   |
      | amber | 1.0.0   |
      | elm   | 1.0.0   |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install zebra@tools --scope project"
    Given the user has run "/claude:plugin install amber@tools --scope project"
    Given the user has run "/claude:plugin install elm@tools --scope project"
    Given the user has run "/claude:plugin marketplace remove tools --scope project"
    When the user starts a new pi session
    Then the session offers no skills

  Scenario: A new session lists none of the removed plugins
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins:
      | name  | version |
      | zebra | 1.0.0   |
      | amber | 1.0.0   |
      | elm   | 1.0.0   |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install zebra@tools --scope project"
    Given the user has run "/claude:plugin install amber@tools --scope project"
    Given the user has run "/claude:plugin install elm@tools --scope project"
    Given the user has run "/claude:plugin marketplace remove tools --scope project"
    Given the user has started a new pi session
    When the user runs "/claude:plugin list"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists no marketplaces

  Scenario: A removed base-layer marketplace stays absent in a new session
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin marketplace remove tools --scope project"
    Given the user has started a new pi session
    When the user runs "/claude:plugin marketplace list"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists no marketplaces
    Then the "claude-plugins.json" file of the project scope declares no marketplaces
    Then the "claude-plugins.local.json" file of the project scope does not exist

  Scenario: An unscoped remove selects the project copy
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "extras" is published as a dir source
    Given the marketplace "tools" is added to the user scope
    Given the marketplace "tools" is added to the project scope
    Given the marketplace "extras" is added to the project scope
    When the user runs "/claude:plugin marketplace remove tools"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope   | status  |
      | tools | project | removed |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name   | source                     |
      | extras | {home}/marketplaces/extras |
    Then the "claude-plugins.json" file of the user scope declares these marketplaces:
      | name  | source                    |
      | tools | {home}/marketplaces/tools |

  Scenario: An unscoped remove selects the only user copy
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "extras" is published as a dir source
    Given the marketplace "tools" is added to the user scope
    Given the marketplace "extras" is added to the user scope
    When the user runs "/claude:plugin marketplace remove tools"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope | status  |
      | tools | user  | removed |
    Then the "claude-plugins.json" file of the user scope declares these marketplaces:
      | name   | source                     |
      | extras | {home}/marketplaces/extras |
    Then the "claude-plugins.json" file of the project scope does not exist

  Scenario: An unscoped remove refuses the project local layer before considering user scope
    Given the marketplace "tools" is published as a dir source
    Given the user has run "/claude:plugin marketplace add {home}/marketplaces/tools --scope project --local"
    Given the marketplace "tools" is added to the user scope
    When the user runs "/claude:plugin marketplace remove tools"
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
    Then the "claude-plugins.json" file of the user scope declares these marketplaces:
      | name  | source                    |
      | tools | {home}/marketplaces/tools |
    Then the "claude-plugins.json" file of the project scope does not exist

  Scenario: Removing an unknown marketplace from the project scope reports it not added
    When the user runs "/claude:plugin marketplace remove tools --scope project"
    Then the result has these fields:
      | kind         | marketplace-not-added               |
      | severity     | error                               |
      | needs reload | false                               |
      | summary      | A marketplace operation has failed. |
      | name         | tools                               |
      | scope        | project                             |
      | reasons      | marketplace not added               |

  Scenario: Removing an unknown marketplace from the user scope reports it not added
    When the user runs "/claude:plugin marketplace remove tools --scope user"
    Then the result has these fields:
      | kind         | marketplace-not-added               |
      | severity     | error                               |
      | needs reload | false                               |
      | summary      | A marketplace operation has failed. |
      | name         | tools                               |
      | scope        | user                                |
      | reasons      | marketplace not added               |

  Scenario: Removing a user-only marketplace from project reports the missed scope
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" is added to the user scope
    When the user runs "/claude:plugin marketplace remove tools --scope project"
    Then the result has these fields:
      | kind         | marketplace-not-added                  |
      | severity     | error                                  |
      | needs reload | false                                  |
      | summary      | A marketplace operation has failed.    |
      | name         | tools                                  |
      | scope        | project                                |
      | reasons      | marketplace not added to project scope |
    Then the "claude-plugins.json" file of the user scope declares these marketplaces:
      | name  | source                    |
      | tools | {home}/marketplaces/tools |
    Then the "claude-plugins.json" file of the project scope does not exist

  Scenario: Removing a project-only marketplace from user reports the missed scope
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" is added to the project scope
    When the user runs "/claude:plugin marketplace remove tools --scope user"
    Then the result has these fields:
      | kind         | marketplace-not-added               |
      | severity     | error                               |
      | needs reload | false                               |
      | summary      | A marketplace operation has failed. |
      | name         | tools                               |
      | scope        | user                                |
      | reasons      | marketplace not added to user scope |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name  | source                    |
      | tools | {home}/marketplaces/tools |
    Then the "claude-plugins.json" file of the user scope does not exist

  Scenario: An unscoped remove of an unknown marketplace has no scope
    When the user runs "/claude:plugin marketplace remove tools"
    Then the result has these fields:
      | kind         | marketplace-not-added               |
      | severity     | error                               |
      | needs reload | false                               |
      | summary      | A marketplace operation has failed. |
      | name         | tools                               |
      | reasons      | marketplace not added               |

  Scenario: Repeating rm after removal reports the marketplace not added
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "extras" is published as a dir source
    Given the marketplace "tools" is added to the project scope
    Given the marketplace "extras" is added to the project scope
    Given the user has run "/claude:plugin marketplace rm tools --scope project"
    When the user runs "/claude:plugin marketplace rm tools --scope project"
    Then the result has these fields:
      | kind         | marketplace-not-added               |
      | severity     | error                               |
      | needs reload | false                               |
      | summary      | A marketplace operation has failed. |
      | name         | tools                               |
      | scope        | project                             |
      | reasons      | marketplace not added               |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name   | source                     |
      | extras | {home}/marketplaces/extras |

  Scenario: Removing a marketplace with --local clears only its local declaration
    Given the marketplace "base" is published as a dir source
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "extras" is published as a dir source
    Given the marketplace "base" is added to the project scope
    Given the user has run "/claude:plugin marketplace add {home}/marketplaces/tools --scope project --local"
    Given the user has run "/claude:plugin marketplace add {home}/marketplaces/extras --scope project --local"
    When the user runs "/claude:plugin marketplace remove tools --scope project --local"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope   | status  |
      | tools | project | removed |
    Then the "claude-plugins.local.json" file of the project scope declares these marketplaces:
      | name   | source                     |
      | extras | {home}/marketplaces/extras |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name | source                   |
      | base | {home}/marketplaces/base |

  Scenario: A marketplace removed with --local stays removed in a new session
    Given the marketplace "tools" is published as a dir source
    Given the user has run "/claude:plugin marketplace add {home}/marketplaces/tools --scope project --local"
    Given the user has started a new pi session
    Given the user has run "/claude:plugin marketplace remove tools --scope project --local"
    Given the user has started a new pi session
    When the user runs "/claude:plugin marketplace list"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists no marketplaces
    Then the "claude-plugins.json" file of the project scope does not exist
    Then the "claude-plugins.local.json" file of the project scope declares no marketplaces

  Scenario: Removing without --local a marketplace added with --local fails as marketplace in local layer only
    Given the marketplace "tools" is published as a dir source
    Given the user has run "/claude:plugin marketplace add {home}/marketplaces/tools --scope project --local"
    When the user runs "/claude:plugin marketplace remove tools --scope project"
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

  Scenario: Removing with --local a marketplace only the base layer declares fails as marketplace in base layer only
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" is added to the project scope
    When the user runs "/claude:plugin marketplace remove tools --scope project --local"
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

  Scenario: Removing a marketplace from the base layer keeps its declaration in the local layer
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin marketplace add {home}/marketplaces/tools --scope project --local"
    When the user runs "/claude:plugin marketplace remove tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope   | status  |
      | tools | project | removed |
    Then the "claude-plugins.json" file of the project scope declares no marketplaces
    Then the "claude-plugins.local.json" file of the project scope declares these marketplaces:
      | name  | source                    |
      | tools | {home}/marketplaces/tools |

  Scenario: A marketplace removed from one layer is still listed in a new session
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin marketplace add {home}/marketplaces/tools --scope project --local"
    Given the user has run "/claude:plugin marketplace remove tools --scope project"
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

  Scenario: Removing a marketplace from the base layer uninstalls only the plugins that layer declares
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins:
      | name  | version |
      | alpha | 1.0.0   |
      | beta  | 1.0.0   |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin marketplace add {home}/marketplaces/tools --scope project --local"
    Given the user has run "/claude:plugin install alpha@tools --scope project"
    Given the user has run "/claude:plugin install beta@tools --scope project --local"
    When the user runs "/claude:plugin marketplace remove tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace status | id          | name  | status      | reasons | scope   |
      | tools            | project           | removed            | alpha@tools | alpha | uninstalled |         | project |
    Then the "claude-plugins.json" file of the project scope declares no marketplaces
    Then the "claude-plugins.json" file of the project scope declares no plugins
    Then the "claude-plugins.local.json" file of the project scope declares these marketplaces:
      | name  | source                    |
      | tools | {home}/marketplaces/tools |
    Then the "claude-plugins.local.json" file of the project scope declares these plugins:
      | id         |
      | beta@tools |

  Scenario: Removing a marketplace from the base layer uninstalls the dependencies of the plugins it removes
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name  | version | dependencies |
      | alpha | 1.0.0   | lib          |
      | beta  | 1.0.0   |              |
      | lib   | 1.0.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin marketplace add {home}/marketplaces/tools --scope project --local"
    Given the user has run "/claude:plugin install alpha@tools --scope project"
    Given the user has run "/claude:plugin install beta@tools --scope project --local"
    When the user runs "/claude:plugin marketplace remove tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace status | id          | name  | status      | reasons | scope   |
      | tools            | project           | removed            | alpha@tools | alpha | uninstalled |         | project |
      | tools            | project           | removed            | lib@tools   | lib   | uninstalled |         | project |
    Then the "claude-plugins.json" file of the project scope declares no plugins
    Then the "claude-plugins.local.json" file of the project scope declares these plugins:
      | id         |
      | beta@tools |

  Scenario: Removing a marketplace from the base layer keeps a dependency that a plugin of the local layer still needs
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name  | version | dependencies |
      | alpha | 1.0.0   | lib          |
      | beta  | 1.0.0   | lib          |
      | lib   | 1.0.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin marketplace add {home}/marketplaces/tools --scope project --local"
    Given the user has run "/claude:plugin install alpha@tools --scope project"
    Given the user has run "/claude:plugin install beta@tools --scope project --local"
    When the user runs "/claude:plugin marketplace remove tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace status | id          | name  | status      | reasons | scope   |
      | tools            | project           | removed            | alpha@tools | alpha | uninstalled |         | project |
    Then the "claude-plugins.local.json" file of the project scope declares these plugins:
      | id         |
      | beta@tools |
    When the user starts a new pi session
    Then the session offers these skills:
      | command           | description            |
      | /skill:beta-skill | A skill of beta 1.0.0. |
      | /skill:lib-skill  | A skill of lib 1.0.0.  |

  Scenario: Removing a marketplace from the base layer goes ahead when only a disabled plugin of the local layer needs one of its plugins
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name  | version | dependencies |
      | alpha | 1.0.0   |              |
      | beta  | 1.0.0   | alpha        |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin marketplace add {home}/marketplaces/tools --scope project --local"
    Given the user has run "/claude:plugin install alpha@tools --scope project"
    Given the user has run "/claude:plugin install beta@tools --scope project --local"
    Given the user has run "/claude:plugin disable beta@tools --scope project --local"
    When the user runs "/claude:plugin marketplace remove tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace status | id          | name  | status      | reasons | scope   |
      | tools            | project           | removed            | alpha@tools | alpha | uninstalled |         | project |
    Then the "claude-plugins.json" file of the project scope declares no plugins

  Scenario: Removing a marketplace from the base layer fails while a plugin of the local layer still needs one of its plugins
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name  | version | dependencies |
      | alpha | 1.0.0   |              |
      | beta  | 1.0.0   | alpha        |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin marketplace add {home}/marketplaces/tools --scope project --local"
    Given the user has run "/claude:plugin install alpha@tools --scope project"
    Given the user has run "/claude:plugin install beta@tools --scope project --local"
    When the user runs "/claude:plugin marketplace remove tools --scope project"
    Then the result has these fields:
      | kind         | cascade                      |
      | severity     | error                        |
      | needs reload | false                        |
      | summary      | Some operations have failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace status | id          | name  | status | reasons           | scope   | cause chain                                                          | cause truncated | leaks | rollback partial |
      | tools            | project           | failed             | alpha@tools | alpha | failed | dependents remain | project | Uninstall beta@tools first, then remove the marketplace tools again. | false           |       |                  |
    Then the "claude-plugins.json" file of the project scope declares these plugins:
      | id          |
      | alpha@tools |
    When the user starts a new pi session
    Then the session offers these skills:
      | command            | description             |
      | /skill:alpha-skill | A skill of alpha 1.0.0. |
      | /skill:beta-skill  | A skill of beta 1.0.0.  |

  Scenario: A refused remove reports every blocking plugin without removing any
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name         | version | dependencies |
      | zebra        | 1.0.0   |              |
      | amber        | 1.0.0   |              |
      | elm          | 1.0.0   |              |
      | keeper-zebra | 1.0.0   | zebra        |
      | keeper-amber | 1.0.0   | amber        |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin marketplace add {home}/marketplaces/tools --scope project --local"
    Given the user has run "/claude:plugin install zebra@tools --scope project"
    Given the user has run "/claude:plugin install amber@tools --scope project"
    Given the user has run "/claude:plugin install elm@tools --scope project"
    Given the user has run "/claude:plugin install keeper-zebra@tools --scope project --local"
    Given the user has run "/claude:plugin install keeper-amber@tools --scope project --local"
    When the user runs "/claude:plugin marketplace remove tools --scope project"
    Then the result has these fields:
      | kind         | cascade                      |
      | severity     | error                        |
      | needs reload | false                        |
      | summary      | Some operations have failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace status | id          | name  | status | reasons           | scope   | cause chain                                                                  | cause truncated | leaks | rollback partial |
      | tools            | project           | failed             | zebra@tools | zebra | failed | dependents remain | project | Uninstall keeper-zebra@tools first, then remove the marketplace tools again. | false           |       |                  |
      | tools            | project           | failed             | amber@tools | amber | failed | dependents remain | project | Uninstall keeper-amber@tools first, then remove the marketplace tools again. | false           |       |                  |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name  | source                    |
      | tools | {home}/marketplaces/tools |
    Then the "claude-plugins.json" file of the project scope declares these plugins:
      | id          |
      | zebra@tools |
      | amber@tools |
      | elm@tools   |
    Then the "claude-plugins.local.json" file of the project scope declares these marketplaces:
      | name  | source                    |
      | tools | {home}/marketplaces/tools |
    Then the "claude-plugins.local.json" file of the project scope declares these plugins:
      | id                 |
      | keeper-zebra@tools |
      | keeper-amber@tools |
    When the user starts a new pi session
    Then the session offers these skills:
      | command                   | description                    |
      | /skill:amber-skill        | A skill of amber 1.0.0.        |
      | /skill:elm-skill          | A skill of elm 1.0.0.          |
      | /skill:keeper-amber-skill | A skill of keeper-amber 1.0.0. |
      | /skill:keeper-zebra-skill | A skill of keeper-zebra 1.0.0. |
      | /skill:zebra-skill        | A skill of zebra 1.0.0.        |

  Scenario: Removing a marketplace whose dependency declarations cannot be read fails and changes nothing
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name  | version | dependencies |
      | alpha | 1.0.0   | lib          |
      | lib   | 1.0.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install alpha@tools --scope project"
    Given the manifest of the marketplace "tools" has become invalid
    When the user runs "/claude:plugin marketplace remove tools --scope project"
    Then the result has these fields:
      | kind         | cascade                      |
      | severity     | error                        |
      | needs reload | false                        |
      | summary      | Some operations have failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace status | id    | name  | status | reasons    | scope   | cause chain                                                                    | cause truncated | leaks | rollback partial |
      | tools            | project           | failed             | tools | tools | failed | unreadable | project | cannot read the dependencies of lib@tools: its marketplace manifest is invalid | false           |       |                  |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name  | source                    |
      | tools | {home}/marketplaces/tools |
    Then the "claude-plugins.json" file of the project scope declares these plugins:
      | id          |
      | alpha@tools |
    When the user starts a new pi session
    Then the session reports these results:
      | kind                      | severity | needs reload | summary                             | tally label | tally failures | tally warnings |
      | reconcile-applied-cascade | warning  | false        | A plugin operation needs attention. | Reconcile   | 0              | 1              |
      | reconcile-applied-cascade | warning  | false        | A plugin operation needs attention. | Reconcile   | 0              | 1              |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id        | name | status | reasons          | scope   | leaks | rollback partial | cause chain                                                                    | cause truncated |
      | tools            | project           | lib@tools | lib  | failed | invalid manifest | project |       |                  | cannot read the dependencies of lib@tools: its marketplace manifest is invalid | false           |
      | tools            | project           | lib@tools | lib  | failed | invalid manifest | project |       |                  | cannot read the dependencies of lib@tools: its marketplace manifest is invalid | false           |
    Then the session offers these skills:
      | command            | description             |
      | /skill:alpha-skill | A skill of alpha 1.0.0. |
      | /skill:lib-skill   | A skill of lib 1.0.0.   |

  Scenario: Removing a marketplace keeps a dependency that a plugin of another marketplace still needs
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name  | version | dependencies |
      | alpha | 1.0.0   | lib          |
      | lib   | 1.0.0   |              |
    Given the marketplace "upstream" is published as a dir source
    Given the marketplace "upstream" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib@tools    |
    Given the marketplace "upstream" allows dependencies on the marketplace "tools"
    Given the marketplace "upstream" is added to the user scope
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install alpha@tools --scope project"
    Given the user has run "/claude:plugin install app@upstream --scope project"
    When the user runs "/claude:plugin marketplace remove tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace status | id          | name  | status      | reasons | scope   |
      | tools            | project           | removed            | alpha@tools | alpha | uninstalled |         | project |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name     | source                       |
      | upstream | {home}/marketplaces/upstream |
    Then the "claude-plugins.json" file of the project scope declares these plugins:
      | id           |
      | app@upstream |
    When the user starts a new pi session
    Then the session offers these skills:
      | command          | description           |
      | /skill:app-skill | A skill of app 1.0.0. |
      | /skill:lib-skill | A skill of lib 1.0.0. |

  Scenario: A marketplace whose removal kept a dependency is still listed
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name  | version | dependencies |
      | alpha | 1.0.0   | lib          |
      | lib   | 1.0.0   |              |
    Given the marketplace "upstream" is published as a dir source
    Given the marketplace "upstream" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib@tools    |
    Given the marketplace "upstream" allows dependencies on the marketplace "tools"
    Given the marketplace "upstream" is added to the user scope
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install alpha@tools --scope project"
    Given the user has run "/claude:plugin install app@upstream --scope project"
    Given the user has run "/claude:plugin marketplace remove tools --scope project"
    When the user runs "/claude:plugin marketplace list --scope project"
    Then the result has these fields:
      | kind                | cascade          |
      | severity            | info             |
      | needs reload        | false            |
      | tally label         | Marketplace list |
      | tally failures      | 0                |
      | tally warnings      | 0                |
      | tally success count | 2                |
    Then the result lists these marketplaces:
      | name     | scope   | details autoupdate | details last updated at |
      | tools    | project | false              | {scenario time}         |
      | upstream | project | false              | {scenario time}         |

  Scenario Outline: Removing a marketplace from the user scope keeps the plugins the project installed from it
    Given the marketplace "tools" is published as a <source kind> source
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "tools" is added to the user scope
    Given the user has run "/claude:plugin install demo@tools --scope project"
    Given the user has run "/claude:plugin marketplace remove tools --scope user"
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
      | marketplace name | marketplace scope | id         | name | status    | reasons | scope   | version |
      | tools            | project           | demo@tools | demo | installed |         | project | 1.0.0   |

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

  Scenario Outline: Removing a marketplace from the user scope keeps the info of a plugin the project installed from it
    Given the marketplace "tools" is published as a <source kind> source
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "tools" is added to the user scope
    Given the user has run "/claude:plugin install demo@tools --scope project"
    Given the user has run "/claude:plugin marketplace remove tools --scope user"
    When the user runs "/claude:plugin info demo@tools --scope project"
    Then the result has these fields:
      | kind                           | plugin-info |
      | severity                       | info        |
      | needs reload                   | false       |
      | marketplace name               | tools       |
      | marketplace scope              | project     |
      | marketplace details autoupdate | false       |
      | plugin status                  | installed   |
      | plugin name                    | demo        |
      | plugin id                      | demo@tools  |
      | plugin reasons                 |             |
      | plugin scope                   | project     |
      | plugin version                 | 1.0.0       |
      | plugin components resolved     | true        |
      | plugin components skills       | demo-skill  |

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

  Scenario Outline: Removing a marketplace from the user scope keeps the marketplace updatable in the project scope
    Given the marketplace "tools" is published as a <source kind> source
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "tools" is added to the user scope
    Given the user has run "/claude:plugin install demo@tools --scope project"
    Given the user has run "/claude:plugin marketplace remove tools --scope user"
    When the user runs "/claude:plugin marketplace update tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope   | status  | reasons    |
      | tools | project | skipped | up-to-date |

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

  Scenario: Removing a marketplace deletes the clones of the git-source plugins it uninstalls
    Given the git repository "ghp" holds these plugins:
      | name | version | path |
      | ghp  | 1.0.0   |      |
    Given the git repository "mono" holds these plugins:
      | name | version | path         |
      | subp | 1.0.0   | plugins/subp |
    Given the marketplace "gits" is published as a dir source
    Given the marketplace "gits" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | ghp  | github      | ghp        | false  |
      | subp | git-subdir  | mono       | true   |
    Given the marketplace "gits" is added to the project scope
    Given the user has run "/claude:plugin install ghp@gits --scope project"
    Given the user has run "/claude:plugin install subp@gits --scope project"
    When the user runs "/claude:plugin marketplace remove gits --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace status | id        | name | status      | reasons | scope   |
      | gits             | project           | removed            | ghp@gits  | ghp  | uninstalled |         | project |
      | gits             | project           | removed            | subp@gits | subp | uninstalled |         | project |
    Then the project scope holds no git clones
    Then the git host receives no request

  Scenario: Removing a marketplace keeps a pinned clone that a plugin of another marketplace still uses
    Given the git repository "mono" holds these plugins:
      | name | version | path         |
      | subp | 1.0.0   | plugins/subp |
      | subq | 1.0.0   | plugins/subq |
    Given the marketplace "gits" is published as a dir source
    Given the marketplace "gits" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | subp | git-subdir  | mono       | true   |
    Given the marketplace "others" is published as a dir source
    Given the marketplace "others" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | subq | git-subdir  | mono       | true   |
    Given the marketplace "gits" is added to the project scope
    Given the marketplace "others" is added to the project scope
    Given the user has run "/claude:plugin install subp@gits --scope project"
    Given the user has run "/claude:plugin install subq@others --scope project"
    When the user runs "/claude:plugin marketplace remove gits --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace status | id        | name | status      | reasons | scope   |
      | gits             | project           | removed            | subp@gits | subp | uninstalled |         | project |
    Then the project scope holds these git clones:
      | clone  | origin                           | revision          |
      | plugin | https://{git host}/acme/mono.git | {mono revision 1} |
    Then the git host receives no request
