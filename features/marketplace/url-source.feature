Feature: Marketplace url source

  A url source is an https git URL that Pi clones the marketplace from.
  The scenarios run the real extension in a headless Pi against a loopback
  https git host that records every request it receives.

  Scenario: Adding a url marketplace clones it from the git host
    Given the marketplace "tools" is published as a url source
    When the user runs "/claude:plugin marketplace add https://{git host}/acme/tools.git --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope   | status |
      | tools | project | added  |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name  | source                            |
      | tools | https://{git host}/acme/tools.git |
    Then the git host receives these requests:
      | method | path                                              | status |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/tools.git/git-upload-pack                   | 200    |

  Scenario: A url source is cloned at exactly the url typed
    Given the marketplace "tools" is published as a url source
    When the user runs "/claude:plugin marketplace add https://{git host}/acme/tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope   | status |
      | tools | project | added  |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name  | source                        |
      | tools | https://{git host}/acme/tools |
    Then the git host receives these requests:
      | method | path                                          | status |
      | GET    | /acme/tools/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/tools/git-upload-pack                   | 200    |
