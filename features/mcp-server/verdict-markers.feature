Feature: MCP server verdict markers

  A plugin row's MCP soft-dependency marker names the implementation that would
  run every server (D-MB-07), so a row's state and markers follow the active
  implementation (MREC-03, MREC-05, MREC-07). A row whose servers both
  implementations run reads the same under either, and a pair keeps one twin per
  profile where the rows or a diagnostic differ. Local marketplaces, a loopback
  https git host, and a loopback npm registry stand in for published ones.

  @mcp
  Scenario: A bare update preserves scope and insertion order with adjacent notices
    Given the marketplace "theta" is published as a dir source
    Given the marketplace "beta" is published as a dir source
    Given the marketplace "zeta" is published as a dir source
    Given the marketplace "alpha" is published as a dir source
    Given the marketplace "theta" offers these plugins:
      | name  | version |
      | tasks | 1.0.0   |
    Given the marketplace "zeta" offers these plugins:
      | name  | version |
      | notes | 1.0.0   |
    Given the marketplace "theta" is added to the user scope
    Given the marketplace "beta" is added to the user scope
    Given the marketplace "zeta" is added to the project scope
    Given the marketplace "alpha" is added to the project scope
    Given the user has run "/claude:plugin install notes@zeta --scope project"
    Given the user has run "/claude:plugin install tasks@theta --scope user"
    Given the user has run "/claude:plugin marketplace autoupdate zeta --scope project"
    Given the user has run "/claude:plugin marketplace autoupdate theta --scope user"
    Given the marketplace "theta" offers these plugins:
      | name  | version |
      | tasks | 1.10.0  |
    Given the marketplace "zeta" offers these plugins:
      | name  | version |
      | notes | 1.10.0  |
    Given the published plugin "tasks" of the marketplace "theta" declares the mcp server "tasks-server"
    Given the published plugin "notes" of the marketplace "zeta" declares the mcp server "notes-server"
    Given the mcp-adapter.json file of the user scope holds a comment
    Given the mcp-adapter.json file of the project scope holds a comment
    When the user runs "/claude:plugin marketplace update"
    Then the command reports these results:
      | kind               | severity | needs reload | tally label        | tally failures | tally warnings | tally success count | notices                                                                   |
      | cascade            | info     | true         | Marketplace update | 0              | 0              | 2                   |                                                                           |
      | mcp-config-notices | warning  | false        |                    |                |                |                     | [{"kind":"comments-dropped","scope":"project","file":"mcp-adapter.json"}] |
      | cascade            | info     | false        | Marketplace update | 0              | 0              | 1                   |                                                                           |
      | cascade            | info     | true         | Marketplace update | 0              | 0              | 2                   |                                                                           |
      | mcp-config-notices | warning  | false        |                    |                |                |                     | [{"kind":"comments-dropped","scope":"user","file":"mcp-adapter.json"}]    |
      | cascade            | info     | false        | Marketplace update | 0              | 0              | 1                   |                                                                           |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | marketplace status | marketplace reasons | id          | name  | status  | reasons | scope   | from  | to     |
      | zeta             | project           | updated            |                     | notes@zeta  | notes | updated |         | project | 1.0.0 | 1.10.0 |
      | alpha            | project           | skipped            | up-to-date          |             |       |         |         |         |       |        |
      | theta            | user              | updated            |                     | tasks@theta | tasks | updated |         | user    | 1.0.0 | 1.10.0 |
      | beta             | user              | skipped            | up-to-date          |             |       |         |         |         |       |        |

  @mcp
  Scenario: Repeating a bare update is up to date without repeated notices
    Given the marketplace "theta" is published as a dir source
    Given the marketplace "beta" is published as a dir source
    Given the marketplace "zeta" is published as a dir source
    Given the marketplace "alpha" is published as a dir source
    Given the marketplace "theta" offers these plugins:
      | name  | version |
      | tasks | 1.0.0   |
    Given the marketplace "zeta" offers these plugins:
      | name  | version |
      | notes | 1.0.0   |
    Given the marketplace "theta" is added to the user scope
    Given the marketplace "beta" is added to the user scope
    Given the marketplace "zeta" is added to the project scope
    Given the marketplace "alpha" is added to the project scope
    Given the user has run "/claude:plugin install notes@zeta --scope project"
    Given the user has run "/claude:plugin install tasks@theta --scope user"
    Given the user has run "/claude:plugin marketplace autoupdate zeta --scope project"
    Given the user has run "/claude:plugin marketplace autoupdate theta --scope user"
    Given the marketplace "theta" offers these plugins:
      | name  | version |
      | tasks | 1.10.0  |
    Given the marketplace "zeta" offers these plugins:
      | name  | version |
      | notes | 1.10.0  |
    Given the published plugin "tasks" of the marketplace "theta" declares the mcp server "tasks-server"
    Given the published plugin "notes" of the marketplace "zeta" declares the mcp server "notes-server"
    Given the mcp-adapter.json file of the user scope holds a comment
    Given the mcp-adapter.json file of the project scope holds a comment
    Given the user has updated every marketplace
    When the user runs "/claude:plugin marketplace update"
    Then the command reports these results:
      | kind    | severity | needs reload | tally label        | tally failures | tally warnings | tally success count |
      | cascade | info     | false        | Marketplace update | 0              | 0              | 1                   |
      | cascade | info     | false        | Marketplace update | 0              | 0              | 1                   |
      | cascade | info     | false        | Marketplace update | 0              | 0              | 1                   |
      | cascade | info     | false        | Marketplace update | 0              | 0              | 1                   |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | marketplace status | marketplace reasons |
      | zeta             | project           | skipped            | up-to-date          |
      | alpha            | project           | skipped            | up-to-date          |
      | theta            | user              | skipped            | up-to-date          |
      | beta             | user              | skipped            | up-to-date          |
    When the user runs "/claude:plugin list"
    Then the result has these fields:
      | kind                | cascade     |
      | severity            | info        |
      | needs reload        | false       |
      | tally label         | Plugin list |
      | tally failures      | 0           |
      | tally warnings      | 0           |
      | tally success count | 2           |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace details autoupdate | id          | name  | status    | reasons | scope   | version |
      | alpha            | project           |                                |             |       |           |         |         |         |
      | beta             | user              |                                |             |       |           |         |         |         |
      | theta            | user              | true                           | tasks@theta | tasks | installed |         | user    | 1.10.0  |
      | zeta             | project           | true                           | notes@zeta  | notes | installed |         | project | 1.10.0  |

  @mcp
  Scenario: Apply preserves dependency move warnings and MCP notices
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name  | version |
      | demo  | 1.0.0   |
      | alpha | 1.0.0   |
      | beta  | 1.0.0   |
      | gamma | 1.0.0   |
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib          |
      | lib  | 1.0.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install app@tools --scope project"
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib          |
      | lib  | 2.0.0   |              |
    Given the published plugin "lib" of the marketplace "tools" has a second skill whose name collides with its first
    Given the published plugin "lib" of the marketplace "tools" declares the mcp server "lib-server"
    Given the mcp-adapter.json file of the project scope holds a comment
    When the user runs "/claude:plugin apply --scope project"
    Then the command reports these results:
      | kind                      | severity | needs reload | tally label | tally failures | tally warnings | tally success count | header                                                           | lines                                    | notices                                                                   |
      | reconcile-applied-cascade | info     | true         | Reconcile   | 0              | 0              | 1                   |                                                                  |                                          |                                                                           |
      | diagnostic                | warning  | false        |             |                |                |                     | Plugin "lib" [project] updated; 1 declared component has a note. | skill source "skill" in "[redacted path] |                                                                           |
      | mcp-config-notices        | warning  | false        |             |                |                |                     |                                                                  |                                          | [{"kind":"comments-dropped","scope":"project","file":"mcp-adapter.json"}] |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id        | name | status  | reasons | scope   | from  | to    |
      | tools            | project           | lib@tools | lib  | updated |         | project | 1.0.0 | 2.0.0 |

  @mcp
  Scenario: Updating a plugin whose new version needs a dependency with an MCP server reports that dependency's MCP config notice
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the marketplace "fixtures" offers these plugins with dependencies:
      | name | version | dependencies |
      | demo | 1.1.0   | lib          |
      | lib  | 1.0.0   |              |
    Given the published plugin "lib" of the marketplace "fixtures" declares the mcp server "lib-server"
    Given the mcp-adapter.json file of the project scope holds a comment
    When the user runs "/claude:plugin update demo@fixtures --scope project"
    Then the command reports these results:
      | kind               | severity | needs reload | notices                                                                   |
      | cascade            | info     | true         |                                                                           |
      | mcp-config-notices | warning  | false        | [{"kind":"comments-dropped","scope":"project","file":"mcp-adapter.json"}] |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name         | status    | reasons | scope   | version | from  | to    |
      | fixtures         | project           | demo@fixtures | demo         | updated   |         | project |         | 1.0.0 | 1.1.0 |
      | fixtures         | project           | lib@fixtures  | lib@fixtures | installed |         | project | 1.0.0   |       |       |

  @mcp
  Scenario: Updating a plugin whose dependency settle is refused still reports the MCP config notice of the dependency it installed first
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" is added to the project scope
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
      | zbad | 1.0.0   |
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has run "/claude:plugin install zbad@fixtures --scope project"
    Given the marketplace "fixtures" offers these plugins with dependencies:
      | name | version | dependencies |
      | demo | 1.1.0   | zbad@^2.0.0  |
      | zbad | 2.0.0   | lib          |
      | lib  | 1.0.0   |              |
    Given the published plugin "lib" of the marketplace "fixtures" declares the mcp server "lib-server"
    Given the published plugin "zbad" of the marketplace "fixtures" has an unreadable skill file
    Given the mcp-adapter.json file of the project scope holds a comment
    When the user runs "/claude:plugin update demo@fixtures --scope project"
    Then the command reports these results:
      | kind               | severity | needs reload | summary                             | notices                                                                   |
      | cascade            | error    | true         | Some plugin operations have failed. |                                                                           |
      | mcp-config-notices | warning  | false        |                                     | [{"kind":"comments-dropped","scope":"project","file":"mcp-adapter.json"}] |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name          | status    | reasons           | scope   | version | cause chain                        | cause truncated | leaks | rollback partial |
      | fixtures         | project           | demo@fixtures | demo          | failed    | dependency failed | project | 1.0.0   |                                    |                 |       |                  |
      | fixtures         | project           | lib@fixtures  | lib@fixtures  | installed |                   | project | 1.0.0   |                                    |                 |       |                  |
      | fixtures         | project           | zbad@fixtures | zbad@fixtures | failed    |                   | project | 1.0.0   | {unreadable skill file copy error} | false           |       |                  |

  @mcp
  Scenario: Installing a plugin reports the MCP notice from a moved dependency's new dependency
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the marketplace "fixtures" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | demo@^2.0.0  |
      | demo | 2.0.0   | lib          |
      | lib  | 1.0.0   |              |
    Given the published plugin "lib" of the marketplace "fixtures" declares the mcp server "lib-server"
    Given the mcp-adapter.json file of the project scope holds a comment
    When the user runs "/claude:plugin install app@fixtures --scope project"
    Then the command reports these results:
      | kind               | severity | needs reload | notices                                                                   |
      | cascade            | info     | true         |                                                                           |
      | mcp-config-notices | warning  | false        | [{"kind":"comments-dropped","scope":"project","file":"mcp-adapter.json"}] |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name          | status    | reasons                 | scope   | version | from  | to    | cause chain                                                              | cause truncated | leaks | rollback partial |
      | fixtures         | project           | app@fixtures  | app           | installed |                         | project | 1.0.0   |       |       |                                                                          |                 |       |                  |
      | fixtures         | project           | demo@fixtures | demo@fixtures | updated   | dependency current copy | project |         | 1.0.0 | 2.0.0 | constrained to the combined range (^2.0.0) -- required by "app@fixtures" | false           |       |                  |
      | fixtures         | project           | lib@fixtures  | lib@fixtures  | installed |                         | project | 1.0.0   |       |       |                                                                          |                 |       |                  |

  @mcp
  Scenario: Installing a plugin reports an earlier MCP notice when its final config becomes invalid
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" is added to the project scope
    Given the npm registry serves these packages:
      | name    | version |
      | pkd-dep | 1.0.0   |
    Given the marketplace "tools" is published as a url source
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | aaa  | 1.0.0   |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install aaa@tools --scope project"
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | aaa@^2.0.0   |
      | aaa  | 2.0.0   | zzz          |
      | zzz  | 1.0.0   |              |
    Given the published plugin "zzz" of the marketplace "tools" declares the mcp server "zzz-server"
    Given the published plugin "aaa" of the marketplace "tools" depends on these npm packages:
      | name    | version |
      | pkd-dep | 1.0.0   |
    Given the user has run "/claude:plugin marketplace update tools --scope project"
    Given the mcp-adapter.json file of the project scope holds a comment
    Given the local config of the project scope changes to this text while the npm registry serves "pkd-dep":
      """
      {invalid
      """
    When the user runs "/claude:plugin install app@tools --scope project"
    Then the command reports these results:
      | kind               | severity | needs reload | summary                        | notices                                                                   |
      | cascade            | error    | true         | A plugin operation has failed. |                                                                           |
      | mcp-config-notices | warning  | false        |                                | [{"kind":"comments-dropped","scope":"project","file":"mcp-adapter.json"}] |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id        | name      | status    | reasons                 | scope   | version | from  | to    | cause chain                                                           | cause truncated | leaks | rollback partial |
      | tools            | project           | app@tools | app       | failed    | invalid manifest        | project |         |       |       | Config file "claude-plugins.local.json" failed schema validation.     | false           |       |                  |
      | tools            | project           | zzz@tools | zzz@tools | installed |                         | project | 1.0.0   |       |       |                                                                       |                 |       |                  |
      | tools            | project           | aaa@tools | aaa@tools | updated   | dependency current copy | project |         | 1.0.0 | 2.0.0 | constrained to the combined range (^2.0.0) -- required by "app@tools" | false           |       |                  |
    Then the "claude-plugins.local.json" file of the project scope holds this text:
      """
      {invalid
      """
    Then the npm registry receives these requests:
      | method | path                         | status |
      | GET    | /pkd-dep/-/pkd-dep-1.0.0.tgz | 200    |

  @mcp
  Scenario: Installing a plugin reports an earlier dependency's MCP notice when a later move fails
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the marketplace "fixtures" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | demo@^2.0.0  |
      | demo | 2.0.0   | lib          |
      | lib  | 1.0.0   |              |
    Given the published plugin "lib" of the marketplace "fixtures" declares the mcp server "lib-server"
    Given the published plugin "demo" of the marketplace "fixtures" has an unreadable skill file
    Given the mcp-adapter.json file of the project scope holds a comment
    When the user runs "/claude:plugin install app@fixtures --scope project"
    Then the command reports these results:
      | kind               | severity | needs reload | summary                             | notices                                                                   |
      | cascade            | error    | true         | Some plugin operations have failed. |                                                                           |
      | mcp-config-notices | warning  | false        |                                     | [{"kind":"comments-dropped","scope":"project","file":"mcp-adapter.json"}] |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name          | status    | reasons           | scope   | version | cause chain                        | cause truncated | leaks | rollback partial |
      | fixtures         | project           | app@fixtures  | app           | failed    | dependency failed | project |         |                                    |                 |       |                  |
      | fixtures         | project           | lib@fixtures  | lib@fixtures  | installed |                   | project | 1.0.0   |                                    |                 |       |                  |
      | fixtures         | project           | demo@fixtures | demo@fixtures | failed    |                   | project | 1.0.0   | {unreadable skill file copy error} | false           |       |                  |

  @builtin-only
  Scenario: Update preserves dependency move warnings and MCP notices, under Pi's built-in MCP
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib          |
      | lib  | 1.0.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install app@tools --scope project"
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.1.0   | lib@^2.0.0   |
      | lib  | 2.0.0   |              |
    Given the published plugin "lib" of the marketplace "tools" has a second skill whose name collides with its first
    Given the published plugin "lib" of the marketplace "tools" has an agent "helper" that sets a color
    Given the published plugin "lib" of the marketplace "tools" declares the mcp server "lib-server"
    Given the mcp-adapter.json file of the project scope holds a comment
    When the user runs "/claude:plugin update app@tools --scope project"
    Then the command reports these results:
      | kind               | severity | needs reload | summary                             | header                                                                               | lines                                                                                                                                                                                                                                                                                                                                           | notices                                                                   |
      | cascade            | warning  | true         | A plugin operation needs attention. |                                                                                      |                                                                                                                                                                                                                                                                                                                                                 |                                                                           |
      | diagnostic         | warning  | false        |                                     | Plugin "lib" [project] updated; 1 declared component has a note; 2 staging warnings. | skill source "skill" in "[redacted path], [helper] tools include MCP tools, which pi-subagents serves only to background children -- the agent runs in the background (`async: true`), where Claude Code runs it in the foreground; a launch before Pi's built-in MCP has listed the server's tools still fails, [helper] dropped fields: color |                                                                           |
      | mcp-config-notices | warning  | false        |                                     |                                                                                      |                                                                                                                                                                                                                                                                                                                                                 | [{"kind":"comments-dropped","scope":"project","file":"mcp-adapter.json"}] |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id        | name      | status  | reasons                                        | scope   | from  | to    | cause chain                                                           | cause truncated | leaks | rollback partial |
      | tools            | project           | app@tools | app       | updated |                                                | project | 1.0.0 | 1.1.0 |                                                                       |                 |       |                  |
      | tools            | project           | lib@tools | lib@tools | updated | dependency current copy, requires pi-subagents | project | 1.0.0 | 2.0.0 | constrained to the combined range (^2.0.0) -- required by "app@tools" | false           |       |                  |

  @adapter-only
  Scenario: Update preserves dependency move warnings and MCP notices, under pi-mcp-adapter
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib          |
      | lib  | 1.0.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install app@tools --scope project"
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.1.0   | lib@^2.0.0   |
      | lib  | 2.0.0   |              |
    Given the published plugin "lib" of the marketplace "tools" has a second skill whose name collides with its first
    Given the published plugin "lib" of the marketplace "tools" has an agent "helper" that sets a color
    Given the published plugin "lib" of the marketplace "tools" declares the mcp server "lib-server"
    Given the mcp-adapter.json file of the project scope holds a comment
    When the user runs "/claude:plugin update app@tools --scope project"
    Then the command reports these results:
      | kind               | severity | needs reload | summary                             | header                                                                               | lines                                                                                                                                                                                                                                                                                                                                        | notices                                                                   |
      | cascade            | warning  | true         | A plugin operation needs attention. |                                                                                      |                                                                                                                                                                                                                                                                                                                                              |                                                                           |
      | diagnostic         | warning  | false        |                                     | Plugin "lib" [project] updated; 1 declared component has a note; 2 staging warnings. | skill source "skill" in "[redacted path], [helper] tools include MCP tools, which pi-subagents serves only to background children -- the agent runs in the background (`async: true`), where Claude Code runs it in the foreground; a launch before pi-mcp-adapter has cached the server's tools still fails, [helper] dropped fields: color |                                                                           |
      | mcp-config-notices | warning  | false        |                                     |                                                                                      |                                                                                                                                                                                                                                                                                                                                              | [{"kind":"comments-dropped","scope":"project","file":"mcp-adapter.json"}] |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id        | name      | status  | reasons                                        | scope   | from  | to    | cause chain                                                           | cause truncated | leaks | rollback partial |
      | tools            | project           | app@tools | app       | updated |                                                | project | 1.0.0 | 1.1.0 |                                                                       |                 |       |                  |
      | tools            | project           | lib@tools | lib@tools | updated | dependency current copy, requires pi-subagents | project | 1.0.0 | 2.0.0 | constrained to the combined range (^2.0.0) -- required by "app@tools" | false           |       |                  |

  @adapter-only
  Scenario: A plugin whose server needs an elicitation handler lists as partially installed and names Pi's built-in MCP, under pi-mcp-adapter (D-MB-07)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with this text:
      """
      {"mcpServers": {"asker": {"command": "node", "bareElicitationCapability": true}}}
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project --partial", which did not fail
    When the user runs "/claude:plugin list"
    Then the result has these fields:
      | kind                | cascade     |
      | severity            | info        |
      | needs reload        | false       |
      | tally label         | Plugin list |
      | tally failures      | 0           |
      | tally warnings      | 0           |
      | tally success count | 1           |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status              | reasons                               | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | partially-installed | unsupported mcp, requires builtin mcp | project | 1.0.0   |

  @builtin-only
  Scenario: A plugin whose server needs an elicitation handler lists as installed, under Pi's built-in MCP (D-MB-07)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with this text:
      """
      {"mcpServers": {"asker": {"command": "node", "bareElicitationCapability": true}}}
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project --partial", which did not fail
    When the user runs "/claude:plugin list"
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

  @mcp
  Scenario: A plugin whose ws server neither implementation runs lists as partially installed with no requires marker (MREC-07)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with this text:
      """
      {"mcpServers": {"live": {"type": "ws", "url": "ws://127.0.0.1:9/"}}}
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project --partial", which did not fail
    When the user runs "/claude:plugin list"
    Then the result has these fields:
      | kind                | cascade     |
      | severity            | info        |
      | needs reload        | false       |
      | tally label         | Plugin list |
      | tally failures      | 0           |
      | tally warnings      | 0           |
      | tally success count | 1           |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status              | reasons         | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | partially-installed | unsupported mcp | project | 1.0.0   |
