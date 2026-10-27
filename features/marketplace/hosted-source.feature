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
