Feature: Marketplace url source update

  A url marketplace updates by asking its git host for the current commit
  and, when the checkout is behind, cloning it again.
  The scenarios run the real extension in a headless Pi against a loopback
  https git host, arm one repository to fail, and read the update result.

  Scenario Outline: Updating a url marketplace the git host answers with an HTTP error fails as network error
    Given the marketplace "tools" is published as a url source
    Given the marketplace "tools" is added to the project scope
    Given the git host answers <status> for the marketplace "tools"
    When the user runs "/claude:plugin marketplace update tools --scope project"
    Then the result has these fields:
      | kind         | cascade                      |
      | severity     | error                        |
      | needs reload | false                        |
      | summary      | Some operations have failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace status | id    | name  | status | reasons       | scope   | leaks | rollback partial | cause chain                                                                  | cause truncated |
      | tools            | project           | failed             | tools | tools | failed | network error | project |       |                  | <status> on https://{git host}/acme/tools.git, git ls-remote failed: <kind>, exit code 128 | false           |
    Then the git host receives these requests:
      | method | path                                              | status   |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | <status> |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | <status> |

    Examples:
      | status | kind                 |
      | 500    | network              |
      | 502    | network              |
      | 503    | network              |
      | 404    | repository-not-found |

  Scenario: A bare update continues past a url marketplace whose connection drops
    Given the marketplace "tools" is published as a url source
    Given the marketplace "extras" is published as a url source
    Given the marketplace "tools" is added to the project scope
    Given the marketplace "extras" is added to the project scope
    Given the git host drops the connection for the marketplace "tools"
    When the user runs "/claude:plugin marketplace update"
    Then the command reports these results:
      | kind    | severity | needs reload | summary                      | tally label        | tally failures | tally warnings | tally success count |
      | cascade | error    | false        | Some operations have failed. | Marketplace update | 2              | 0              |                     |
      | cascade | info     | false        |                              | Marketplace update | 0              | 0              | 1                   |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | marketplace status | marketplace reasons | id    | name  | status | reasons             | scope   | leaks | rollback partial | cause chain                                           | cause truncated |
      | tools            | project           | failed             |                     | tools | tools | failed | network unreachable | project |       |                  | Failed to update marketplace "tools"., git ls-remote failed: network, exit code 128 | false           |
      | extras           | project           | skipped            | up-to-date          |       |       |        |                     |         |       |                  |                                                       |                 |

  Scenario: Updating a url marketplace an earlier version recorded with a clone url ending in .json still fetches from its git host
    Given the marketplace "tools" is published as a url source
    Given the marketplace "tools" is added to the project scope
    Given an earlier version recorded the clone url of the marketplace "tools" in the project scope as "https://{git host}/acme/tools.json"
    When the user runs "/claude:plugin marketplace update tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | marketplace status | marketplace reasons |
      | tools            | project           | skipped            | up-to-date          |
    Then the git host receives these requests:
      | method | path                                              | status |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/tools.git/git-upload-pack                   | 200    |

  Scenario: Updating a url marketplace whose git host is unreachable keeps its checkout when CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE is set
    Given pi runs with the environment variable "CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE" set to "1"
    Given the marketplace "tools" is published as a url source
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "tools" is added to the project scope
    Given the git host drops the connection for the marketplace "tools"
    When the user runs "/claude:plugin marketplace update tools --scope project"
    Then the result has these fields:
      | kind         | cascade                         |
      | severity     | warning                         |
      | needs reload | false                           |
      | summary      | Some operations need attention. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace status | id    | name  | status  | reasons             | scope   | leaks | rollback partial | cause chain                                                                                                                                           | cause truncated | marketplace reasons |
      | tools            | project           | skipped            | tools | tools | skipped | network unreachable | project |       |                  | Marketplace remote unreachable, keeping existing clone (CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE), git ls-remote failed: network, exit code 128 | false           | network unreachable |
    Then the git host receives these requests:
      | method | path                                              | status  |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | dropped |
    When the user runs "/claude:plugin install demo@tools --scope project"
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id         | name | status    | reasons | scope   | version |
      | tools            | project           | demo@tools | demo | installed |         | project | 1.0.0   |
    Then the git host receives no request

  Scenario: Updating a url marketplace with CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE set still replaces a checkout its remote moved past
    Given pi runs with the environment variable "CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE" set to "1"
    Given the marketplace "tools" is published as a url source
    Given the marketplace "tools" has the description "Tools before the update"
    Given the marketplace "tools" is added to the project scope
    Given the marketplace "tools" has the description "Tools after the update"
    When the user runs "/claude:plugin marketplace update tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | marketplace status |
      | tools            | project           | updated            |
    Then the git host receives these requests:
      | method | path                                              | status |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/tools.git/git-upload-pack                   | 200    |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/tools.git/git-upload-pack                   | 200    |
      | POST   | /acme/tools.git/git-upload-pack                   | 200    |
    When the user runs "/claude:plugin marketplace info tools --scope project"
    Then the marketplace info result has these fields:
      | kind                    | marketplace-info              |
      | name                    | tools                         |
      | scope                   | project                       |
      | details autoupdate      | false                         |
      | details last updated at | {scenario time}               |
      | source kind             | url                           |
      | source abs path         |                               |
      | source url              | https://{git host}/acme/tools |
      | source owner            |                               |
      | source repo             |                               |
      | source ref              |                               |
      | description             | Tools after the update        |
      | severity                | info                          |
      | needs reload            | false                         |

  Scenario: Updating a url marketplace whose git host is unreachable fails when CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE is unset and leaves the previous checkout installable
    Given the marketplace "tools" is published as a url source
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "tools" is added to the project scope
    Given the git host drops the connection for the marketplace "tools"
    When the user runs "/claude:plugin marketplace update tools --scope project"
    Then the result has these fields:
      | kind         | cascade                      |
      | severity     | error                        |
      | needs reload | false                        |
      | summary      | Some operations have failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace status | id    | name  | status | reasons             | scope   | leaks | rollback partial | cause chain                                                                         | cause truncated |
      | tools            | project           | failed             | tools | tools | failed | network unreachable | project |       |                  | Failed to update marketplace "tools"., git ls-remote failed: network, exit code 128 | false           |
    Then the git host receives these requests:
      | method | path                                              | status  |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | dropped |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | dropped |
    When the user runs "/claude:plugin install demo@tools --scope project"
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id         | name | status    | reasons | scope   | version |
      | tools            | project           | demo@tools | demo | installed |         | project | 1.0.0   |
    Then the git host receives no request
