Feature: Plugin disable

  Disabling a plugin acts on the layer the command names and keeps the plugin installed.
  The scenarios run the real extension in a headless Pi, read its JSON results,
  and use a local marketplace in place of a published one.

  Background:
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" is added to the project scope

  Scenario: Disabling with --local a plugin only the base layer declares fails as plugin in base layer only
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    When the user runs "/claude:plugin disable demo@fixtures --scope project --local"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status | reasons                   | scope   | cause chain                                                                                                                | cause truncated | leaks | rollback partial |
      | fixtures         | project           | demo@fixtures | demo | failed | plugin in base layer only | project | The plugin demo@fixtures is declared only in the base config (claude-plugins.json). Run the command again without --local. | false           |       |                  |
    Then the "claude-plugins.local.json" file of the project scope does not exist
    Then the "claude-plugins.json" file of the project scope declares these plugins:
      | id            |
      | demo@fixtures |
    When the user starts a new pi session
    Then the session offers these skills:
      | command           | description            |
      | /skill:demo-skill | A skill of demo 1.0.0. |

  Scenario: Disabling without --local a plugin the local layer enables fails as enabled in local layer
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has run "/claude:plugin install demo@fixtures --scope project --local"
    Given the user has run "/claude:plugin disable demo@fixtures --scope project --local"
    Given the user has run "/claude:plugin enable demo@fixtures --scope project --local"
    When the user runs "/claude:plugin disable demo@fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status | reasons                | scope   | cause chain                                       | cause truncated | leaks | rollback partial |
      | fixtures         | project           | demo@fixtures | demo | failed | enabled in local layer | project | Run the command again with --local to disable it. | false           |       |                  |
    Then the "claude-plugins.local.json" file of the project scope declares these plugins:
      | id            | enabled |
      | demo@fixtures | true    |
    Then the "claude-plugins.json" file of the project scope declares these plugins:
      | id            |
      | demo@fixtures |
    When the user starts a new pi session
    Then the session offers these skills:
      | command           | description            |
      | /skill:demo-skill | A skill of demo 1.0.0. |

  Scenario: Disabling an enabled plugin offers none of its skills and keeps it installed
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    When the user runs "/claude:plugin disable demo@fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status   | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | disabled |         | project | 1.0.0   |
    Then the installation record of the project scope holds these plugins:
      | id            | version | enabled |
      | demo@fixtures | 1.0.0   | false   |
    Then the "claude-plugins.json" file of the project scope declares these plugins:
      | id            | enabled |
      | demo@fixtures | false   |
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
      | marketplace name | marketplace scope | id            | name | status   | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | disabled |         | project | 1.0.0   |
    When the user starts a new pi session
    Then the session offers no skills

  Scenario: Disabling a disabled plugin is skipped as already disabled
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has run "/claude:plugin disable demo@fixtures --scope project"
    When the user runs "/claude:plugin disable demo@fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status  | reasons          | scope   |
      | fixtures         | project           | demo@fixtures | demo | skipped | already disabled | project |
    Then the installation record of the project scope holds these plugins:
      | id            | version | enabled |
      | demo@fixtures | 1.0.0   | false   |
    Then the "claude-plugins.json" file of the project scope declares these plugins:
      | id            | enabled |
      | demo@fixtures | false   |

  Scenario: Disabling a plugin that is not installed fails as not installed
    When the user runs "/claude:plugin disable demo@fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status  | reasons       | scope   |
      | fixtures         | project           | demo@fixtures | demo | skipped | not installed | project |
    Then the "claude-plugins.json" file of the project scope declares no plugins

  Scenario: Disabling in the user scope leaves the project scope unchanged
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    When the user runs "/claude:plugin disable demo@fixtures --scope user"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status   | reasons | scope | version |
      | fixtures         | user              | demo@fixtures | demo | disabled |         | user  | 1.0.0   |
    Then the installation record of the user scope holds these plugins:
      | id            | version | enabled |
      | demo@fixtures | 1.0.0   | false   |
    Then the installation record of the project scope holds these plugins:
      | id            | version | enabled |
      | demo@fixtures | 1.0.0   | true    |
    Then the "claude-plugins.json" file of the user scope declares these plugins:
      | id            | enabled |
      | demo@fixtures | false   |
    Then the "claude-plugins.json" file of the project scope declares these plugins:
      | id            |
      | demo@fixtures |
    When the user starts a new pi session
    Then the session offers these skills:
      | command           | description            |
      | /skill:demo-skill | A skill of demo 1.0.0. |
    When the user starts a new pi session in another project
    Then the session offers no skills

  Scenario: Disabling in the project scope leaves the user scope unchanged
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    When the user runs "/claude:plugin disable demo@fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status   | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | disabled |         | project | 1.0.0   |
    Then the installation record of the user scope holds these plugins:
      | id            | version | enabled |
      | demo@fixtures | 1.0.0   | true    |
    Then the installation record of the project scope holds these plugins:
      | id            | version | enabled |
      | demo@fixtures | 1.0.0   | false   |
    Then the "claude-plugins.json" file of the user scope declares these plugins:
      | id            |
      | demo@fixtures |
    Then the "claude-plugins.json" file of the project scope declares these plugins:
      | id            | enabled |
      | demo@fixtures | false   |
    When the user starts a new pi session in another project
    Then the session offers these skills:
      | command           | description            |
      | /skill:demo-skill | A skill of demo 1.0.0. |

  Scenario: Disabling a plugin that an enabled plugin depends on fails as dependents remain
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib          |
      | lib  | 1.2.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install app@tools --scope project"
    When the user runs "/claude:plugin disable lib@tools --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name | status | reasons           | scope   | cause chain                              | cause truncated | leaks | rollback partial |
      | tools            | project           | lib@tools | lib  | failed | dependents remain | project | Disable app@tools first, then lib@tools. | false           |       |                  |
    Then the installation record of the project scope holds these plugins:
      | id        | version | enabled |
      | app@tools | 1.0.0   | true    |
      | lib@tools | 1.2.0   | true    |
    Then the "claude-plugins.json" file of the project scope declares these plugins:
      | id        |
      | app@tools |
    When the user starts a new pi session
    Then the session offers these skills:
      | command          | description           |
      | /skill:app-skill | A skill of app 1.0.0. |
      | /skill:lib-skill | A skill of lib 1.2.0. |

  Scenario: Disabling a plugin that an enabled plugin its marketplace no longer lists depends on fails as dependents remain
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib          |
      | lib  | 1.2.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install app@tools --scope project"
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | lib  | 1.2.0   |              |
    When the user runs "/claude:plugin disable lib@tools --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name | status | reasons           | scope   | cause chain                              | cause truncated | leaks | rollback partial |
      | tools            | project           | lib@tools | lib  | failed | dependents remain | project | Disable app@tools first, then lib@tools. | false           |       |                  |
    Then the installation record of the project scope holds these plugins:
      | id        | version | enabled |
      | app@tools | 1.0.0   | true    |
      | lib@tools | 1.2.0   | true    |
