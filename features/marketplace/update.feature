Feature: Marketplace update

  Updating a marketplace refreshes its manifest from its source.
  The scenarios run the real extension in a headless Pi and use local
  marketplaces in place of published ones.

  Scenario: A bare update reports one result per marketplace of both scopes, project first
    Given the marketplace "beta" is published as a dir source
    Given the marketplace "alpha" is published as a dir source
    Given the marketplace "gamma" is published as a dir source
    Given the marketplace "beta" is added to the user scope
    Given the marketplace "alpha" is added to the project scope
    Given the marketplace "gamma" is added to the project scope
    When the user runs "/claude:plugin marketplace update"
    Then the command reports these results:
      | kind    | severity | needs reload | tally label        | tally failures | tally warnings | tally success count |
      | cascade | info     | false        | Marketplace update | 0              | 0              | 1                   |
      | cascade | info     | false        | Marketplace update | 0              | 0              | 1                   |
      | cascade | info     | false        | Marketplace update | 0              | 0              | 1                   |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | marketplace status | marketplace reasons |
      | alpha            | project           | skipped            | up-to-date          |
      | gamma            | project           | skipped            | up-to-date          |
      | beta             | user              | skipped            | up-to-date          |

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
    Given the marketplace "tools" has the "<rewrite>" comparison baseline
    Given the marketplace "tools" is added to the project scope
    Given the marketplace "tools" update source has the "<rewrite>" cosmetic rewrite
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
      | source kind | rewrite       |
      | dir         | formatting    |
      | dir         | top-level keys |
      | dir         | nested keys   |
      | file        | formatting    |
      | file        | top-level keys |
      | file        | nested keys   |

    @url
    Examples:
      | source kind | rewrite    |
      | url         | formatting |

    @github
    Examples:
      | source kind | rewrite    |
      | github      | formatting |

  Scenario Outline: An unknown manifest field changes the marketplace
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" has the "<change>" comparison baseline
    Given the marketplace "tools" is added to the project scope
    Given the marketplace "tools" update source has the "<change>" semantic rewrite
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
      | change                |
      | unknown field added   |
      | unknown field changed |
      | unknown field removed |

  Scenario Outline: Reordering a manifest array changes the marketplace
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" has the "<array>" comparison baseline
    Given the marketplace "tools" is added to the project scope
    Given the marketplace "tools" update source has the "<array>" semantic rewrite
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
      | array                     |
      | plugin order              |
      | allowed marketplace order |
      | unknown array order       |

  Scenario: An isolated dependency entry retains its comparison fields
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" has the "isolated dependency fields" comparison baseline
    Given the marketplace "tools" is added to the project scope
    Given the marketplace "tools" update source has the "isolated dependency fields" semantic rewrite
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
      | kind         | cascade                            |
      | severity     | warning                            |
      | needs reload | false                              |
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
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install zeta@tools --scope project"
    Given the user has run "/claude:plugin install alpha@tools --scope project"
    Given the user has run "/claude:plugin marketplace autoupdate tools --scope project"
    Given the marketplace "tools" offers these plugins:
      | name  | version |
      | alpha | 1.10.0  |
      | zeta  | 1.10.0  |
    Given the marketplace "tools" has the description "A catalog ordered opposite its installs"
    Given the published plugin "zeta" of the marketplace "tools" has an unreadable skill file
    When the user runs "/claude:plugin marketplace update tools --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | true                           |
      | summary      | A plugin operation has failed. |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | marketplace status | id          | name  | status  | reasons           | scope   | from  | to     | leaks | rollback partial |
      | tools            | project           | updated            | zeta@tools  | zeta  | failed  | permission denied | project |       |        |       |                  |
      | tools            | project           | updated            | alpha@tools | alpha | updated |                   | project | 1.0.0 | 1.10.0 |       |                  |
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
      | marketplace name | marketplace scope | marketplace details autoupdate | id          | name  | status    | reasons | scope   | version |
      | tools            | project           | true                           | alpha@tools | alpha | installed |         | project | 1.10.0  |
      | tools            | project           | true                           | zeta@tools  | zeta  | upgradable |         | project | 1.0.0   |
    When the user starts a new pi session
    Then the session offers these skills:
      | command            | description             |
      | /skill:alpha-skill | A skill of alpha 1.10.0. |
      | /skill:zeta-skill  | A skill of zeta 1.0.0.   |

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
      | marketplace name | marketplace scope | marketplace status | id          | name  | status | reasons          | scope   | leaks | rollback partial | cause chain   | cause truncated |
      | tools            | <scope>           | failed             | tools@tools | tools | failed | invalid manifest | <scope> |       |                  | <cause chain> | false           |
    Then the "claude-plugins.json" file of the <scope> scope declares these marketplaces:
      | name  | source   | autoupdate |
      | tools | <source> | true       |
    Then the "claude-plugins.json" file of the <scope> scope declares these plugins:
      | id         |
      | demo@tools |
    When the user starts a new pi session
    Then the session offers these skills:
      | command           | description            |
      | /skill:demo-skill | A skill of demo 1.0.0. |

    Examples:
      | source kind | scope   | manifest problem           | source                                                    | cause chain                                                                                                                                                                                                                                                                                |
      | dir         | project | is not valid json          | {home}/marketplaces/tools                                 | Failed to update marketplace "tools"., marketplace.json is not valid JSON: SyntaxError: Expected ',' or '}' after property value in JSON at position 56 (line 1 column 57), Expected ',' or '}' after property value in JSON at position 56 (line 1 column 57) |
      | file        | project | breaks the manifest schema | {home}/marketplaces/tools/.claude-plugin/marketplace.json | Failed to update marketplace "tools"., marketplace.json schema invalid: /plugins: must be array                                                                                                                                                                                          |
      | dir         | user    | breaks the manifest schema | {home}/marketplaces/tools                                 | Failed to update marketplace "tools"., marketplace.json schema invalid: /plugins: must be array                                                                                                                                                                                          |
      | file        | user    | is not valid json          | {home}/marketplaces/tools/.claude-plugin/marketplace.json | Failed to update marketplace "tools"., marketplace.json is not valid JSON: SyntaxError: Expected ',' or '}' after property value in JSON at position 56 (line 1 column 57), Expected ',' or '}' after property value in JSON at position 56 (line 1 column 57) |

  Scenario: A repaired marketplace can be updated again
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" is added to the project scope
    Given the manifest of the marketplace "tools" to update is not valid json
    Given updating the marketplace "tools" in the project scope has failed as invalid manifest
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
      | marketplace name | marketplace scope | marketplace status | id          | name  | status | reasons        | scope   | leaks | rollback partial | cause chain                                                                                                                                                | cause truncated |
      | tools            | project           | failed             | tools@tools | tools | failed | source missing | project |       |                  | Failed to update marketplace "tools"., ENOENT: no such file or directory, open '{home}/marketplaces/tools/.claude-plugin/marketplace.json' | false           |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name  | source                            |
      | tools | {home}/marketplaces/tools         |
