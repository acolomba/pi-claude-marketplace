Feature: Marketplace url source update

  A url marketplace updates by fetching from its git host.
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
      | tools            | project           | failed             | tools | tools | failed | network error | project |       |                  | <status> on https://{git host}/acme/tools.git, HTTP Error: <status> <phrase> | false           |
    Then the git host receives these requests:
      | method | path                                              | status   |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | <status> |

    Examples:
      | status | phrase                |
      | 500    | Internal Server Error |
      | 502    | Bad Gateway           |
      | 503    | Service Unavailable   |
      | 404    | Not Found             |

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
      | tools            | project           | failed             |                     | tools | tools | failed | network unreachable | project |       |                  | Failed to update marketplace "tools"., socket hang up | false           |
      | extras           | project           | skipped            | up-to-date          |       |       |        |                     |         |       |                  |                                                       |                 |
