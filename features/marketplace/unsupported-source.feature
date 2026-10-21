Feature: Marketplace unsupported source

  A source form the extension does not accept fails before any network access.
  The scenarios point every form that can name a host at the loopback https git
  host and check that the host receives nothing.

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
    Then the git host receives no request

    Examples:
      | source                           |
      | http://{git host}/acme/tools.git |
      | ssh://{git host}/acme/tools.git  |
      | git@127.0.0.1:acme/tools.git     |
      | ~other/marketplaces/tools        |

    @github
    Examples:
      | source kind | source                                  |
      | github      | https://github.com/acme/tools/tree/main |
      | github      | https://github.com/acme                 |
      | github      | tools                                   |
      | github      | acme/tools/extra                        |
