Feature: Marketplace hosted source update

  `marketplace update` downloads a hosted marketplace's catalog again, and keeps
  the stored copy when the download fails. The run's loopback https git host
  serves the catalog file and records every request.

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
      | marketplace name | marketplace scope | marketplace status | id    | name  | status | reasons       | scope   | leaks | rollback partial | cause chain                                                                                                                                                                                         | cause truncated |
      | tools            | project           | failed             | tools | tools | failed | network error | project |       |                  | 404 on https://{git host}/acme/tools/marketplace.json, HTTP 404 error while downloading marketplace from https://{git host}/acme/tools/marketplace.json. The marketplace file may not exist at this URL. | false           |
    Then the git host receives these requests:
      | method | path                         | status |
      | GET    | /acme/tools/marketplace.json | 404    |
