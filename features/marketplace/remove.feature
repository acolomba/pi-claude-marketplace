Feature: Marketplace remove

  Removing a marketplace drops it from a scope, with its declaration and the
  plugins installed from it. The scenarios run the real extension in a headless
  Pi, read its JSON results, and use local marketplaces in place of published ones.

  Scenario: Removing a marketplace with --local clears only its local declaration
    Given the marketplace "base" is published as a dir source
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "extras" is published as a dir source
    Given the marketplace "base" is added to the project scope
    Given the user has run "/claude:plugin marketplace add {home}/marketplaces/tools --scope project --local"
    Given the user has run "/claude:plugin marketplace add {home}/marketplaces/extras --scope project --local"
    When the user runs "/claude:plugin marketplace remove tools --scope project --local"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope   | status  |
      | tools | project | removed |
    Then the "claude-plugins.local.json" file of the project scope declares these marketplaces:
      | name   | source                     |
      | extras | {home}/marketplaces/extras |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name | source                   |
      | base | {home}/marketplaces/base |

  Scenario: A marketplace removed with --local stays removed in a new session
    Given the marketplace "tools" is published as a dir source
    Given the user has run "/claude:plugin marketplace add {home}/marketplaces/tools --scope project --local"
    Given the user has started a new pi session
    Given the user has run "/claude:plugin marketplace remove tools --scope project --local"
    Given the user has started a new pi session
    When the user runs "/claude:plugin marketplace list"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists no marketplaces
    Then the "claude-plugins.json" file of the project scope does not exist
    Then the "claude-plugins.local.json" file of the project scope declares no marketplaces

  Scenario: Removing without --local a marketplace added with --local fails as marketplace declared locally
    Given the marketplace "tools" is published as a dir source
    Given the user has run "/claude:plugin marketplace add {home}/marketplaces/tools --scope project --local"
    When the user runs "/claude:plugin marketplace remove tools --scope project"
    Then the result has these fields:
      | kind         | cascade                      |
      | severity     | error                        |
      | needs reload | false                        |
      | summary      | Some operations have failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace status | id          | name  | status | reasons                      | scope   | cause chain                                                                                              | cause truncated | leaks | rollback partial |
      | tools            | project           | failed             | tools@tools | tools | failed | marketplace declared locally | project | The marketplace tools is declared only in claude-plugins.local.json. Run the command again with --local. | false           |       |                  |
    Then the "claude-plugins.local.json" file of the project scope declares these marketplaces:
      | name  | source                    |
      | tools | {home}/marketplaces/tools |
    Then the "claude-plugins.json" file of the project scope does not exist

  Scenario: Removing with --local a marketplace only the shared configuration declares fails as marketplace declared in shared config
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" is added to the project scope
    When the user runs "/claude:plugin marketplace remove tools --scope project --local"
    Then the result has these fields:
      | kind         | cascade                      |
      | severity     | error                        |
      | needs reload | false                        |
      | summary      | Some operations have failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace status | id          | name  | status | reasons                               | scope   | cause chain                                                                                           | cause truncated | leaks | rollback partial |
      | tools            | project           | failed             | tools@tools | tools | failed | marketplace declared in shared config | project | The marketplace tools is declared only in claude-plugins.json. Run the command again without --local. | false           |       |                  |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name  | source                    |
      | tools | {home}/marketplaces/tools |
    Then the "claude-plugins.local.json" file of the project scope does not exist
