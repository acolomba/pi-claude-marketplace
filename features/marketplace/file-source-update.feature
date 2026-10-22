Feature: Marketplace file source update

  A file source keeps the manifest the user added when the marketplace updates.
  The scenarios run the real extension in a headless Pi against local files.

  Scenario: An external manifest is refreshed from its original file
    Given the marketplace "tools" is published as an external manifest
    Given the marketplace "tools" has the description "Original tools"
    Given the marketplace "tools" is added to the project scope
    Given the marketplace "tools" update source contains this manifest:
      """
      {"name":"tools","owner":{"name":"features"},"plugins":[],"description":"Refreshed tools with a longer description"}
      """
    When the user runs "/claude:plugin marketplace update tools --scope project"
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | marketplace status |
      | tools            | project           | updated            |
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    When the user runs "/claude:plugin marketplace info tools --scope project"
    Then the marketplace info result has these fields:
      | kind                    | marketplace-info                                   |
      | name                    | tools                                              |
      | scope                   | project                                            |
      | details autoupdate      | false                                              |
      | details last updated at | {scenario time}                                    |
      | source kind             | path                                               |
      | source abs path         | {home}/marketplaces/tools/catalog/marketplace.json |
      | source url              |                                                    |
      | source owner            |                                                    |
      | source repo             |                                                    |
      | source ref              |                                                    |
      | description             | Refreshed tools with a longer description          |
      | severity                | info                                               |
      | needs reload            | false                                              |

  Scenario: A conventional manifest keeps its file identity
    Given the marketplace "tools" is published as a file source
    Given the marketplace "tools" is added to the project scope
    When the user runs "/claude:plugin marketplace info tools --scope project"
    Then the marketplace info result has these fields:
      | kind                    | marketplace-info                                          |
      | name                    | tools                                                     |
      | scope                   | project                                                   |
      | details autoupdate      | false                                                     |
      | details last updated at | {scenario time}                                           |
      | source kind             | path                                                      |
      | source abs path         | {home}/marketplaces/tools/.claude-plugin/marketplace.json |
      | source url              |                                                           |
      | source owner            |                                                           |
      | source repo             |                                                           |
      | source ref              |                                                           |
      | severity                | info                                                      |
      | needs reload            | false                                                     |

  Scenario: A repeated external manifest update is up to date
    Given the marketplace "tools" is published as an external manifest
    Given the marketplace "tools" is added to the project scope
    Given the marketplace "tools" update source contains this manifest:
      """
      {"name":"tools","owner":{"name":"features"},"plugins":[],"description":"Updated once"}
      """
    When the user runs "/claude:plugin marketplace update tools --scope project"
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | marketplace status |
      | tools            | project           | updated            |
    When the user starts a new pi session
    When the user runs "/claude:plugin marketplace update tools --scope project"
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | marketplace status | marketplace reasons |
      | tools            | project           | skipped            | up-to-date          |
    When the user runs "/claude:plugin marketplace info tools --scope project"
    Then the marketplace info result has these fields:
      | kind                    | marketplace-info                                      |
      | name                    | tools                                                 |
      | scope                   | project                                               |
      | details autoupdate      | false                                                 |
      | details last updated at | {scenario time}                                       |
      | source kind             | path                                                  |
      | source abs path         | {home}/marketplaces/tools/catalog/marketplace.json    |
      | source url              |                                                       |
      | source owner            |                                                       |
      | source repo             |                                                       |
      | source ref              |                                                       |
      | description             | Updated once                                          |
      | severity                | info                                                  |
      | needs reload            | false                                                 |

  Scenario: A missing original manifest does not use a conventional decoy
    Given the marketplace "tools" is published as an external manifest
    Given the marketplace "tools" is added to the project scope
    Given the published source of the marketplace "tools" is removed
    Given a conventional decoy is published for the marketplace "tools"
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
      | marketplace name | marketplace scope | marketplace status | id          | name  | status | reasons        | scope   | leaks | rollback partial | cause chain                                                                                                                         | cause truncated |
      | tools            | project           | failed             | tools@tools | tools | failed | source missing | project |       |                  | Failed to update marketplace "tools"., ENOENT: no such file or directory, open '{home}/marketplaces/tools/catalog/marketplace.json' | false           |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name  | source                                             |
      | tools | {home}/marketplaces/tools/catalog/marketplace.json |
