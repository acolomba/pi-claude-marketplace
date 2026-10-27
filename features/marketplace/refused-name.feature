Feature: Marketplace refused name

  Claude Code stops loading a marketplace recorded under a name it refuses. Pi
  reports it on every command that reads it and keeps removal open. Local
  marketplaces and a record an earlier version wrote stand in for such records.

  Scenario: Updating a marketplace an earlier version recorded under a reserved name fails before it reads its source
    Given the marketplace "claude-plugins-official" is published as a dir source
    Given an earlier version recorded the marketplace "claude-plugins-official" in the project scope
    When the user runs "/claude:plugin marketplace update claude-plugins-official --scope project"
    Then the result has these fields:
      | kind         | cascade                      |
      | severity     | error                        |
      | needs reload | false                        |
      | summary      | Some operations have failed. |
    Then the result lists these plugins:
      | marketplace name        | marketplace scope | marketplace status | id                      | name                    | status | reasons          | scope   | leaks | rollback partial | cause chain                                                                                                                                                                                                                                                                                                                                                                      | cause truncated |
      | claude-plugins-official | project           | failed             | claude-plugins-official | claude-plugins-official | failed | invalid manifest | project |       |                  | Failed to update marketplace "claude-plugins-official"., Marketplace "claude-plugins-official" is registered from an untrusted source: The name 'claude-plugins-official' is reserved for official Anthropic marketplaces and can only be used with GitHub sources from the 'anthropics' organization. To fix it, remove the marketplace and re-add it from the official source. | false           |

  Scenario: Every new session warns about an installed plugin whose marketplace manifest now declares a look-alike name and keeps it working
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install demo@tools --scope project"
    Given the marketplace "tools" publishes this manifest:
      """
      {"name":"claude-plugins-v2","owner":{"name":"features"},"plugins":[{"name":"demo","source":"./plugins/demo","version":"1.0.0"}]}
      """
    When the user starts a new pi session
    Then the session reports these results:
      | kind                      | severity | needs reload | summary                             | tally label | tally failures | tally warnings |
      | reconcile-applied-cascade | warning  | false        | A plugin operation needs attention. | Reconcile   | 0              | 1              |
      | reconcile-applied-cascade | warning  | false        | A plugin operation needs attention. | Reconcile   | 0              | 1              |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id         | name | status | reasons          | scope   | cause chain                                                                            | cause truncated | leaks | rollback partial |
      | tools            | project           | demo@tools | demo | failed | invalid manifest | project | Claude Code refuses the marketplace name "tools": it looks like one of Anthropic's own | false           |       |                  |
      | tools            | project           | demo@tools | demo | failed | invalid manifest | project | Claude Code refuses the marketplace name "tools": it looks like one of Anthropic's own | false           |       |                  |
    Then the session offers these skills:
      | command           | description            |
      | /skill:demo-skill | A skill of demo 1.0.0. |

  Scenario: The plugin list shows a marketplace whose manifest now declares a look-alike name as failed
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install demo@tools --scope project"
    Given the marketplace "tools" publishes this manifest:
      """
      {"name":"claude-plugins-v2","owner":{"name":"features"},"plugins":[{"name":"demo","source":"./plugins/demo","version":"1.0.0"}]}
      """
    When the user runs "/claude:plugin list --scope project"
    Then the result has these fields:
      | kind           | cascade                             |
      | severity       | error                               |
      | needs reload   | false                               |
      | summary        | A marketplace operation has failed. |
      | tally label    | Plugin list                         |
      | tally failures | 1                                   |
      | tally warnings | 0                                   |
    Then the result lists these marketplaces:
      | name  | scope   | status |
      | tools | project | failed |

  Scenario: Marketplace info on a marketplace whose manifest now declares a look-alike name fails as an invalid manifest
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" is added to the project scope
    Given the marketplace "tools" publishes this manifest:
      """
      {"name":"claude-plugins-v2","owner":{"name":"features"},"plugins":[]}
      """
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
      | plugin id                      | tools                          |
      | plugin reasons                 | invalid manifest               |
      | plugin scope                   | project                        |
      | plugin components resolved     | false                          |

  Scenario: Installing from a marketplace an earlier version recorded under a reserved name fails
    Given the marketplace "claude-plugins-official" is published as a dir source
    Given the marketplace "claude-plugins-official" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given an earlier version recorded the marketplace "claude-plugins-official" in the project scope
    When the user runs "/claude:plugin install demo@claude-plugins-official --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name        | marketplace scope | id                           | name | status | reasons | scope   | cause chain                                                                                                                                                                                                                                                                                                             | cause truncated | leaks | rollback partial |
      | claude-plugins-official | project           | demo@claude-plugins-official | demo | failed |         | project | Marketplace "claude-plugins-official" is registered from an untrusted source: The name 'claude-plugins-official' is reserved for official Anthropic marketplaces and can only be used with GitHub sources from the 'anthropics' organization. To fix it, remove the marketplace and re-add it from the official source. | false           |       |                  |
    Then the project scope has no installed plugins

  Scenario: Removing a marketplace an earlier version recorded under a reserved name still works
    Given the marketplace "claude-plugins-official" is published as a dir source
    Given an earlier version recorded the marketplace "claude-plugins-official" in the project scope
    When the user runs "/claude:plugin marketplace remove claude-plugins-official --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name                    | scope   | status  |
      | claude-plugins-official | project | removed |
    Then the "claude-plugins.json" file of the project scope declares no marketplaces
