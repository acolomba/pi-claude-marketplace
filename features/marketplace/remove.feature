Feature: Marketplace remove

  Removing a marketplace drops its declaration from one configuration file of a
  scope and uninstalls the plugins that file declares from it. The scenarios run the
  real extension in a headless Pi and use local marketplaces in place of published ones.

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
      | marketplace name | marketplace scope | marketplace status | id          | name  | status | reasons                         | scope   | cause chain                                                                                                                 | cause truncated | leaks | rollback partial |
      | tools            | project           | failed             | tools@tools | tools | failed | marketplace in local layer only | project | The marketplace tools is declared only in the local config (claude-plugins.local.json). Run the command again with --local. | false           |       |                  |
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
      | marketplace name | marketplace scope | marketplace status | id          | name  | status | reasons                        | scope   | cause chain                                                                                                             | cause truncated | leaks | rollback partial |
      | tools            | project           | failed             | tools@tools | tools | failed | marketplace in base layer only | project | The marketplace tools is declared only in the base config (claude-plugins.json). Run the command again without --local. | false           |       |                  |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name  | source                    |
      | tools | {home}/marketplaces/tools |
    Then the "claude-plugins.local.json" file of the project scope does not exist

  Scenario: Removing a marketplace from the shared configuration keeps its declaration in the local configuration
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

  Scenario: A marketplace removed from one configuration is still listed in a new session
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

  Scenario: Removing a marketplace from the shared configuration uninstalls only the plugins that configuration declares
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

  Scenario: Removing a marketplace from the shared configuration uninstalls the dependencies of the plugins it removes
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

  Scenario: Removing a marketplace from the shared configuration keeps a dependency that a plugin of the local configuration still needs
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

  Scenario: Removing a marketplace from the shared configuration fails while a plugin of the local configuration still needs one of its plugins
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
      | marketplace name | marketplace scope | marketplace status | id          | name  | status | reasons    | scope   | cause chain                                                                                         | cause truncated | leaks | rollback partial |
      | tools            | project           | failed             | tools@tools | tools | failed | unreadable | project | cannot read the dependencies of lib@tools: marketplace.json schema invalid: /plugins: must be array | false           |       |                  |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name  | source                    |
      | tools | {home}/marketplaces/tools |
    Then the "claude-plugins.json" file of the project scope declares these plugins:
      | id          |
      | alpha@tools |
    When the user starts a new pi session
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
