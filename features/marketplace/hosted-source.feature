Feature: Marketplace hosted source

  A marketplace published as one marketplace.json at an https URL is
  downloaded when it is added, and read from the stored copy everywhere else.
  The run's loopback https git host serves the catalog file and records every request.

  Scenario: Adding a hosted marketplace downloads its catalog once
    Given the marketplace "tools" is published as a hosted source
    When the user runs "/claude:plugin marketplace add https://{git host}/acme/tools/marketplace.json --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope   | status |
      | tools | project | added  |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name  | source                                         |
      | tools | https://{git host}/acme/tools/marketplace.json |
    Then the git host receives these requests:
      | method | path                         | status |
      | GET    | /acme/tools/marketplace.json | 200    |

  Scenario: Adding a hosted marketplace the git host answers with 404 fails as source missing
    Given the marketplace "tools" is published as a hosted source
    Given the git host answers 404 for the marketplace "tools"
    When the user runs "/claude:plugin marketplace add https://{git host}/acme/tools/marketplace.json --scope project"
    Then the result has these fields:
      | kind         | cascade                             |
      | severity     | error                               |
      | needs reload | false                               |
      | summary      | A marketplace operation has failed. |
    Then the result lists these marketplaces:
      | name                                           | scope   | status | reasons        |
      | https://{git host}/acme/tools/marketplace.json | project | failed | source missing |
    Then the git host receives these requests:
      | method | path                         | status |
      | GET    | /acme/tools/marketplace.json | 404    |
    Then the project scope holds no marketplace checkout
    Then the "claude-plugins.json" file of the project scope does not exist

  Scenario Outline: Adding a hosted marketplace the git host answers with a server error fails as network error
    Given the marketplace "tools" is published as a hosted source
    Given the git host answers <status> for the marketplace "tools"
    When the user runs "/claude:plugin marketplace add https://{git host}/acme/tools/marketplace.json --scope project"
    Then the result has these fields:
      | kind         | cascade                      |
      | severity     | error                        |
      | needs reload | false                        |
      | summary      | Some operations have failed. |
    Then the result lists these plugins:
      | marketplace name                               | marketplace scope | marketplace status | id                                             | name                                           | status | reasons       | scope   | leaks | rollback partial | cause chain                                                                                                                                                                                                        | cause truncated |
      | https://{git host}/acme/tools/marketplace.json | project           | failed             | https://{git host}/acme/tools/marketplace.json | https://{git host}/acme/tools/marketplace.json | failed | network error | project |       |                  | <status> on https://{git host}/acme/tools/marketplace.json, HTTP <status> error while downloading marketplace from https://{git host}/acme/tools/marketplace.json. The marketplace file may not exist at this URL. | false           |
    Then the git host receives these requests:
      | method | path                         | status   |
      | GET    | /acme/tools/marketplace.json | <status> |
    Then the project scope holds no marketplace checkout
    Then the "claude-plugins.json" file of the project scope does not exist

    Examples:
      | status |
      | 500    |
      | 502    |
      | 503    |

  Scenario: Adding a hosted marketplace whose connection drops fails as network unreachable
    Given the marketplace "tools" is published as a hosted source
    Given the git host drops the connection for the marketplace "tools"
    When the user runs "/claude:plugin marketplace add https://{git host}/acme/tools/marketplace.json --scope project"
    Then the result has these fields:
      | kind         | cascade                             |
      | severity     | error                               |
      | needs reload | false                               |
      | summary      | A marketplace operation has failed. |
    Then the result lists these marketplaces:
      | name                                           | scope   | status | reasons             |
      | https://{git host}/acme/tools/marketplace.json | project | failed | network unreachable |
    Then the git host receives these requests:
      | method | path                         | status  |
      | GET    | /acme/tools/marketplace.json | dropped |
    Then the project scope holds no marketplace checkout
    Then the "claude-plugins.json" file of the project scope does not exist

  Scenario: Adding a hosted marketplace whose catalog is not valid json fails as unparseable
    Given the marketplace "tools" is published as a hosted source
    Given the manifest of the marketplace "tools" to add is not valid json
    When the user runs "/claude:plugin marketplace add https://{git host}/acme/tools/marketplace.json --scope project"
    Then the result has these fields:
      | kind         | cascade                             |
      | severity     | error                               |
      | needs reload | false                               |
      | summary      | A marketplace operation has failed. |
    Then the result lists these marketplaces:
      | name                                           | scope   | status | reasons     |
      | https://{git host}/acme/tools/marketplace.json | project | failed | unparseable |
    Then the git host receives these requests:
      | method | path                         | status |
      | GET    | /acme/tools/marketplace.json | 200    |
    Then the project scope holds no marketplace checkout
    Then the "claude-plugins.json" file of the project scope does not exist
