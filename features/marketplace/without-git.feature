Feature: Marketplace without git

  A git marketplace needs system git, with no fallback to another transport, so adding one with no git
  fails before any request, while dir, file, and hosted marketplaces still add (SG-PRC-06, D-SG-01).
  The scenarios run a headless Pi whose PATH holds no git, against a loopback https git host that records every request.

  Scenario Outline: Adding a git marketplace with no git fails as git missing and sends no request
    Given the marketplace "tools" is published as a <source kind> source
    Given pi runs without git on its path
    When the user runs "/claude:plugin marketplace add <source> --scope project"
    Then the result has these fields:
      | kind         | cascade                      |
      | severity     | error                        |
      | needs reload | false                        |
      | summary      | Some operations have failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace status | id       | name     | status | reasons     | scope   | leaks | rollback partial | cause chain                              | cause truncated |
      | <source>         | project           | failed             | <source> | <source> | failed | git missing | project |       |                  | Git is required to install marketplaces. | false           |
    Then the "claude-plugins.json" file of the project scope does not exist
    Then the git host receives no request

    @url
    Examples:
      | source kind | source                            |
      | url         | https://{git host}/acme/tools.git |

  Scenario Outline: Adding a github marketplace with no git fails as git missing, sends no request, and names the clone it tried
    Given the marketplace "tools" is published as a <source kind> source
    Given pi runs without git on its path
    When the user runs "/claude:plugin marketplace add <source> --scope project"
    Then the result has these fields:
      | kind         | cascade                      |
      | severity     | error                        |
      | needs reload | false                        |
      | summary      | Some operations have failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace status | id       | name     | status | reasons     | scope   | leaks | rollback partial | cause chain                              | cause truncated | marketplace clone note | marketplace clone url             |
      | <source>         | project           | failed             | <source> | <source> | failed | git missing | project |       |                  | Git is required to install marketplaces. | false           | via-https              | https://github.com/acme/tools.git |
    Then the "claude-plugins.json" file of the project scope does not exist
    Then the git host receives no request

    @github
    Examples:
      | source kind | source                            |
      | github      | acme/tools                        |
      | github      | https://github.com/acme/tools     |
      | github      | https://github.com/acme/tools.git |

  Scenario: Adding a dir marketplace with no git records it
    Given the marketplace "tools" is published as a dir source
    Given pi runs without git on its path
    When the user runs "/claude:plugin marketplace add {home}/marketplaces/tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope   | status |
      | tools | project | added  |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name  | source                    |
      | tools | {home}/marketplaces/tools |
    Then the git host receives no request

  Scenario: Adding a file marketplace with no git records it
    Given the marketplace "tools" is published as a file source
    Given pi runs without git on its path
    When the user runs "/claude:plugin marketplace add {home}/marketplaces/tools/.claude-plugin/marketplace.json --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope   | status |
      | tools | project | added  |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name  | source                                                    |
      | tools | {home}/marketplaces/tools/.claude-plugin/marketplace.json |
    Then the git host receives no request

  Scenario: Adding a hosted marketplace with no git downloads its catalog once
    Given the marketplace "tools" is published as a hosted source
    Given pi runs without git on its path
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
