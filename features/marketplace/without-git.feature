Feature: Marketplace without git

  A git marketplace needs system git, with no fallback to another transport, so adding one with no git
  fails before any request (SG-PRC-06, D-SG-01). The scenarios run a headless Pi whose PATH holds no
  git, against a loopback https git host that records every request.

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

    @github
    Examples:
      | source kind | source                            |
      | github      | acme/tools                        |
      | github      | https://github.com/acme/tools     |
      | github      | https://github.com/acme/tools.git |
