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

  Scenario: Adding a hosted marketplace whose URL ends in an uppercase .JSON downloads its catalog
    Given the marketplace "tools" is published as a hosted source served as "marketplace.JSON"
    When the user runs "/claude:plugin marketplace add https://{git host}/acme/tools/marketplace.JSON --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope   | status |
      | tools | project | added  |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name  | source                                         |
      | tools | https://{git host}/acme/tools/marketplace.JSON |
    Then the git host receives these requests:
      | method | path                         | status |
      | GET    | /acme/tools/marketplace.JSON | 200    |

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

  Scenario: Adding a hosted marketplace whose connection drops fails as network unreachable and says why
    Given the marketplace "tools" is published as a hosted source
    Given the git host drops the connection for the marketplace "tools"
    When the user runs "/claude:plugin marketplace add https://{git host}/acme/tools/marketplace.json --scope project"
    Then the result has these fields:
      | kind         | cascade                      |
      | severity     | error                        |
      | needs reload | false                        |
      | summary      | Some operations have failed. |
    Then the result lists these plugins:
      | marketplace name                               | marketplace scope | marketplace status | id                                             | name                                           | status | reasons             | scope   | leaks | rollback partial | cause chain                                                                                          | cause truncated |
      | https://{git host}/acme/tools/marketplace.json | project           | failed             | https://{git host}/acme/tools/marketplace.json | https://{git host}/acme/tools/marketplace.json | failed | network unreachable | project |       |                  | Could not connect to https://{git host}/acme/tools/marketplace.json, fetch failed, other side closed | false           |
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

  Scenario: Adding a hosted marketplace whose URL carries a password is refused before any request
    Given the marketplace "tools" is published as a hosted source
    When the user runs "/claude:plugin marketplace add https://user:secret@{git host}/acme/tools/marketplace.json --scope project"
    Then the result has these fields:
      | kind         | cascade                      |
      | severity     | error                        |
      | needs reload | false                        |
      | summary      | Some operations have failed. |
    Then the result lists these plugins:
      | marketplace name                                   | marketplace scope | marketplace status | id                                                 | name                                               | status | reasons    | scope   | leaks | rollback partial | cause chain                                                                                                  | cause truncated |
      | https://***@{git host}/acme/tools/marketplace.json | project           | failed             | https://***@{git host}/acme/tools/marketplace.json | https://***@{git host}/acme/tools/marketplace.json | failed | unreadable | project |       |                  | Marketplace URL must not contain a user name or password: https://***@{git host}/acme/tools/marketplace.json | false           |
    Then the git host receives no request
    Then the project scope holds no marketplace checkout
    Then the "claude-plugins.json" file of the project scope does not exist

  Scenario: Adding a hosted marketplace follows a redirect that stays on the same host
    Given the marketplace "tools" is published as a hosted source
    Given the git host redirects the marketplace "tools" to "/acme/tools/marketplace.json"
    When the user runs "/claude:plugin marketplace add https://{git host}/acme/tools/moved.json --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope   | status |
      | tools | project | added  |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name  | source                                   |
      | tools | https://{git host}/acme/tools/moved.json |
    Then the git host receives these requests:
      | method | path                         | status |
      | GET    | /acme/tools/moved.json       | 302    |
      | GET    | /acme/tools/marketplace.json | 200    |

  Scenario Outline: Adding a hosted marketplace refuses a redirect to a disallowed cross-origin URL
    Given the marketplace "tools" is published as a hosted source
    Given the git host redirects the marketplace "tools" to "<location>"
    When the user runs "/claude:plugin marketplace add https://{git host}/acme/tools/moved.json --scope project"
    Then the result has these fields:
      | kind         | cascade                      |
      | severity     | error                        |
      | needs reload | false                        |
      | summary      | Some operations have failed. |
    Then the result lists these plugins:
      | marketplace name                         | marketplace scope | marketplace status | id                                       | name                                     | status | reasons    | scope   | leaks | rollback partial | cause chain                                                                                                                                                                                                                                                                     | cause truncated |
      | https://{git host}/acme/tools/moved.json | project           | failed             | https://{git host}/acme/tools/moved.json | https://{git host}/acme/tools/moved.json | failed | unreadable | project |       |                  | Marketplace catalog redirected to a disallowed URL and was refused -- a server-chosen cross-origin redirect must use https:// and must not point at a loopback, link-local, or cloud-metadata host (only a hop that stays on the origin you started from is exempt): <location> | false           |
    Then the git host receives these requests:
      | method | path                   | status |
      | GET    | /acme/tools/moved.json | 302    |
    Then the project scope holds no marketplace checkout
    Then the "claude-plugins.json" file of the project scope does not exist

    Examples:
      | location                                            |
      | http://{git host}/acme/tools/marketplace.json       |
      | https://localhost/acme/tools/marketplace.json       |
      | https://169.254.169.254/acme/tools/marketplace.json |

  Scenario: Adding a hosted marketplace whose catalog is over the size cap fails as unreadable
    Given the marketplace "tools" is published as a hosted source
    Given the git host serves 5242881 bytes as the catalog of the marketplace "tools"
    When the user runs "/claude:plugin marketplace add https://{git host}/acme/tools/marketplace.json --scope project"
    Then the result has these fields:
      | kind         | cascade                      |
      | severity     | error                        |
      | needs reload | false                        |
      | summary      | Some operations have failed. |
    Then the result lists these plugins:
      | marketplace name                               | marketplace scope | marketplace status | id                                             | name                                           | status | reasons    | scope   | leaks | rollback partial | cause chain                                                                                        | cause truncated |
      | https://{git host}/acme/tools/marketplace.json | project           | failed             | https://{git host}/acme/tools/marketplace.json | https://{git host}/acme/tools/marketplace.json | failed | unreadable | project |       |                  | Marketplace catalog at https://{git host}/acme/tools/marketplace.json is larger than 5242880 bytes | false           |
    Then the git host receives these requests:
      | method | path                         | status |
      | GET    | /acme/tools/marketplace.json | 200    |
    Then the project scope holds no marketplace checkout
    Then the "claude-plugins.json" file of the project scope does not exist

  Scenario: Adding a hosted marketplace from a URL with a fragment requests and shows the URL without it
    Given the marketplace "tools" is published as a hosted source
    When the user runs "/claude:plugin marketplace add https://{git host}/acme/tools/marketplace.json#stable --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope   | status |
      | tools | project | added  |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name  | source                                                |
      | tools | https://{git host}/acme/tools/marketplace.json#stable |
    Then the git host receives these requests:
      | method | path                         | status |
      | GET    | /acme/tools/marketplace.json | 200    |
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
      | severity                | info                                           |
      | needs reload            | false                                          |

  Scenario: Installing a plugin from a hosted marketplace clones only the plugin
    Given the git repository "ghp" holds these plugins:
      | name | version | path |
      | ghp  | 1.0.0   |      |
    Given the marketplace "tools" is published as a hosted source
    Given the marketplace "tools" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | ghp  | url         | ghp        | false  |
    Given the marketplace "tools" is added to the project scope
    When the user runs "/claude:plugin install ghp@tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name | status    | reasons | scope   | version |
      | tools            | project           | ghp@tools | ghp  | installed |         | project | 1.0.0   |
    Then the installation record of the project scope holds these plugins:
      | id        | version | enabled |
      | ghp@tools | 1.0.0   | true    |
    Then the git host receives these requests:
      | method | path                                            | status |
      | GET    | /acme/ghp.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/ghp.git/git-upload-pack                   | 200    |

  Scenario: Listing marketplaces reads a hosted marketplace without a request
    Given the marketplace "tools" is published as a hosted source
    Given the marketplace "tools" is added to the project scope
    When the user runs "/claude:plugin marketplace list --scope project"
    Then the result has these fields:
      | kind                | cascade          |
      | severity            | info             |
      | needs reload        | false            |
      | tally label         | Marketplace list |
      | tally failures      | 0                |
      | tally warnings      | 0                |
      | tally success count | 1                |
    Then the result lists these marketplaces:
      | name  | scope   | details autoupdate | details last updated at |
      | tools | project | false              | {scenario time}         |
    Then the git host receives no request

  Scenario: A hosted marketplace added by the command has nothing pending
    Given the marketplace "tools" is published as a hosted source
    Given the marketplace "tools" is added to the project scope
    When the user runs "/claude:plugin pending --scope project"
    Then the result has these fields:
      | kind         | reconcile-pending-empty |
      | severity     | info                    |
      | needs reload | false                   |
    Then the git host receives no request

  Scenario: Apply adds a hosted marketplace that a config declares
    Given the marketplace "tools" is published as a hosted source
    Given a config in scope project and layer base, with these marketplaces:
      | name  | source                                         | autoupdate |
      | tools | https://{git host}/acme/tools/marketplace.json | false      |
    When the user runs "/claude:plugin apply --scope project"
    Then the result has these fields:
      | kind                | reconcile-applied-cascade |
      | severity            | info                      |
      | needs reload        | false                     |
      | tally label         | Reconcile                 |
      | tally failures      | 0                         |
      | tally warnings      | 0                         |
      | tally success count | 1                         |
    Then the result lists these marketplaces:
      | name  | scope   | status |
      | tools | project | added  |
    Then the git host receives these requests:
      | method | path                         | status |
      | GET    | /acme/tools/marketplace.json | 200    |

  Scenario: Removing a hosted marketplace deletes its stored catalog without a request
    Given the marketplace "tools" is published as a hosted source
    Given the marketplace "tools" is added to the project scope
    When the user runs "/claude:plugin marketplace remove tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope   | status  |
      | tools | project | removed |
    Then the git host receives no request
    Then the project scope holds no marketplace checkout

  Scenario: Marketplace info shows a hosted marketplace's URL without a request
    Given the marketplace "tools" is published as a hosted source
    Given the marketplace "tools" is added to the project scope
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
      | severity                | info                                           |
      | needs reload            | false                                          |
    Then the git host receives no request
