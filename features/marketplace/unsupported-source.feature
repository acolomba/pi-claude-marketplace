Feature: Marketplace unsupported source

  A refused source form fails before any network access, and the git host receives nothing.
  That check can fail only for forms that would reach the host: http and ssh on its port,
  and GitHub through the base override. The scp-style, home-relative, and invalid catalog URL
  rows pin the refusal.

  Scenario Outline: Adding a refused source form fails as unsupported source and reaches no host
    When the user runs "/claude:plugin marketplace add <source> --scope project"
    Then the result has these fields:
      | kind         | cascade                             |
      | severity     | error                               |
      | needs reload | false                               |
      | summary      | A marketplace operation has failed. |
    Then the result lists these marketplaces:
      | name     | scope   | status | reasons            |
      | <source> | project | failed | unsupported source |
    Then the "claude-plugins.json" file of the project scope does not exist
    Then the git host receives no request

    Examples:
      | source                                              |
      | http://{git host}/acme/tools.git                    |
      | ssh://{git host}/acme/tools.git                     |
      | git@127.0.0.1:acme/tools.git                        |
      | ~other/marketplaces/tools                           |
      | https://127.0.0.1:99999/acme/tools/marketplace.json |

    @github
    Examples:
      | source kind | source                                  |
      | github      | https://github.com/acme/tools/tree/main |
      | github      | https://github.com/acme                 |
      | github      | tools                                   |
      | github      | acme/tools/extra                        |
