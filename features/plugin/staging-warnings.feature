Feature: Plugin staging warnings

  A staging verb follows its rows with one diagnostic per plugin that names
  the declared components it skipped. A cascade also lists that plugin's other
  staging warnings. A local marketplace stands in for a published one.

  Background:
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" is added to the project scope

  Scenario: Installing a plugin whose agents share a name reports the skipped agent
    Given the published plugin "demo" of the marketplace "fixtures" has two agents named "helper"
    When the user runs "/claude:plugin install demo@fixtures --scope project"
    Then the command reports these results:
      | kind       | severity | needs reload | summary                             | header                                                              | lines                                                                                                                                                                                        |
      | cascade    | warning  | true         | A plugin operation needs attention. |                                                                     |                                                                                                                                                                                              |
      | diagnostic | warning  | false        |                                     | Plugin "demo" [project] installed; 1 declared component has a note. | agent source "helper" at "[redacted path]                                                                                                                                                    |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons               | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | installed | requires pi-subagents | project | 1.0.0   |

  Scenario: Updating a plugin whose new version has colliding skills reports the skip under a header that names the scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.1.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has a second skill whose name collides with its first
    When the user runs "/claude:plugin update demo@fixtures --scope project"
    Then the command reports these results:
      | kind       | severity | needs reload | header                                                            | lines                                                                                                                                      |
      | cascade    | info     | true         |                                                                   |                                                                                                                                            |
      | diagnostic | warning  | false        | Plugin "demo" [project] updated; 1 declared component has a note. | skill source "skill" in "[redacted path]                                                                                                   |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status  | reasons | scope   | from  | to    |
      | fixtures         | project           | demo@fixtures | demo | updated |         | project | 1.0.0 | 1.1.0 |

  Scenario: Reinstalling a plugin whose skills collide reports the skip under a header that names the scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the published plugin "demo" of the marketplace "fixtures" has a second skill whose name collides with its first
    When the user runs "/claude:plugin reinstall demo@fixtures --scope project"
    Then the command reports these results:
      | kind       | severity | needs reload | header                                                                | lines                                                                                                                                      |
      | cascade    | info     | true         |                                                                       |                                                                                                                                            |
      | diagnostic | warning  | false        | Plugin "demo" [project] reinstalled; 1 declared component has a note. | skill source "skill" in "[redacted path]                                                                                                   |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status      | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | reinstalled |         | project | 1.0.0   |

  Scenario: Installing a plugin whose declared commands path leaves its commands folder unread reports the folder
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".claude-plugin/plugin.json" with this text:
      """
      { "name": "demo", "version": "1.0.0", "commands": "./custom-commands" }
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file "custom-commands/hello.md" with this text:
      """
      Say hello.
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file "commands/old.md" with this text:
      """
      Do the old thing.
      """
    When the user runs "/claude:plugin install demo@fixtures --scope project"
    Then the command reports these results:
      | kind       | severity | needs reload | header                                                              | lines                                                                    |
      | cascade    | info     | true         |                                                                     |                                                                          |
      | diagnostic | warning  | false        | Plugin "demo" [project] installed; 1 declared component has a note. | Default commands/ folder is ignored because the manifest sets "commands" |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | installed |         | project | 1.0.0   |

  Scenario: Updating to a version that declares a commands path reports the folder it leaves unread
    Given the published plugin "demo" of the marketplace "fixtures" has the file "commands/old.md" with this text:
      """
      Do the old thing.
      """
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.1.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".claude-plugin/plugin.json" with this text:
      """
      { "name": "demo", "version": "1.1.0", "commands": "./custom-commands" }
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file "custom-commands/hello.md" with this text:
      """
      Say hello.
      """
    When the user runs "/claude:plugin update demo@fixtures --scope project"
    Then the command reports these results:
      | kind       | severity | needs reload | header                                                            | lines                                                                    |
      | cascade    | info     | true         |                                                                   |                                                                          |
      | diagnostic | warning  | false        | Plugin "demo" [project] updated; 1 declared component has a note. | Default commands/ folder is ignored because the manifest sets "commands" |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status  | reasons | scope   | from  | to    |
      | fixtures         | project           | demo@fixtures | demo | updated |         | project | 1.0.0 | 1.1.0 |

  Scenario: Enabling a plugin whose skills collide reports the skip under a header that names the scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has run "/claude:plugin disable demo@fixtures --scope project"
    Given the published plugin "demo" of the marketplace "fixtures" has a second skill whose name collides with its first
    When the user runs "/claude:plugin enable demo@fixtures --scope project"
    Then the command reports these results:
      | kind       | severity | needs reload | header                                                            | lines                                                                                                                                      |
      | cascade    | info     | true         |                                                                   |                                                                                                                                            |
      | diagnostic | warning  | false        | Plugin "demo" [project] enabled; 1 declared component has a note. | skill source "skill" in "[redacted path]                                                                                                   |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | installed |         | project | 1.0.0   |

  @mcp
  Scenario: An install that fails in its mcp phase reports the skill the skills phase skipped after the failed row
    Given the published plugin "demo" of the marketplace "fixtures" has a second skill whose name collides with its first
    Given a directory blocks the mcp-adapter.json file of the project scope
    When the user runs "/claude:plugin install demo@fixtures --scope project"
    Then the command reports these results:
      | kind       | severity | needs reload | summary                        | header                                                                   | lines                                                                                                                                      |
      | cascade    | error    | false        | A plugin operation has failed. |                                                                          |                                                                                                                                            |
      | diagnostic | warning  | false        |                                | Plugin "demo" [project] install failed; 1 declared component has a note. | skill source "skill" in "[redacted path]                                                                                                   |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status | reasons | scope   | version | cause chain                   | cause truncated | leaks | rollback partial |
      | fixtures         | project           | demo@fixtures | demo | failed |         | project | 1.0.0   | {mcp-adapter.json read error} | false           |       |                  |

  @mcp
  Scenario: An update that fails in its mcp phase reports the skill the skills phase skipped after the failed row
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.1.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has a second skill whose name collides with its first
    Given a directory blocks the mcp-adapter.json file of the project scope
    When the user runs "/claude:plugin update demo@fixtures --scope project"
    Then the command reports these results:
      | kind       | severity | needs reload | summary                        | header                                                                  | lines                                                                                                                                      |
      | cascade    | error    | false        | A plugin operation has failed. |                                                                         |                                                                                                                                            |
      | diagnostic | warning  | false        |                                | Plugin "demo" [project] update failed; 1 declared component has a note. | skill source "skill" in "[redacted path]                                                                                                   |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status | reasons    | scope   | from  | version | cause chain                   | cause truncated | leaks | rollback partial |
      | fixtures         | project           | demo@fixtures | demo | failed | unreadable | project | 1.0.0 | 1.1.0   | {mcp-adapter.json read error} | false           |       |                  |

  @mcp
  Scenario: A reinstall that fails in its mcp phase reports the skill the skills phase skipped after the failed row
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the published plugin "demo" of the marketplace "fixtures" has a second skill whose name collides with its first
    Given a directory blocks the mcp-adapter.json file of the project scope
    When the user runs "/claude:plugin reinstall demo@fixtures --scope project"
    Then the command reports these results:
      | kind       | severity | needs reload | summary                        | header                                                                     | lines                                                                                                                                      |
      | cascade    | error    | false        | A plugin operation has failed. |                                                                            |                                                                                                                                            |
      | diagnostic | warning  | false        |                                | Plugin "demo" [project] reinstall failed; 1 declared component has a note. | skill source "skill" in "[redacted path]                                                                                                   |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status | reasons    | scope   | version | leaks | rollback partial |
      | fixtures         | project           | demo@fixtures | demo | failed | unreadable | project | 1.0.0   |       |                  |

  Scenario: A marketplace update with autoupdate on reports a moved plugin's skip under its header
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has run "/claude:plugin marketplace autoupdate fixtures --scope project"
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.1.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has a second skill whose name collides with its first
    When the user runs "/claude:plugin marketplace update fixtures --scope project"
    Then the command reports these results:
      | kind       | severity | needs reload | header                                                            | lines                                                                                                                                      |
      | cascade    | info     | true         |                                                                   |                                                                                                                                            |
      | diagnostic | warning  | false        | Plugin "demo" [project] updated; 1 declared component has a note. | skill source "skill" in "[redacted path]                                                                                                   |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | marketplace status | id            | name | status  | reasons | scope   | from  | to    |
      | fixtures         | project           | updated            | demo@fixtures | demo | updated |         | project | 1.0.0 | 1.1.0 |

  Scenario: A marketplace update with autoupdate on reports a moved plugin's skip and its dropped agent field under one header
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has run "/claude:plugin marketplace autoupdate fixtures --scope project"
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.1.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has a second skill whose name collides with its first
    Given the published plugin "demo" of the marketplace "fixtures" has an agent "helper" that sets a color
    When the user runs "/claude:plugin marketplace update fixtures --scope project"
    Then the command reports these results:
      | kind       | severity | needs reload | header                                                                               | lines                                                                                                                                                                      |
      | cascade    | info     | true         |                                                                                      |                                                                                                                                                                            |
      | diagnostic | warning  | false        | Plugin "demo" [project] updated; 1 declared component has a note; 1 staging warning. | skill source "skill" in "[redacted path], [helper] dropped fields: color                                                                                                   |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | marketplace status | id            | name | status  | reasons               | scope   | from  | to    |
      | fixtures         | project           | updated            | demo@fixtures | demo | updated | requires pi-subagents | project | 1.0.0 | 1.1.0 |

  @mcp
  Scenario: A marketplace update with autoupdate on reports a moved plugin that fails in its mcp phase under an update failed header
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has run "/claude:plugin marketplace autoupdate fixtures --scope project"
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.1.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has a second skill whose name collides with its first
    Given a directory blocks the mcp-adapter.json file of the project scope
    When the user runs "/claude:plugin marketplace update fixtures --scope project"
    Then the command reports these results:
      | kind       | severity | needs reload | summary                        | header                                                                  | lines                                                                                                                                      |
      | cascade    | error    | false        | A plugin operation has failed. |                                                                         |                                                                                                                                            |
      | diagnostic | warning  | false        |                                | Plugin "demo" [project] update failed; 1 declared component has a note. | skill source "skill" in "[redacted path]                                                                                                   |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | marketplace status | id            | name | status | reasons    | scope   | from  | version | leaks | rollback partial | cause chain                   | cause truncated |
      | fixtures         | project           | updated            | demo@fixtures | demo | failed | unreadable | project | 1.0.0 | 1.1.0   |       |                  | {mcp-adapter.json read error} | false           |

  Scenario: Apply that moves a plugin to its catalog version reports the moved plugin's skip under its header
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.1.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has a second skill whose name collides with its first
    When the user runs "/claude:plugin apply --scope project"
    Then the command reports these results:
      | kind                      | severity | needs reload | tally label | tally failures | tally warnings | tally success count | header                                                            | lines                                                                                                                                      |
      | reconcile-applied-cascade | info     | true         | Reconcile   | 0              | 0              | 1                   |                                                                   |                                                                                                                                            |
      | diagnostic                | warning  | false        |             |                |                |                     | Plugin "demo" [project] updated; 1 declared component has a note. | skill source "skill" in "[redacted path]                                                                                                   |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status  | reasons | scope   | from  | to    |
      | fixtures         | project           | demo@fixtures | demo | updated |         | project | 1.0.0 | 1.1.0 |

  Scenario: Apply that moves a plugin to its catalog version reports the moved plugin's skip and its dropped agent field under one header
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.1.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has a second skill whose name collides with its first
    Given the published plugin "demo" of the marketplace "fixtures" has an agent "helper" that sets a color
    When the user runs "/claude:plugin apply --scope project"
    Then the command reports these results:
      | kind                      | severity | needs reload | tally label | tally failures | tally warnings | tally success count | header                                                                               | lines                                                                                                                                                                      |
      | reconcile-applied-cascade | info     | true         | Reconcile   | 0              | 0              | 1                   |                                                                                      |                                                                                                                                                                            |
      | diagnostic                | warning  | false        |             |                |                |                     | Plugin "demo" [project] updated; 1 declared component has a note; 1 staging warning. | skill source "skill" in "[redacted path], [helper] dropped fields: color                                                                                                   |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status  | reasons                                         | scope   | from  | to    |
      | fixtures         | project           | demo@fixtures | demo | updated | components now supported, requires pi-subagents | project | 1.0.0 | 1.1.0 |

  Scenario: Apply that enables a plugin whose skills collide reports the skip under its header
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has run "/claude:plugin disable demo@fixtures --scope project"
    Given a config in scope project and layer base, with these plugins:
      | marketplace | plugin | enabled |
      | fixtures    | demo   | true    |
    Given the published plugin "demo" of the marketplace "fixtures" has a second skill whose name collides with its first
    When the user runs "/claude:plugin apply --scope project"
    Then the command reports these results:
      | kind                      | severity | needs reload | tally label | tally failures | tally warnings | tally success count | header                                                            | lines                                                                                                                                      |
      | reconcile-applied-cascade | info     | true         | Reconcile   | 0              | 0              | 1                   |                                                                   |                                                                                                                                            |
      | diagnostic                | warning  | false        |             |                |                |                     | Plugin "demo" [project] enabled; 1 declared component has a note. | skill source "skill" in "[redacted path]                                                                                                   |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | installed |         | project | 1.0.0   |

  Scenario: Installing a root that sorts after its dependency reports both notes in row order
    Given the marketplace "fixtures" offers these plugins with dependencies:
      | name  | version | dependencies |
      | zroot | 1.0.0   | aaa          |
      | aaa   | 1.0.0   |              |
    Given the published plugin "zroot" of the marketplace "fixtures" has a second skill whose name collides with its first
    Given the published plugin "aaa" of the marketplace "fixtures" has a second skill whose name collides with its first
    When the user runs "/claude:plugin install zroot@fixtures --scope project"
    Then the command reports these results:
      | kind       | severity | needs reload | header                                                               | lines                                                                                                                                   |
      | cascade    | info     | true         |                                                                      |                                                                                                                                         |
      | diagnostic | warning  | false        | Plugin "aaa" [project] installed; 1 declared component has a note.   | skill source "skill" in "[redacted path]                                                                                                |
      | diagnostic | warning  | false        | Plugin "zroot" [project] installed; 1 declared component has a note. | skill source "zroot-skill" in "[redacted path]                                                                                          |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id             | name         | status    | reasons | scope   | version |
      | fixtures         | project           | aaa@fixtures   | aaa@fixtures | installed |         | project | 1.0.0   |
      | fixtures         | project           | zroot@fixtures | zroot        | installed |         | project | 1.0.0   |

  Scenario: A bare update over two marketplaces reports the skips in the order of the rows
    Given the marketplace "addons" is published as a dir source
    Given the marketplace "addons" offers these plugins:
      | name | version |
      | tool | 1.0.0   |
    Given the marketplace "addons" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has run "/claude:plugin install tool@addons --scope project"
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.1.0   |
    Given the marketplace "addons" offers these plugins:
      | name | version |
      | tool | 1.1.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has a second skill whose name collides with its first
    Given the published plugin "tool" of the marketplace "addons" has a second skill whose name collides with its first
    When the user runs "/claude:plugin update --scope project"
    Then the command reports these results:
      | kind       | severity | needs reload | tally label   | tally failures | tally warnings | tally success count | tally success verb | header                                                            | lines                                                                                                                                      |
      | cascade    | info     | true         | Plugin update | 0              | 0              | 2                   | updated            |                                                                   |                                                                                                                                            |
      | diagnostic | warning  | false        |               |                |                |                     |                    | Plugin "tool" [project] updated; 1 declared component has a note. | skill source "tool-skill" in "[redacted path]                                                                                              |
      | diagnostic | warning  | false        |               |                |                |                     |                    | Plugin "demo" [project] updated; 1 declared component has a note. | skill source "skill" in "[redacted path]                                                                                                   |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status  | reasons | scope   | from  | to    |
      | addons           | project           | tool@addons   | tool | updated |         | project | 1.0.0 | 1.1.0 |
      | fixtures         | project           | demo@fixtures | demo | updated |         | project | 1.0.0 | 1.1.0 |
