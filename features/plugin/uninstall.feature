Feature: Plugin uninstall

  Uninstalling a plugin removes it and its record from the chosen scope.
  The scenarios run the real extension in a headless Pi, read its JSON results,
  and use a local marketplace in place of a published one.

  Background:
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" is added to the project scope

  Scenario: Uninstalling an installed plugin reports it uninstalled from the chosen scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    When the user runs "/claude:plugin uninstall demo@fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status      | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | uninstalled |         | project | 1.0.0   |

  Scenario: A new session no longer offers the skills of the uninstalled plugin
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has run "/claude:plugin uninstall demo@fixtures --scope project"
    When the user starts a new pi session
    Then the session offers no skills

  Scenario: The plugin list shows the uninstalled plugin as available
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has run "/claude:plugin uninstall demo@fixtures --scope project"
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
      | marketplace name | marketplace scope | id            | name | status    | reasons | version |
      | fixtures         | project           | demo@fixtures | demo | available |         | 1.0.0   |

  Scenario: Uninstalling a plugin that is not installed fails as not installed
    When the user runs "/claude:plugin uninstall demo@fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status | reasons       | scope   | leaks | rollback partial |
      | fixtures         | project           | demo@fixtures | demo | failed | not installed | project |       |                  |

  Scenario: Uninstalling without --local a plugin installed with --local fails as plugin in local layer only
    Given the user has run "/claude:plugin install demo@fixtures --scope project --local"
    When the user runs "/claude:plugin uninstall demo@fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status | reasons                    | scope   | version | cause chain                                                                                                                    | cause truncated | leaks | rollback partial |
      | fixtures         | project           | demo@fixtures | demo | failed | plugin in local layer only | project | 1.0.0   | The plugin demo@fixtures is declared only in the local config (claude-plugins.local.json). Run the command again with --local. | false           |       |                  |
    Then the "claude-plugins.local.json" file of the project scope declares these plugins:
      | id            |
      | demo@fixtures |
    Then the "claude-plugins.json" file of the project scope declares no plugins
    When the user starts a new pi session
    Then the session offers these skills:
      | command           | description            |
      | /skill:demo-skill | A skill of demo 1.0.0. |

  Scenario: Uninstalling with --local a plugin only the base layer declares fails as plugin in base layer only
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    When the user runs "/claude:plugin uninstall demo@fixtures --scope project --local"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status | reasons                   | scope   | version | cause chain                                                                                                                | cause truncated | leaks | rollback partial |
      | fixtures         | project           | demo@fixtures | demo | failed | plugin in base layer only | project | 1.0.0   | The plugin demo@fixtures is declared only in the base config (claude-plugins.json). Run the command again without --local. | false           |       |                  |
    Then the "claude-plugins.json" file of the project scope declares these plugins:
      | id            |
      | demo@fixtures |
    Then the "claude-plugins.local.json" file of the project scope does not exist
    When the user starts a new pi session
    Then the session offers these skills:
      | command           | description            |
      | /skill:demo-skill | A skill of demo 1.0.0. |

  Scenario: Uninstalling with --local a plugin both layers declare keeps it installed and drops only the local declaration
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has run "/claude:plugin install demo@fixtures --scope project --local"
    When the user runs "/claude:plugin uninstall demo@fixtures --scope project --local"
    Then the result has these fields:
      | kind         | cascade                             |
      | severity     | warning                             |
      | needs reload | false                               |
      | summary      | A plugin operation needs attention. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status  | reasons                       | scope   | version | cause chain                                            | cause truncated | leaks | rollback partial |
      | fixtures         | project           | demo@fixtures | demo | skipped | still installed in base layer | project | 1.0.0   | Run the command again without --local to uninstall it. | false           |       |                  |
    Then the "claude-plugins.local.json" file of the project scope declares no plugins
    Then the "claude-plugins.json" file of the project scope declares these plugins:
      | id            |
      | demo@fixtures |
    When the user starts a new pi session
    Then the session offers these skills:
      | command           | description            |
      | /skill:demo-skill | A skill of demo 1.0.0. |

  Scenario: Uninstalling without --local a plugin both layers declare keeps it installed and drops only the shared declaration
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has run "/claude:plugin install demo@fixtures --scope project --local"
    When the user runs "/claude:plugin uninstall demo@fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade                             |
      | severity     | warning                             |
      | needs reload | false                               |
      | summary      | A plugin operation needs attention. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status  | reasons                        | scope   | version | cause chain                                         | cause truncated | leaks | rollback partial |
      | fixtures         | project           | demo@fixtures | demo | skipped | still installed in local layer | project | 1.0.0   | Run the command again with --local to uninstall it. | false           |       |                  |
    Then the "claude-plugins.json" file of the project scope declares no plugins
    Then the "claude-plugins.local.json" file of the project scope declares these plugins:
      | id            |
      | demo@fixtures |
    When the user starts a new pi session
    Then the session offers these skills:
      | command           | description            |
      | /skill:demo-skill | A skill of demo 1.0.0. |

  Scenario: Uninstalling a dependency that a plugin of the shared layer needs fails as dependents remain
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib          |
      | lib  | 1.0.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install app@tools --scope project"
    When the user runs "/claude:plugin uninstall lib@tools --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name | status | reasons           | scope   | version | cause chain                                | cause truncated | leaks | rollback partial |
      | tools            | project           | lib@tools | lib  | failed | dependents remain | project | 1.0.0   | Uninstall app@tools first, then lib@tools. | false           |       |                  |
    Then the "claude-plugins.json" file of the project scope declares these plugins:
      | id        |
      | app@tools |
    When the user starts a new pi session
    Then the session offers these skills:
      | command          | description           |
      | /skill:app-skill | A skill of app 1.0.0. |
      | /skill:lib-skill | A skill of lib 1.0.0. |

  Scenario: Uninstalling with --local a dependency that only a plugin of the shared layer needs uninstalls nothing
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib          |
      | lib  | 1.0.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install app@tools --scope project"
    When the user runs "/claude:plugin uninstall lib@tools --scope project --local"
    Then the result has these fields:
      | kind         | cascade                             |
      | severity     | warning                             |
      | needs reload | false                               |
      | summary      | A plugin operation needs attention. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name | status  | reasons           | scope   | version | cause chain                                                                      | cause truncated | leaks | rollback partial |
      | tools            | project           | lib@tools | lib  | skipped | dependents remain | project | 1.0.0   | The base config (claude-plugins.json) declares app@tools, which needs lib@tools. | false           |       |                  |
    Then the "claude-plugins.local.json" file of the project scope does not exist
    Then the "claude-plugins.json" file of the project scope declares these plugins:
      | id        |
      | app@tools |
    When the user starts a new pi session
    Then the session offers these skills:
      | command          | description           |
      | /skill:app-skill | A skill of app 1.0.0. |
      | /skill:lib-skill | A skill of lib 1.0.0. |

  Scenario: Uninstalling a dependency that nothing needs uninstalls it
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib          |
      | lib  | 1.0.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install app@tools --scope project"
    Given the user has run "/claude:plugin uninstall app@tools --scope project"
    When the user runs "/claude:plugin uninstall lib@tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name | status      | reasons | scope   | version |
      | tools            | project           | lib@tools | lib  | uninstalled |         | project | 1.0.0   |
    When the user starts a new pi session
    Then the session offers no skills

  Scenario: Uninstalling a plugin whose dependency declarations cannot be read fails and changes nothing
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib          |
      | lib  | 1.0.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install app@tools --scope project"
    Given the manifest of the marketplace "tools" has become invalid
    When the user runs "/claude:plugin uninstall app@tools --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name | status | reasons    | scope   | version | cause chain                               | cause truncated | leaks | rollback partial |
      | tools            | project           | app@tools | app  | failed | unreadable | project | 1.0.0   | cannot read the dependencies of lib@tools | false           |       |                  |
    Then the "claude-plugins.json" file of the project scope declares these plugins:
      | id        |
      | app@tools |
    When the user starts a new pi session
    Then the session offers these skills:
      | command          | description           |
      | /skill:app-skill | A skill of app 1.0.0. |
      | /skill:lib-skill | A skill of lib 1.0.0. |
