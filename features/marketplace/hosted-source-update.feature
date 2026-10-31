Feature: Marketplace hosted source update

  `marketplace update` downloads a hosted marketplace's catalog again, and keeps
  the stored copy when the download fails or the catalog declares a name Claude
  Code reserves. The run's loopback https git host serves the catalog file and
  records every request.

  Scenario: Updating a hosted marketplace downloads its catalog again and records the change
    Given the marketplace "tools" is published as a hosted source
    Given the marketplace "tools" is added to the project scope
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    When the user runs "/claude:plugin marketplace update tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | marketplace status |
      | tools            | project           | updated            |
    Then the git host receives these requests:
      | method | path                         | status |
      | GET    | /acme/tools/marketplace.json | 200    |

  Scenario: Updating a hosted marketplace whose catalog has not changed reports it up to date
    Given the marketplace "tools" is published as a hosted source
    Given the marketplace "tools" is added to the project scope
    When the user runs "/claude:plugin marketplace update tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | marketplace status | marketplace reasons |
      | tools            | project           | skipped            | up-to-date          |
    Then the git host receives these requests:
      | method | path                         | status |
      | GET    | /acme/tools/marketplace.json | 200    |

  Scenario: Updating a hosted marketplace whose connection drops fails as network unreachable and keeps its installed plugins
    Given the git repository "ghp" holds these plugins:
      | name | version | path |
      | ghp  | 1.0.0   |      |
    Given the marketplace "tools" is published as a hosted source
    Given the marketplace "tools" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | ghp  | url         | ghp        | false  |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install ghp@tools --scope project"
    Given the git host drops the connection for the marketplace "tools"
    When the user runs "/claude:plugin marketplace update tools --scope project"
    Then the result has these fields:
      | kind         | cascade                      |
      | severity     | error                        |
      | needs reload | false                        |
      | summary      | Some operations have failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace status | id    | name  | status | reasons             | scope   | leaks | rollback partial | cause chain                                                                                                                                 | cause truncated |
      | tools            | project           | failed             | tools | tools | failed | network unreachable | project |       |                  | Failed to update marketplace "tools"., Could not connect to https://{git host}/acme/tools/marketplace.json, fetch failed, other side closed | false           |
    Then the git host receives these requests:
      | method | path                         | status  |
      | GET    | /acme/tools/marketplace.json | dropped |
    When the user runs "/claude:plugin list --scope project"
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name | status    | reasons | scope   | version |
      | tools            | project           | ghp@tools | ghp  | installed |         | project | 1.0.0   |

  Scenario: Updating a hosted marketplace the git host answers with 404 fails as network error
    Given the marketplace "tools" is published as a hosted source
    Given the marketplace "tools" is added to the project scope
    Given the git host answers 404 for the marketplace "tools"
    When the user runs "/claude:plugin marketplace update tools --scope project"
    Then the result has these fields:
      | kind         | cascade                      |
      | severity     | error                        |
      | needs reload | false                        |
      | summary      | Some operations have failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace status | id    | name  | status | reasons       | scope   | leaks | rollback partial | cause chain                                                                                                                                                                                              | cause truncated |
      | tools            | project           | failed             | tools | tools | failed | network error | project |       |                  | 404 on https://{git host}/acme/tools/marketplace.json, HTTP 404 error while downloading marketplace from https://{git host}/acme/tools/marketplace.json. The marketplace file may not exist at this URL. | false           |
    Then the git host receives these requests:
      | method | path                         | status |
      | GET    | /acme/tools/marketplace.json | 404    |

  Scenario: Updating a hosted marketplace whose catalog now declares a reserved name fails with Claude Code's refusal
    Given the marketplace "tools" is published as a hosted source
    Given the marketplace "tools" is added to the project scope
    Given the marketplace "tools" update source contains this manifest:
      """
      {"name":"claude-plugins-official","owner":{"name":"features"},"plugins":[]}
      """
    When the user runs "/claude:plugin marketplace update tools --scope project"
    Then the result has these fields:
      | kind         | cascade                      |
      | severity     | error                        |
      | needs reload | false                        |
      | summary      | Some operations have failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace status | id    | name  | status | reasons          | scope   | leaks | rollback partial | cause chain                                                                                                                                                                                            | cause truncated |
      | tools            | project           | failed             | tools | tools | failed | invalid manifest | project |       |                  | Failed to update marketplace "tools"., The name 'claude-plugins-official' is reserved for official Anthropic marketplaces and can only be used with GitHub sources from the 'anthropics' organization. | false           |
    Then the git host receives these requests:
      | method | path                         | status |
      | GET    | /acme/tools/marketplace.json | 200    |

  Scenario: Updating a hosted marketplace whose catalog now declares a look-alike name fails with Claude Code's refusal
    Given the marketplace "tools" is published as a hosted source
    Given the marketplace "tools" is added to the project scope
    Given the marketplace "tools" update source contains this manifest:
      """
      {"name":"claude-plugins-v2","owner":{"name":"features"},"plugins":[]}
      """
    When the user runs "/claude:plugin marketplace update tools --scope project"
    Then the result has these fields:
      | kind         | cascade                      |
      | severity     | error                        |
      | needs reload | false                        |
      | summary      | Some operations have failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace status | id    | name  | status | reasons          | scope   | leaks | rollback partial | cause chain                                                                                                   | cause truncated |
      | tools            | project           | failed             | tools | tools | failed | invalid manifest | project |       |                  | Failed to update marketplace "tools"., Marketplace name impersonates an official Anthropic/Claude marketplace | false           |
    Then the git host receives these requests:
      | method | path                         | status |
      | GET    | /acme/tools/marketplace.json | 200    |

  Scenario: A hosted marketplace whose refresh was refused for a reserved name keeps its stored catalog
    Given the marketplace "tools" is published as a hosted source
    Given the marketplace "tools" has the description "Accepted tools"
    Given the marketplace "tools" is added to the project scope
    Given the marketplace "tools" update source contains this manifest:
      """
      {"name":"claude-plugins-official","owner":{"name":"features"},"plugins":[],"description":"Renamed tools"}
      """
    Given the user has run "/claude:plugin marketplace update tools --scope project", which failed
    When the user runs "/claude:plugin marketplace info tools --scope project"
    Then the marketplace info result has these fields:
      | kind                    | marketplace-info                               |
      | name                    | tools                                          |
      | scope                   | project                                        |
      | details autoupdate      | false                                          |
      | details last updated at | {scenario time}                                |
      | source kind             | url                                            |
      | source abs path         |                                                |
      | source url              | https://{git host}/acme/tools/marketplace.json |
      | source owner            |                                                |
      | source repo             |                                                |
      | source ref              |                                                |
      | description             | Accepted tools                                 |
      | severity                | info                                           |
      | needs reload            | false                                          |
    Then the git host receives no request
