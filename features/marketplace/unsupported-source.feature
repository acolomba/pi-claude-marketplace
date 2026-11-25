Feature: Marketplace unsupported source

  A source form the add command line refuses fails before any network access, and the git host
  receives nothing. The URL-scheme ssh forms, git://, and an http catalog URL name the host's port,
  so they would reach it if accepted (D-SG-17, D-PL5-36); GitHub forms reach it through the base
  override. The home-relative and invalid catalog URL rows pin the refusal.

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
      | ssh://{git host}/acme/tools.git                     |
      | git+ssh://{git host}/acme/tools.git                 |
      | ssh+git://{git host}/acme/tools.git                 |
      | git://{git host}/acme/tools.git                     |
      | http://{git host}/acme/tools/marketplace.json       |
      | ~other/marketplaces/tools                           |
      | https://127.0.0.1:99999/acme/tools/marketplace.json |
      | https:///acme/tools/marketplace.json                |

    @github
    Examples:
      | source kind | source                                  |
      | github      | https://github.com/acme/tools/tree/main |
      | github      | https://github.com/acme                 |
      | github      | tools                                   |
      | github      | acme/tools/extra                        |
