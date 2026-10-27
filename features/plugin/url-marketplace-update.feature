Feature: Plugin url marketplace update

  A plugin update first refreshes its url marketplace under the scope's state lock.
  The scenarios run the real extension in a headless Pi against a loopback https
  git host, arm the marketplace to fail or hold the lock, and read the result.

  Scenario Outline: Updating a plugin whose url marketplace the git host answers with an HTTP error fails as network error
    Given the marketplace "tools" is published as a url source
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install demo@tools --scope project"
    Given the git host answers <status> for the marketplace "tools"
    When the user runs "/claude:plugin update demo@tools --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id          | name  | status | reasons       | scope   | leaks | rollback partial | cause chain                                                                  | cause truncated |
      | tools            | project           | tools@tools | tools | failed | network error | project |       |                  | <status> on https://{git host}/acme/tools.git, HTTP Error: <status> <phrase> | false           |
    Then the git host receives these requests:
      | method | path                                              | status   |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | <status> |

    Examples:
      | status | phrase                |
      | 500    | Internal Server Error |
      | 502    | Bad Gateway           |
      | 503    | Service Unavailable   |
      | 404    | Not Found             |

  Scenario: Updating a plugin while another process holds the state lock fails as lock held and does not refresh its url marketplace
    Given the marketplace "tools" is published as a url source
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install demo@tools --scope project"
    Given another process holds the state lock of the project scope
    When the user runs "/claude:plugin update demo@tools --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id          | name  | status | reasons   | scope   | leaks | rollback partial | cause chain                                                                                                                                                                                | cause truncated |
      | tools            | project           | tools@tools | tools | failed | lock held | project |       |                  | Another pi-claude-marketplace operation is in progress for project scope ({project dir}/.pi/pi-claude-marketplace/.state-lock). Retry after it completes., Lock file is already being held | false           |
    Then the git host receives no request
