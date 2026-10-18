Feature: Plugin install

  Installing a plugin from an added marketplace materializes it in the chosen scope.
  The scenarios run the real extension in a headless Pi, read its JSON results,
  and use a local marketplace in place of a published one.

  Background:
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" is added to the project scope

  Scenario: Installing a plugin reports it installed in the chosen scope
    When the user runs "/claude:plugin install demo@fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | installed |         | project | 1.0.0   |

  Scenario: A new session offers the skills of the installed plugin
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    When the user starts a new pi session
    Then the session offers these skills:
      | command           | description            |
      | /skill:demo-skill | A skill of demo 1.0.0. |

  Scenario: The plugin list shows the installed plugin
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
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
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | installed |         | project | 1.0.0   |

  Scenario: Installing a plugin the marketplace does not offer fails as not in manifest
    When the user runs "/claude:plugin install missing@fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id               | name    | status | reasons         | scope   | cause chain                                           | cause truncated | leaks | rollback partial |
      | fixtures         | project           | missing@fixtures | missing | failed | not in manifest | project | Plugin "missing" not found in marketplace "fixtures". | false           |       |                  |

  Scenario: Installing a plugin that is already installed fails as already installed
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    When the user runs "/claude:plugin install demo@fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status | reasons           | scope   | cause chain                                                   | cause truncated | leaks | rollback partial |
      | fixtures         | project           | demo@fixtures | demo | failed | already installed | project | Plugin "demo" is already installed in marketplace "fixtures". | false           |       |                  |

  Scenario: Installing a plugin into the base layer from a marketplace added with --local fails as marketplace in local layer only
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | pp   | 1.0.0   |
    Given the user has run "/claude:plugin marketplace add {home}/marketplaces/tools --scope project --local"
    When the user runs "/claude:plugin install pp@tools --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id       | name | status | reasons                         | scope   | cause chain                                                                                                                 | cause truncated | leaks | rollback partial |
      | tools            | project           | pp@tools | pp   | failed | marketplace in local layer only | project | The marketplace tools is declared only in the local config (claude-plugins.local.json). Run the command again with --local. | false           |       |                  |
    Then the "claude-plugins.json" file of the project scope declares no plugins
    Then the "claude-plugins.local.json" file of the project scope declares no plugins
    Then the project scope has no installed plugins

  Scenario: Installing with --local from a marketplace only the base layer declares also declares the marketplace in the local layer
    When the user runs "/claude:plugin install demo@fixtures --scope project --local"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | installed |         | project | 1.0.0   |
    Then the "claude-plugins.local.json" file of the project scope declares these marketplaces:
      | name     | source                       |
      | fixtures | {home}/marketplaces/fixtures |
    Then the "claude-plugins.local.json" file of the project scope declares these plugins:
      | id            |
      | demo@fixtures |
    Then the "claude-plugins.json" file of the project scope declares no plugins

  Scenario: A plugin installed with --local from a marketplace the base layer declares stays installed after the base layer removes the marketplace
    Given the user has run "/claude:plugin install demo@fixtures --scope project --local"
    Given the user has run "/claude:plugin marketplace remove fixtures --scope project"
    When the user starts a new pi session
    Then the session offers these skills:
      | command           | description            |
      | /skill:demo-skill | A skill of demo 1.0.0. |

  Scenario: Installing with --local a plugin the base layer declares but has not installed installs it
    Given a plugin configuration file in scope project and layer base, with these plugins:
      | marketplace | plugin | enabled |
      | fixtures    | demo   |         |
    When the user runs "/claude:plugin install demo@fixtures --scope project --local"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | installed |         | project | 1.0.0   |
    Then the "claude-plugins.local.json" file of the project scope declares these plugins:
      | id            |
      | demo@fixtures |
    Then the "claude-plugins.local.json" file of the project scope declares these marketplaces:
      | name     | source                       |
      | fixtures | {home}/marketplaces/fixtures |
    Then the "claude-plugins.json" file of the project scope declares these plugins:
      | id            |
      | demo@fixtures |

  Scenario: Installing with --local a plugin the base layer declares adds the local declaration and installs nothing
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    When the user runs "/claude:plugin install demo@fixtures --scope project --local"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status  | reasons                         | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | skipped | already installed in base layer | project | 1.0.0   |
    Then the "claude-plugins.local.json" file of the project scope declares these plugins:
      | id            |
      | demo@fixtures |
    Then the "claude-plugins.local.json" file of the project scope declares these marketplaces:
      | name     | source                       |
      | fixtures | {home}/marketplaces/fixtures |
    Then the "claude-plugins.json" file of the project scope declares these plugins:
      | id            |
      | demo@fixtures |

  Scenario: Installing without --local a plugin installed with --local adds the declaration in the base layer and installs nothing
    Given the user has run "/claude:plugin install demo@fixtures --scope project --local"
    When the user runs "/claude:plugin install demo@fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status  | reasons                          | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | skipped | already installed in local layer | project | 1.0.0   |
    Then the "claude-plugins.json" file of the project scope declares these plugins:
      | id            |
      | demo@fixtures |
    Then the "claude-plugins.local.json" file of the project scope declares these plugins:
      | id            |
      | demo@fixtures |
