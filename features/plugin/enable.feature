Feature: Plugin enable

  Enabling a plugin acts on the layer the command names and materializes the plugin again.
  The scenarios run the real extension in a headless Pi, read its JSON results,
  and use a local marketplace in place of a published one.

  Background:
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" is added to the project scope

  Scenario: Enabling without --local a plugin disabled with --local fails as plugin in local layer only
    Given the user has run "/claude:plugin install demo@fixtures --scope project --local"
    Given the user has run "/claude:plugin disable demo@fixtures --scope project --local"
    When the user runs "/claude:plugin enable demo@fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status | reasons                    | scope   | cause chain                                                                                                                    | cause truncated | leaks | rollback partial |
      | fixtures         | project           | demo@fixtures | demo | failed | plugin in local layer only | project | The plugin demo@fixtures is declared only in the local config (claude-plugins.local.json). Run the command again with --local. | false           |       |                  |
    Then the "claude-plugins.local.json" file of the project scope declares these plugins:
      | id            | enabled |
      | demo@fixtures | false   |
    Then the "claude-plugins.json" file of the project scope declares no plugins
    When the user starts a new pi session
    Then the session offers no skills

  Scenario: Enabling without --local a plugin the local layer disables fails as disabled in local layer
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has run "/claude:plugin install demo@fixtures --scope project --local"
    Given the user has run "/claude:plugin disable demo@fixtures --scope project --local"
    When the user runs "/claude:plugin enable demo@fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status | reasons                 | scope   | cause chain                                      | cause truncated | leaks | rollback partial |
      | fixtures         | project           | demo@fixtures | demo | failed | disabled in local layer | project | Run the command again with --local to enable it. | false           |       |                  |
    Then the "claude-plugins.local.json" file of the project scope declares these plugins:
      | id            | enabled |
      | demo@fixtures | false   |
    Then the "claude-plugins.json" file of the project scope declares these plugins:
      | id            |
      | demo@fixtures |
    When the user starts a new pi session
    Then the session offers no skills

  Scenario: Enabling a disabled plugin offers its skills again and keeps one installation record
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has run "/claude:plugin disable demo@fixtures --scope project"
    When the user runs "/claude:plugin enable demo@fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | installed |         | project | 1.0.0   |
    Then the installation record of the project scope holds these plugins:
      | id            | version | enabled |
      | demo@fixtures | 1.0.0   | true    |
    When the user starts a new pi session
    Then the session offers these skills:
      | command           | description            |
      | /skill:demo-skill | A skill of demo 1.0.0. |

  Scenario: Enabling an enabled plugin is skipped as already enabled
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    When the user runs "/claude:plugin enable demo@fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status  | reasons         | scope   |
      | fixtures         | project           | demo@fixtures | demo | skipped | already enabled | project |
    Then the installation record of the project scope holds these plugins:
      | id            | version | enabled |
      | demo@fixtures | 1.0.0   | true    |
    Then the "claude-plugins.json" file of the project scope declares these plugins:
      | id            |
      | demo@fixtures |

  Scenario: Enabling a plugin that is not installed fails as not installed
    When the user runs "/claude:plugin enable demo@fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status  | reasons       | scope   |
      | fixtures         | project           | demo@fixtures | demo | skipped | not installed | project |
    Then the "claude-plugins.json" file of the project scope declares no plugins
    When the user starts a new pi session
    Then the session offers no skills

  Scenario: Enabling in the user scope leaves the project scope unchanged
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has run "/claude:plugin disable demo@fixtures --scope user"
    Given the user has run "/claude:plugin disable demo@fixtures --scope project"
    When the user runs "/claude:plugin enable demo@fixtures --scope user"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope | version |
      | fixtures         | user              | demo@fixtures | demo | installed |         | user  | 1.0.0   |
    Then the installation record of the user scope holds these plugins:
      | id            | version | enabled |
      | demo@fixtures | 1.0.0   | true    |
    Then the installation record of the project scope holds these plugins:
      | id            | version | enabled |
      | demo@fixtures | 1.0.0   | false   |
    Then the "claude-plugins.json" file of the user scope declares these plugins:
      | id            | enabled |
      | demo@fixtures | true    |
    Then the "claude-plugins.json" file of the project scope declares these plugins:
      | id            | enabled |
      | demo@fixtures | false   |
    When the user starts a new pi session in another project
    Then the session offers these skills:
      | command           | description            |
      | /skill:demo-skill | A skill of demo 1.0.0. |

  Scenario: Enabling in the project scope leaves the user scope unchanged
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has run "/claude:plugin disable demo@fixtures --scope user"
    Given the user has run "/claude:plugin disable demo@fixtures --scope project"
    When the user runs "/claude:plugin enable demo@fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | installed |         | project | 1.0.0   |
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
      | id            | enabled |
      | demo@fixtures | true    |
    When the user starts a new pi session
    Then the session offers these skills:
      | command           | description            |
      | /skill:demo-skill | A skill of demo 1.0.0. |
    When the user starts a new pi session in another project
    Then the session offers no skills

  Scenario: Enabling a plugin enables its disabled dependency too
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib          |
      | lib  | 1.2.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install app@tools --scope project"
    Given the user has run "/claude:plugin disable app@tools --scope project"
    Given the user has run "/claude:plugin disable lib@tools --scope project"
    When the user runs "/claude:plugin enable app@tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name      | status    | reasons            | scope   | version |
      | tools            | project           | app@tools | app       | installed |                    | project | 1.0.0   |
      | tools            | project           | lib@tools | lib@tools | installed | dependency enabled | project | 1.2.0   |
    Then the installation record of the project scope holds these plugins:
      | id        | version | enabled |
      | app@tools | 1.0.0   | true    |
      | lib@tools | 1.2.0   | true    |
    Then the "claude-plugins.json" file of the project scope declares these plugins:
      | id        | enabled |
      | app@tools | true    |
      | lib@tools | true    |
    When the user starts a new pi session
    Then the session offers these skills:
      | command          | description           |
      | /skill:app-skill | A skill of app 1.0.0. |
      | /skill:lib-skill | A skill of lib 1.2.0. |

  Scenario: Enabling a git-source plugin enables the dependency its installed copy declares, not the one its marketplace now lists
    Given the git repository "app" holds these plugins:
      | name | version | path | dependencies |
      | app  | 1.0.0   |      | lib          |
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | lib  | 1.2.0   |              |
    Given the marketplace "tools" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | app  | url         | app        | true   |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install lib@tools --scope project"
    Given the user has run "/claude:plugin install app@tools --scope project"
    Given the git repository "app" holds these plugins:
      | name | version | path |
      | app  | 1.0.0   |      |
    Given the marketplace "tools" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | app  | url         | app        | true   |
    Given the user has run "/claude:plugin disable app@tools --scope project"
    Given the user has run "/claude:plugin disable lib@tools --scope project"
    When the user runs "/claude:plugin enable app@tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name      | status    | reasons            | scope   | version |
      | tools            | project           | app@tools | app       | installed |                    | project | 1.0.0   |
      | tools            | project           | lib@tools | lib@tools | installed | dependency enabled | project | 1.2.0   |
    Then the installation record of the project scope holds these plugins:
      | id        | version | enabled |
      | app@tools | 1.0.0   | true    |
      | lib@tools | 1.2.0   | true    |

  Scenario: Enabling a git-source plugin follows a manifest that its installed copy links inside the copy
    Given the git repository "app" holds these plugins:
      | name | version | path | dependencies |
      | app  | 1.0.0   |      | lib          |
    Given the git repository "app" links the manifest of the plugin "app" to a file inside the plugin
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | lib  | 1.2.0   |              |
    Given the marketplace "tools" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | app  | url         | app        | true   |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install lib@tools --scope project"
    Given the user has run "/claude:plugin install app@tools --scope project"
    Given the git repository "app" holds these plugins:
      | name | version | path |
      | app  | 1.0.0   |      |
    Given the marketplace "tools" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | app  | url         | app        | true   |
    Given the user has run "/claude:plugin disable app@tools --scope project"
    Given the user has run "/claude:plugin disable lib@tools --scope project"
    When the user runs "/claude:plugin enable app@tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name      | status    | reasons            | scope   | version |
      | tools            | project           | app@tools | app       | installed |                    | project | 1.0.0   |
      | tools            | project           | lib@tools | lib@tools | installed | dependency enabled | project | 1.2.0   |
    Then the installation record of the project scope holds these plugins:
      | id        | version | enabled |
      | app@tools | 1.0.0   | true    |
      | lib@tools | 1.2.0   | true    |

  Scenario: Enabling a plugin whose dependency is not installed fails as dependency unsatisfied
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib          |
      | lib  | 1.2.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install lib@tools --scope project"
    Given the user has run "/claude:plugin install app@tools --scope project"
    Given the user has run "/claude:plugin disable app@tools --scope project"
    Given the user has run "/claude:plugin uninstall lib@tools --scope project"
    When the user runs "/claude:plugin enable app@tools --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name | status | reasons                | scope   | cause chain                                     | cause truncated | leaks | rollback partial |
      | tools            | project           | app@tools | app  | failed | dependency unsatisfied | project | Install lib@tools first, then enable app@tools. | false           |       |                  |
    Then the installation record of the project scope holds these plugins:
      | id        | version | enabled |
      | app@tools | 1.0.0   | false   |
    Then the "claude-plugins.json" file of the project scope declares these plugins:
      | id        | enabled |
      | app@tools | false   |
    When the user starts a new pi session
    Then the session offers no skills

  Scenario: Enabling a plugin whose dependency its marketplace no longer lists reads that dependency's own dependencies and enables it
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib          |
      | lib  | 1.0.0   | base         |
      | base | 1.0.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install app@tools --scope project"
    Given the user has run "/claude:plugin disable app@tools --scope project"
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib          |
      | base | 1.0.0   |              |
    When the user runs "/claude:plugin enable app@tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id         | name       | status    | reasons         | scope   | version |
      | tools            | project           | app@tools  | app        | installed |                 | project | 1.0.0   |
      | tools            | project           | base@tools | base@tools | skipped   | already enabled | project | 1.0.0   |
      | tools            | project           | lib@tools  | lib@tools  | skipped   | already enabled | project | 1.0.0   |
    Then the installation record of the project scope holds these plugins:
      | id         | version | enabled |
      | app@tools  | 1.0.0   | true    |
      | base@tools | 1.0.0   | true    |
      | lib@tools  | 1.0.0   | true    |
