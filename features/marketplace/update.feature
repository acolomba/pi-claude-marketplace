Feature: Marketplace update

  Updating a marketplace refreshes its manifest from its source.
  The scenarios run the real extension in a headless Pi and use local marketplaces
  and a loopback https git host in place of published ones.

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
      | marketplace name | marketplace scope | marketplace status | marketplace reasons | id          | name  | status  | reasons                 | scope   | from  | to     |
      | zeta             | project           | updated            |                     | notes@zeta  | notes | updated | requires pi-mcp-adapter | project | 1.0.0 | 1.10.0 |
      | alpha            | project           | skipped            | up-to-date          |             |       |         |                         |         |       |        |
      | theta            | user              | updated            |                     | tasks@theta | tasks | updated | requires pi-mcp-adapter | user    | 1.0.0 | 1.10.0 |
      | beta             | user              | skipped            | up-to-date          |             |       |         |                         |         |       |        |

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
      | marketplace name | marketplace scope | marketplace details autoupdate | id          | name  | status    | reasons                 | scope   | version |
      | alpha            | project           |                                |             |       |           |                         |         |         |
      | beta             | user              |                                |             |       |           |                         |         |         |
      | theta            | user              | true                           | tasks@theta | tasks | installed | requires pi-mcp-adapter | user    | 1.10.0  |
      | zeta             | project           | true                           | notes@zeta  | notes | installed | requires pi-mcp-adapter | project | 1.10.0  |

  Scenario Outline: A bare update continues after a marketplace fails
    Given the marketplace "zeta" is published as a <source kind> source
    Given the marketplace "alpha" is published as a dir source
    Given the marketplace "beta" is published as a dir source
    Given the marketplace "zeta" is added to the project scope
    Given the marketplace "alpha" is added to the project scope
    Given the marketplace "beta" is added to the user scope
    Given the manifest of the marketplace "zeta" to update breaks the manifest schema
    When the user runs "/claude:plugin marketplace update"
    Then the command reports these results:
      | kind    | severity | needs reload | summary                      | tally label        | tally failures | tally warnings | tally success count |
      | cascade | error    | false        | Some operations have failed. | Marketplace update | 2              | 0              |                     |
      | cascade | info     | false        |                              | Marketplace update | 0              | 0              | 1                   |
      | cascade | info     | false        |                              | Marketplace update | 0              | 0              | 1                   |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | marketplace status | marketplace reasons | id   | name | status | reasons          | scope   | leaks | rollback partial | cause chain   | cause truncated |
      | zeta             | project           | failed             |                     | zeta | zeta | failed | invalid manifest | project |       |                  | <cause chain> | false           |
      | alpha            | project           | skipped            | up-to-date          |      |      |        |                  |         |       |                  |               |                 |
      | beta             | user              | skipped            | up-to-date          |      |      |        |                  |         |       |                  |               |                 |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name  | source                    |
      | zeta  | <source>                  |
      | alpha | {home}/marketplaces/alpha |

    Examples:
      | source kind | source                                                   | cause chain                                                                                    |
      | dir         | {home}/marketplaces/zeta                                 | Failed to update marketplace "zeta"., marketplace.json schema invalid: /plugins: must be array |
      | file        | {home}/marketplaces/zeta/.claude-plugin/marketplace.json | Failed to update marketplace "zeta"., marketplace.json schema invalid: /plugins: must be array |

    @url
    Examples:
      | source kind | source                           | cause chain                                                                                                                      |
      | url         | https://{git host}/acme/zeta.git | Marketplace "zeta" clone advanced but manifest could not be persisted., marketplace.json schema invalid: /plugins: must be array |

    @github
    Examples:
      | source kind | source    | cause chain                                                                                                                      |
      | github      | acme/zeta | Marketplace "zeta" clone advanced but manifest could not be persisted., marketplace.json schema invalid: /plugins: must be array |

  Scenario Outline: A bare update refreshes the only populated scope
    Given the marketplace "tools" is published as a <source kind> source
    Given the marketplace "tools" is added to the <scope> scope
    Given the marketplace "tools" update source contains this manifest:
      """
      {"name":"tools","owner":{"name":"features"},"plugins":[],"description":"Updated tools"}
      """
    When the user runs "/claude:plugin marketplace update"
    Then the result has these fields:
      | kind                | cascade            |
      | severity            | info               |
      | needs reload        | false              |
      | tally label         | Marketplace update |
      | tally failures      | 0                  |
      | tally warnings      | 0                  |
      | tally success count | 1                  |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | marketplace status |
      | tools            | <scope>           | updated            |

    Examples:
      | source kind | scope   |
      | dir         | project |
      | file        | user    |

    @url
    Examples:
      | source kind | scope   |
      | url         | project |

    @github
    Examples:
      | source kind | scope |
      | github      | user  |

  Scenario: A bare update with no marketplaces reports an empty result
    When the user runs "/claude:plugin marketplace update"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists no marketplaces
    Then the "claude-plugins.json" file of the project scope does not exist
    Then the "claude-plugins.json" file of the user scope does not exist

  Scenario: Repeating an empty bare update leaves it empty
    Given the user has run "/claude:plugin marketplace update"
    When the user runs "/claude:plugin marketplace update"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists no marketplaces
    Then the "claude-plugins.json" file of the project scope does not exist
    Then the "claude-plugins.json" file of the user scope does not exist
    When the user runs "/claude:plugin marketplace list"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists no marketplaces

  Scenario Outline: An update reports the marketplace missing from the requested scope
    Given the marketplace "<added marketplace>" is published as a dir source
    Given the marketplace "<added marketplace>" is added to the <added scope> scope
    When the user runs "/claude:plugin marketplace update tools --scope <requested scope>"
    Then the result has these fields:
      | kind         | marketplace-not-added               |
      | severity     | error                               |
      | needs reload | false                               |
      | summary      | A marketplace operation has failed. |
      | name         | tools                               |
      | scope        | <requested scope>                   |
      | reasons      | <reasons>                           |

    Examples:
      | added marketplace | added scope | requested scope | reasons                                |
      | other             | project     | project         | marketplace not added                  |
      | other             | user        | user            | marketplace not added                  |
      | tools             | user        | project         | marketplace not added to project scope |
      | tools             | project     | user            | marketplace not added to user scope    |

  Scenario: An update without a scope reports a marketplace missing from both scopes
    Given the marketplace "other" is published as a dir source
    Given the marketplace "other" is added to the project scope
    When the user runs "/claude:plugin marketplace update tools"
    Then the result has these fields:
      | kind         | marketplace-not-added               |
      | severity     | error                               |
      | needs reload | false                               |
      | summary      | A marketplace operation has failed. |
      | name         | tools                               |
      | reasons      | marketplace not added               |

  Scenario: A missing marketplace name preserves its Unicode spelling
    When the user runs "/claude:plugin marketplace update 工具"
    Then the result has these fields:
      | kind         | marketplace-not-added               |
      | severity     | error                               |
      | needs reload | false                               |
      | summary      | A marketplace operation has failed. |
      | name         | 工具                                |
      | reasons      | marketplace not added               |

  Scenario Outline: An unchanged marketplace is up to date
    Given the marketplace "tools" is published as a <source kind> source
    Given the marketplace "tools" is added to the project scope
    When the user runs "/claude:plugin marketplace update"
    Then the result has these fields:
      | kind                | cascade            |
      | severity            | info               |
      | needs reload        | false              |
      | tally label         | Marketplace update |
      | tally failures      | 0                  |
      | tally warnings      | 0                  |
      | tally success count | 1                  |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | marketplace status | marketplace reasons |
      | tools            | project           | skipped            | up-to-date          |

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

  Scenario Outline: A changed marketplace refreshes without plugin rows
    Given the marketplace "tools" is published as a <source kind> source
    Given the marketplace "tools" is added to the project scope
    Given the marketplace "tools" update source contains this manifest:
      """
      {"name":"tools","owner":{"name":"features"},"plugins":[],"description":"Updated tools"}
      """
    When the user runs "/claude:plugin marketplace update"
    Then the result has these fields:
      | kind                | cascade            |
      | severity            | info               |
      | needs reload        | false              |
      | tally label         | Marketplace update |
      | tally failures      | 0                  |
      | tally warnings      | 0                  |
      | tally success count | 1                  |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | marketplace status |
      | tools            | project           | updated            |

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

  Scenario Outline: Whitespace and object key order do not change a marketplace
    Given the marketplace "tools" is published as a <source kind> source
    Given the marketplace "tools" publishes this manifest:
      """
      <published manifest>
      """
    Given the marketplace "tools" is added to the project scope
    Given the marketplace "tools" update source contains this manifest:
      """
      <refreshed manifest>
      """
    When the user runs "/claude:plugin marketplace update"
    Then the result has these fields:
      | kind                | cascade            |
      | severity            | info               |
      | needs reload        | false              |
      | tally label         | Marketplace update |
      | tally failures      | 0                  |
      | tally warnings      | 0                  |
      | tally success count | 1                  |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | marketplace status | marketplace reasons |
      | tools            | project           | skipped            | up-to-date          |

    Examples:
      | source kind | published manifest                                                                        | refreshed manifest                                                                              |
      | dir         | {"name":"tools","owner":{"name":"features"},"plugins":[]}                                 | {\n  "name": "tools",\n  "owner": { "name": "features" },\n  "plugins": []\n}\n                 |
      | dir         | {"name":"tools","owner":{"name":"features"},"plugins":[]}                                 | { "plugins": [], "owner": {"name":"features"}, "name":"tools" }\n                               |
      | dir         | {"name":"tools","owner":{"name":"features","email":"features@example.test"},"plugins":[]} | { "name":"tools", "owner":{"email":"features@example.test","name":"features"}, "plugins":[] }\n |
      | file        | {"name":"tools","owner":{"name":"features"},"plugins":[]}                                 | {\n  "name": "tools",\n  "owner": { "name": "features" },\n  "plugins": []\n}\n                 |
      | file        | {"name":"tools","owner":{"name":"features"},"plugins":[]}                                 | { "plugins": [], "owner": {"name":"features"}, "name":"tools" }\n                               |
      | file        | {"name":"tools","owner":{"name":"features","email":"features@example.test"},"plugins":[]} | { "name":"tools", "owner":{"email":"features@example.test","name":"features"}, "plugins":[] }\n |

    @url
    Examples:
      | source kind | published manifest                                        | refreshed manifest                                                              |
      | url         | {"name":"tools","owner":{"name":"features"},"plugins":[]} | {\n  "name": "tools",\n  "owner": { "name": "features" },\n  "plugins": []\n}\n |

    @github
    Examples:
      | source kind | published manifest                                        | refreshed manifest                                                              |
      | github      | {"name":"tools","owner":{"name":"features"},"plugins":[]} | {\n  "name": "tools",\n  "owner": { "name": "features" },\n  "plugins": []\n}\n |

  Scenario Outline: An unknown manifest field changes the marketplace
    Given the marketplace "tools" is published as a <source kind> source
    Given the marketplace "tools" publishes this manifest:
      """
      <published manifest>
      """
    Given the marketplace "tools" is added to the project scope
    Given the marketplace "tools" update source contains this manifest:
      """
      <refreshed manifest>
      """
    When the user runs "/claude:plugin marketplace update"
    Then the result has these fields:
      | kind                | cascade            |
      | severity            | info               |
      | needs reload        | false              |
      | tally label         | Marketplace update |
      | tally failures      | 0                  |
      | tally warnings      | 0                  |
      | tally success count | 1                  |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | marketplace status |
      | tools            | project           | updated            |

    Examples:
      | source kind | published manifest                                                                                                 | refreshed manifest                                                                               |
      | dir         | {"name":"tools","owner":{"name":"features"},"plugins":[]}                                                          | { "name":"tools", "owner":{"name":"features"}, "plugins":[], "vendor":{"revision":1} }\n         |
      | dir         | {"name":"tools","owner":{"name":"features"},"plugins":[],"vendor":{"revision":1}}                                  | { "name":"tools", "owner":{"name":"features"}, "plugins":[], "vendor":{"revision":2} }\n         |
      | dir         | {"name":"tools","owner":{"name":"features"},"plugins":[{"name":"demo","source":"./demo","vendor":{"revision":1}}]} | { "name":"tools", "owner":{"name":"features"}, "plugins":[{"name":"demo","source":"./demo"}] }\n |
      | file        | {"name":"tools","owner":{"name":"features"},"plugins":[]}                                                          | { "name":"tools", "owner":{"name":"features"}, "plugins":[], "vendor":{"revision":1} }\n         |
      | file        | {"name":"tools","owner":{"name":"features"},"plugins":[],"vendor":{"revision":1}}                                  | { "name":"tools", "owner":{"name":"features"}, "plugins":[], "vendor":{"revision":2} }\n         |
      | file        | {"name":"tools","owner":{"name":"features"},"plugins":[{"name":"demo","source":"./demo","vendor":{"revision":1}}]} | { "name":"tools", "owner":{"name":"features"}, "plugins":[{"name":"demo","source":"./demo"}] }\n |

    @url
    Examples:
      | source kind | published manifest                                        | refreshed manifest                                                                       |
      | url         | {"name":"tools","owner":{"name":"features"},"plugins":[]} | { "name":"tools", "owner":{"name":"features"}, "plugins":[], "vendor":{"revision":1} }\n |

    @github
    Examples:
      | source kind | published manifest                                        | refreshed manifest                                                                       |
      | github      | {"name":"tools","owner":{"name":"features"},"plugins":[]} | { "name":"tools", "owner":{"name":"features"}, "plugins":[], "vendor":{"revision":1} }\n |

  Scenario Outline: Reordering a manifest array changes the marketplace
    Given the marketplace "tools" is published as a <source kind> source
    Given the marketplace "tools" publishes this manifest:
      """
      <published manifest>
      """
    Given the marketplace "tools" is added to the project scope
    Given the marketplace "tools" update source contains this manifest:
      """
      <refreshed manifest>
      """
    When the user runs "/claude:plugin marketplace update"
    Then the result has these fields:
      | kind                | cascade            |
      | severity            | info               |
      | needs reload        | false              |
      | tally label         | Marketplace update |
      | tally failures      | 0                  |
      | tally warnings      | 0                  |
      | tally success count | 1                  |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | marketplace status |
      | tools            | project           | updated            |

    Examples:
      | source kind | published manifest                                                                                   | refreshed manifest                                                                                           |
      | dir         | {"name":"tools","plugins":[{"name":"zebra","source":"./zebra"},{"name":"alpha","source":"./alpha"}]} | { "name":"tools", "plugins":[ {"name":"alpha","source":"./alpha"}, {"name":"zebra","source":"./zebra"} ] }\n |
      | dir         | {"name":"tools","plugins":[],"allowCrossMarketplaceDependenciesOn":["zebra","alpha"]}                | { "name":"tools", "plugins":[], "allowCrossMarketplaceDependenciesOn":["alpha", "zebra"] }\n                 |
      | dir         | {"name":"tools","plugins":[],"vendor":{"sequence":["zebra","alpha"]}}                                | { "name":"tools", "plugins":[], "vendor":{"sequence":["alpha", "zebra"]} }\n                                 |
      | file        | {"name":"tools","plugins":[{"name":"zebra","source":"./zebra"},{"name":"alpha","source":"./alpha"}]} | { "name":"tools", "plugins":[ {"name":"alpha","source":"./alpha"}, {"name":"zebra","source":"./zebra"} ] }\n |
      | file        | {"name":"tools","plugins":[],"allowCrossMarketplaceDependenciesOn":["zebra","alpha"]}                | { "name":"tools", "plugins":[], "allowCrossMarketplaceDependenciesOn":["alpha", "zebra"] }\n                 |
      | file        | {"name":"tools","plugins":[],"vendor":{"sequence":["zebra","alpha"]}}                                | { "name":"tools", "plugins":[], "vendor":{"sequence":["alpha", "zebra"]} }\n                                 |

    @url
    Examples:
      | source kind | published manifest                                                                                   | refreshed manifest                                                                                           |
      | url         | {"name":"tools","plugins":[{"name":"zebra","source":"./zebra"},{"name":"alpha","source":"./alpha"}]} | { "name":"tools", "plugins":[ {"name":"alpha","source":"./alpha"}, {"name":"zebra","source":"./zebra"} ] }\n |

    @github
    Examples:
      | source kind | published manifest                                                                                   | refreshed manifest                                                                                           |
      | github      | {"name":"tools","plugins":[{"name":"zebra","source":"./zebra"},{"name":"alpha","source":"./alpha"}]} | { "name":"tools", "plugins":[ {"name":"alpha","source":"./alpha"}, {"name":"zebra","source":"./zebra"} ] }\n |

  Scenario Outline: An isolated dependency entry retains its comparison fields
    Given the marketplace "tools" is published as a <source kind> source
    Given the marketplace "tools" publishes this manifest:
      """
      {"name":"tools","plugins":[{"name":"broken","source":"./broken","dependencies":["library@~1.0.0"],"vendor":{"revision":1}}]}
      """
    Given the marketplace "tools" is added to the project scope
    Given the marketplace "tools" update source contains this manifest:
      """
      { "name":"tools", "plugins":[{"name":"broken","source":"./broken","dependencies":["library@~1.0.0"],"vendor":{"revision":2}}] }
      """
    When the user runs "/claude:plugin marketplace update"
    Then the result has these fields:
      | kind                | cascade            |
      | severity            | info               |
      | needs reload        | false              |
      | tally label         | Marketplace update |
      | tally failures      | 0                  |
      | tally warnings      | 0                  |
      | tally success count | 1                  |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | marketplace status |
      | tools            | project           | updated            |

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

  Scenario Outline: Autoupdate off preserves installed versions
    Given the marketplace "tools" is published as a <source kind> source
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install demo@tools --scope project"
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | demo | 1.10.0  |
    Given the marketplace "tools" has the description "A longer refreshed catalog description"
    When the user runs "/claude:plugin marketplace update tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | marketplace status |
      | tools            | project           | updated            |
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
      | marketplace name | marketplace scope | id         | name | status     | reasons | scope   | version |
      | tools            | project           | demo@tools | demo | upgradable |         | project | 1.0.0   |
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
    When the user starts a new pi session
    Then the session reports these results:
      | kind    | severity | needs reload | needs apply | tally label       | tally failures | tally warnings | tally success count |
      | cascade | info     | false        | true        | Reconcile pending | 0              | 0              | 1                   |
      | cascade | info     | false        | true        | Reconcile pending | 0              | 0              | 1                   |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id         | name | status      | reasons | scope   | from  | to     |
      | tools            | project           | demo@tools | demo | will update |         | project | 1.0.0 | 1.10.0 |
      | tools            | project           | demo@tools | demo | will update |         | project | 1.0.0 | 1.10.0 |
    Then the session offers these skills:
      | command           | description            |
      | /skill:demo-skill | A skill of demo 1.0.0. |

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

  Scenario Outline: Autoupdate exposes the offered version in a new session
    Given the marketplace "tools" is published as a <source kind> source
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install demo@tools --scope project"
    Given the user has run "/claude:plugin marketplace autoupdate tools --scope project"
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | demo | 1.10.0  |
    Given the marketplace "tools" has the description "A longer refreshed catalog description"
    When the user runs "/claude:plugin marketplace update tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | marketplace status | id         | name | status  | reasons | scope   | from  | to     |
      | tools            | project           | updated            | demo@tools | demo | updated |         | project | 1.0.0 | 1.10.0 |
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
      | marketplace name | marketplace scope | marketplace details autoupdate | id         | name | status    | reasons | scope   | version |
      | tools            | project           | true                           | demo@tools | demo | installed |         | project | 1.10.0  |
    When the user runs "/claude:plugin info demo@tools --scope project"
    Then the result has these fields:
      | kind                           | plugin-info |
      | severity                       | info        |
      | needs reload                   | false       |
      | marketplace name               | tools       |
      | marketplace scope              | project     |
      | marketplace details autoupdate | true        |
      | plugin status                  | installed   |
      | plugin name                    | demo        |
      | plugin id                      | demo@tools  |
      | plugin reasons                 |             |
      | plugin scope                   | project     |
      | plugin version                 | 1.10.0      |
      | plugin components resolved     | true        |
      | plugin components skills       | demo-skill  |
    When the user starts a new pi session
    Then the session offers these skills:
      | command           | description             |
      | /skill:demo-skill | A skill of demo 1.10.0. |

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

  Scenario Outline: Repeating an autoupdate does not reinstall a plugin
    Given the marketplace "tools" is published as a <source kind> source
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install demo@tools --scope project"
    Given the user has run "/claude:plugin marketplace autoupdate tools --scope project"
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | demo | 1.10.0  |
    Given the marketplace "tools" has the description "A longer refreshed catalog description"
    Given the user has run "/claude:plugin marketplace update tools --scope project"
    When the user runs "/claude:plugin marketplace update tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | marketplace status | marketplace reasons |
      | tools            | project           | skipped            | up-to-date          |
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
      | marketplace name | marketplace scope | marketplace details autoupdate | id         | name | status    | reasons | scope   | version |
      | tools            | project           | true                           | demo@tools | demo | installed |         | project | 1.10.0  |
    When the user starts a new pi session
    Then the session offers these skills:
      | command           | description             |
      | /skill:demo-skill | A skill of demo 1.10.0. |

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

  Scenario Outline: An unchanged autoupdate is up to date
    Given the marketplace "tools" is published as a <source kind> source
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install demo@tools --scope project"
    Given the user has run "/claude:plugin marketplace autoupdate tools --scope project"
    When the user runs "/claude:plugin marketplace update tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | marketplace status | marketplace reasons |
      | tools            | project           | skipped            | up-to-date          |
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
      | marketplace name | marketplace scope | marketplace details autoupdate | id         | name | status    | reasons | scope   | version |
      | tools            | project           | true                           | demo@tools | demo | installed |         | project | 1.0.0   |
    When the user starts a new pi session
    Then the session offers these skills:
      | command           | description            |
      | /skill:demo-skill | A skill of demo 1.0.0. |

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

  Scenario Outline: Autoupdate does not install newly offered plugins
    Given the marketplace "tools" is published as a <source kind> source
    Given the marketplace "tools" offers these plugins:
      | name     | version |
      | existing | 1.0.0   |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install existing@tools --scope project"
    Given the user has run "/claude:plugin marketplace autoupdate tools --scope project"
    Given the marketplace "tools" offers these plugins:
      | name     | version |
      | existing | 1.0.0   |
      | new      | 1.0.0   |
    Given the marketplace "tools" has the description "A catalog with a newly offered plugin"
    When the user runs "/claude:plugin marketplace update tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | marketplace status | id             | name     | status  | reasons    | scope   |
      | tools            | project           | updated            | existing@tools | existing | skipped | up-to-date | project |
    When the user runs "/claude:plugin list --scope project"
    Then the result has these fields:
      | kind                | cascade     |
      | severity            | info        |
      | needs reload        | false       |
      | tally label         | Plugin list |
      | tally failures      | 0           |
      | tally warnings      | 0           |
      | tally success count | 2           |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace details autoupdate | id             | name     | status    | reasons | scope   | version |
      | tools            | project           | true                           | existing@tools | existing | installed |         | project | 1.0.0   |
      | tools            | project           | true                           | new@tools      | new      | available |         |         | 1.0.0   |
    When the user starts a new pi session
    Then the session offers these skills:
      | command               | description                |
      | /skill:existing-skill | A skill of existing 1.0.0. |

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

  Scenario Outline: Autoupdate keeps a plugin removed from the catalog
    Given the marketplace "tools" is published as a <source kind> source
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install demo@tools --scope project"
    Given the user has run "/claude:plugin marketplace autoupdate tools --scope project"
    Given the marketplace "tools" offers these plugins:
      | name  | version |
      | other | 1.0.0   |
    Given the marketplace "tools" has the description "A catalog that no longer offers demo"
    When the user runs "/claude:plugin marketplace update tools --scope project"
    Then the result has these fields:
      | kind         | cascade                             |
      | severity     | warning                             |
      | needs reload | false                               |
      | summary      | A plugin operation needs attention. |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | marketplace status | id         | name | status  | reasons         | scope   |
      | tools            | project           | updated            | demo@tools | demo | skipped | not in manifest | project |
    When the user runs "/claude:plugin list --scope project"
    Then the result has these fields:
      | kind                | cascade     |
      | severity            | info        |
      | needs reload        | false       |
      | tally label         | Plugin list |
      | tally failures      | 0           |
      | tally warnings      | 0           |
      | tally success count | 2           |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace details autoupdate | id          | name  | status    | reasons         | scope   | version |
      | tools            | project           | true                           | demo@tools  | demo  | installed | not in manifest | project | 1.0.0   |
      | tools            | project           | true                           | other@tools | other | available |                 |         | 1.0.0   |
    When the user starts a new pi session
    Then the session reports these results:
      | kind                      | severity | needs reload | summary                             | tally label | tally failures | tally warnings |
      | reconcile-applied-cascade | warning  | false        | A plugin operation needs attention. | Reconcile   | 0              | 1              |
      | reconcile-applied-cascade | warning  | false        | A plugin operation needs attention. | Reconcile   | 0              | 1              |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id         | name | status | reasons         | scope   | leaks | rollback partial | cause chain                                    | cause truncated |
      | tools            | project           | demo@tools | demo | failed | not in manifest | project |       |                  | Plugin "demo" not found in marketplace "tools" | false           |
      | tools            | project           | demo@tools | demo | failed | not in manifest | project |       |                  | Plugin "demo" not found in marketplace "tools" | false           |
    Then the session offers these skills:
      | command           | description            |
      | /skill:demo-skill | A skill of demo 1.0.0. |

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

  Scenario Outline: Autoupdate continues in installed order after a plugin fails
    Given the marketplace "tools" is published as a <source kind> source
    Given the marketplace "tools" offers these plugins:
      | name  | version |
      | zeta  | 1.0.0   |
      | alpha | 1.0.0   |
    Given the marketplace "tools" is added to the <scope> scope
    Given the user has run "/claude:plugin install zeta@tools --scope <scope>"
    Given the user has run "/claude:plugin install alpha@tools --scope <scope>"
    Given the user has run "/claude:plugin marketplace autoupdate tools --scope <scope>"
    Given the marketplace "tools" offers these plugins:
      | name  | version |
      | alpha | 1.10.0  |
      | zeta  | 1.10.0  |
    Given the marketplace "tools" has the description "A catalog ordered opposite its installs"
    Given the published plugin "zeta" of the marketplace "tools" has an unreadable skill file
    When the user runs "/claude:plugin marketplace update tools --scope <scope>"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | true                           |
      | summary      | A plugin operation has failed. |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | marketplace status | id          | name  | status  | reasons           | scope   | from  | to     | version | leaks | rollback partial |
      | tools            | <scope>           | updated            | zeta@tools  | zeta  | failed  | permission denied | <scope> | 1.0.0 |        | 1.10.0  |       |                  |
      | tools            | <scope>           | updated            | alpha@tools | alpha | updated |                   | <scope> | 1.0.0 | 1.10.0 |         |       |                  |
    When the user runs "/claude:plugin list --scope <scope>"
    Then the result has these fields:
      | kind                | cascade     |
      | severity            | info        |
      | needs reload        | false       |
      | tally label         | Plugin list |
      | tally failures      | 0           |
      | tally warnings      | 0           |
      | tally success count | 2           |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace details autoupdate | id          | name  | status     | reasons | scope   | version |
      | tools            | <scope>           | true                           | alpha@tools | alpha | installed  |         | <scope> | 1.10.0  |
      | tools            | <scope>           | true                           | zeta@tools  | zeta  | upgradable |         | <scope> | 1.0.0   |
    When the user starts a new pi session
    Then the session reports these results:
      | kind    | severity | needs reload | needs apply | tally label       | tally failures | tally warnings | tally success count |
      | cascade | info     | false        | true        | Reconcile pending | 0              | 0              | 1                   |
      | cascade | info     | false        | true        | Reconcile pending | 0              | 0              | 1                   |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id         | name | status      | reasons | scope   | from  | to     |
      | tools            | <scope>           | zeta@tools | zeta | will update |         | <scope> | 1.0.0 | 1.10.0 |
      | tools            | <scope>           | zeta@tools | zeta | will update |         | <scope> | 1.0.0 | 1.10.0 |
    Then the session offers these skills:
      | command            | description              |
      | /skill:alpha-skill | A skill of alpha 1.10.0. |
      | /skill:zeta-skill  | A skill of zeta 1.0.0.   |

    Examples:
      | source kind | scope   |
      | dir         | project |
      | file        | project |
      | dir         | user    |
      | file        | user    |

  Scenario Outline: An invalid refreshed manifest leaves installed plugins unchanged
    Given the marketplace "tools" is published as a <source kind> source
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "tools" is added to the <scope> scope
    Given the user has run "/claude:plugin install demo@tools --scope <scope>"
    Given the user has run "/claude:plugin marketplace autoupdate tools --scope <scope>"
    Given the manifest of the marketplace "tools" to update <manifest problem>
    When the user runs "/claude:plugin marketplace update"
    Then the result has these fields:
      | kind           | cascade                      |
      | severity       | error                        |
      | needs reload   | false                        |
      | summary        | Some operations have failed. |
      | tally label    | Marketplace update           |
      | tally failures | 2                            |
      | tally warnings | 0                            |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | marketplace status | id    | name  | status | reasons  | scope   | leaks | rollback partial | cause chain   | cause truncated |
      | tools            | <scope>           | failed             | tools | tools | failed | <reason> | <scope> |       |                  | <cause chain> | false           |
    Then the "claude-plugins.json" file of the <scope> scope declares these marketplaces:
      | name  | source   | autoupdate |
      | tools | <source> | true       |
    Then the "claude-plugins.json" file of the <scope> scope declares these plugins:
      | id         |
      | demo@tools |
    When the user starts a new pi session
    Then the session reports these results:
      | kind                      | severity | needs reload | summary                             | tally label | tally failures | tally warnings |
      | reconcile-applied-cascade | warning  | false        | A plugin operation needs attention. | Reconcile   | 0              | 1              |
      | reconcile-applied-cascade | warning  | false        | A plugin operation needs attention. | Reconcile   | 0              | 1              |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id         | name | status | reasons           | scope   | leaks | rollback partial | cause chain                                                                     | cause truncated |
      | tools            | <scope>           | demo@tools | demo | failed | <reason>          | <scope> |       |                  | cannot read the dependencies of demo@tools: its marketplace manifest is invalid | false           |
      | tools            | <scope>           | demo@tools | demo | failed | <reason>          | <scope> |       |                  | cannot read the dependencies of demo@tools: its marketplace manifest is invalid | false           |
    Then the session offers these skills:
      | command           | description            |
      | /skill:demo-skill | A skill of demo 1.0.0. |

    Examples:
      | source kind | scope   | manifest problem           | source                                                    | cause chain                                                                                                                                                                                                                                                    | reason           |
      | dir         | project | is not valid json          | {home}/marketplaces/tools                                 | Failed to update marketplace "tools"., marketplace.json is not valid JSON: SyntaxError: Expected ',' or '}' after property value in JSON at position 56 (line 1 column 57), Expected ',' or '}' after property value in JSON at position 56 (line 1 column 57) | unparseable      |
      | file        | project | breaks the manifest schema | {home}/marketplaces/tools/.claude-plugin/marketplace.json | Failed to update marketplace "tools"., marketplace.json schema invalid: /plugins: must be array                                                                                                                                                                | invalid manifest |
      | dir         | user    | breaks the manifest schema | {home}/marketplaces/tools                                 | Failed to update marketplace "tools"., marketplace.json schema invalid: /plugins: must be array                                                                                                                                                                | invalid manifest |
      | file        | user    | is not valid json          | {home}/marketplaces/tools/.claude-plugin/marketplace.json | Failed to update marketplace "tools"., marketplace.json is not valid JSON: SyntaxError: Expected ',' or '}' after property value in JSON at position 56 (line 1 column 57), Expected ',' or '}' after property value in JSON at position 56 (line 1 column 57) | unparseable      |

  Scenario Outline: A repaired marketplace can be updated again
    Given the marketplace "tools" is published as a <source kind> source
    Given the marketplace "tools" is added to the project scope
    Given the manifest of the marketplace "tools" to update is not valid json
    Given updating the marketplace "tools" in the project scope has failed as unparseable
    Given the marketplace "tools" source is repaired with a changed valid manifest
    When the user runs "/claude:plugin marketplace update"
    Then the result has these fields:
      | kind                | cascade            |
      | severity            | info               |
      | needs reload        | false              |
      | tally label         | Marketplace update |
      | tally failures      | 0                  |
      | tally warnings      | 0                  |
      | tally success count | 1                  |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | marketplace status |
      | tools            | project           | updated            |

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

  Scenario: A missing marketplace directory leaves its registration intact
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" is added to the project scope
    Given the published source of the marketplace "tools" is removed
    When the user runs "/claude:plugin marketplace update"
    Then the result has these fields:
      | kind           | cascade                      |
      | severity       | error                        |
      | needs reload   | false                        |
      | summary        | Some operations have failed. |
      | tally label    | Marketplace update           |
      | tally failures | 2                            |
      | tally warnings | 0                            |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | marketplace status | id    | name  | status | reasons        | scope   | leaks | rollback partial | cause chain                                                                                                                                | cause truncated |
      | tools            | project           | failed             | tools | tools | failed | source missing | project |       |                  | Failed to update marketplace "tools"., ENOENT: no such file or directory, open '{home}/marketplaces/tools/.claude-plugin/marketplace.json' | false           |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name  | source                    |
      | tools | {home}/marketplaces/tools |
