Feature: Marketplace failed add

  A marketplace add that fails leaves nothing behind, so the same add succeeds
  once its cause is gone. Local marketplaces and a loopback https git host
  stand in for published ones.

  Scenario: Adding a marketplace succeeds once its invalid manifest is repaired
    Given the marketplace "tools" is published as a dir source
    Given the manifest of the marketplace "tools" to add is not valid json
    Given the user has run "/claude:plugin marketplace add {home}/marketplaces/tools --scope project", which failed
    Given the marketplace "tools" source is repaired with a changed valid manifest
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

  Scenario: Adding a marketplace succeeds once the git host serves it again
    Given the marketplace "tools" is published as a url source
    Given the git host answers 404 for the marketplace "tools"
    Given the user has run "/claude:plugin marketplace add https://{git host}/acme/tools.git --scope project", which failed
    Given the git host serves the marketplace "tools" again
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

  Scenario: Adding a marketplace whose manifest is a directory fails as unreadable and leaves nothing behind
    Given the marketplace "tools" is published as a dir source
    Given the manifest of the marketplace "tools" to add is a directory
    When the user runs "/claude:plugin marketplace add {home}/marketplaces/tools --scope project"
    Then the result has these fields:
      | kind         | cascade                             |
      | severity     | error                               |
      | needs reload | false                               |
      | summary      | A marketplace operation has failed. |
    Then the result lists these marketplaces:
      | name                      | scope   | status | reasons    |
      | {home}/marketplaces/tools | project | failed | unreadable |
    Then the project scope holds no marketplace checkout
    Then the "claude-plugins.json" file of the project scope does not exist

  Scenario: A url marketplace add that the git host answered with 404 leaves no marketplace behind
    Given the marketplace "tools" is published as a url source
    Given the git host answers 404 for the marketplace "tools"
    When the user runs "/claude:plugin marketplace add https://{git host}/acme/tools.git --scope project"
    Then the result has these fields:
      | kind         | cascade                             |
      | severity     | error                               |
      | needs reload | false                               |
      | summary      | A marketplace operation has failed. |
    Then the result lists these marketplaces:
      | name                              | scope   | status | reasons        |
      | https://{git host}/acme/tools.git | project | failed | source missing |
    Then the git host receives these requests:
      | method | path                                              | status |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 404    |
    Then the project scope holds no marketplace checkout
    Then the project scope holds no git clones
    Then the "claude-plugins.json" file of the project scope does not exist

  Scenario: A url marketplace add whose connection dropped leaves no marketplace behind
    Given the marketplace "tools" is published as a url source
    Given the git host drops the connection for the marketplace "tools"
    When the user runs "/claude:plugin marketplace add https://{git host}/acme/tools.git --scope project"
    Then the result has these fields:
      | kind         | cascade                             |
      | severity     | error                               |
      | needs reload | false                               |
      | summary      | A marketplace operation has failed. |
    Then the result lists these marketplaces:
      | name                              | scope   | status | reasons             |
      | https://{git host}/acme/tools.git | project | failed | network unreachable |
    Then the git host receives these requests:
      | method | path                                              | status  |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | dropped |
    Then the project scope holds no marketplace checkout
    Then the project scope holds no git clones
    Then the "claude-plugins.json" file of the project scope does not exist

  Scenario: A url marketplace add whose manifest is not valid json leaves no marketplace behind
    Given the marketplace "tools" is published as a url source
    Given the manifest of the marketplace "tools" to add is not valid json
    When the user runs "/claude:plugin marketplace add https://{git host}/acme/tools.git --scope project"
    Then the result has these fields:
      | kind         | cascade                             |
      | severity     | error                               |
      | needs reload | false                               |
      | summary      | A marketplace operation has failed. |
    Then the result lists these marketplaces:
      | name                              | scope   | status | reasons     |
      | https://{git host}/acme/tools.git | project | failed | unparseable |
    Then the git host receives these requests:
      | method | path                                              | status |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/tools.git/git-upload-pack                   | 200    |
    Then the project scope holds no marketplace checkout
    Then the project scope holds no git clones
    Then the "claude-plugins.json" file of the project scope does not exist

  Scenario: Adding a marketplace succeeds once the git host stops dropping the connection
    Given the marketplace "tools" is published as a url source
    Given the git host drops the connection for the marketplace "tools"
    Given the user has run "/claude:plugin marketplace add https://{git host}/acme/tools.git --scope project", which failed
    Given the git host serves the marketplace "tools" again
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
