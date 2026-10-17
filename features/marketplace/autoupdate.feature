Feature: Marketplace autoupdate

  Autoupdate turns automatic updates on and off for an added marketplace, and a
  scope's two configuration files combine the setting. The scenarios run the real
  extension in a headless Pi and use local marketplaces in place of published ones.

  Scenario: A local declaration without autoupdate takes the setting from the shared declaration
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin marketplace autoupdate tools --scope project"
    Given the user has run "/claude:plugin marketplace add {home}/marketplaces/tools --scope project --local"
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
      | tools | project | true               | {scenario time}         |
    Then the "claude-plugins.local.json" file of the project scope declares these marketplaces:
      | name  | source                    |
      | tools | {home}/marketplaces/tools |

  Scenario: Enabling autoupdate without --local on a marketplace added with --local fails as marketplace declared locally
    Given the marketplace "tools" is published as a dir source
    Given the user has run "/claude:plugin marketplace add {home}/marketplaces/tools --scope project --local"
    When the user runs "/claude:plugin marketplace autoupdate tools --scope project"
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

  Scenario: Disabling autoupdate with --local on a marketplace only the shared configuration declares fails as marketplace declared in shared config
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" is added to the project scope
    When the user runs "/claude:plugin marketplace noautoupdate tools --scope project --local"
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

  Scenario: Enabling autoupdate without a scope changes only the scopes whose shared configuration declares the marketplace
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" is added to the user scope
    Given the user has run "/claude:plugin marketplace add {home}/marketplaces/tools --scope project --local"
    When the user runs "/claude:plugin marketplace autoupdate tools"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope | status             |
      | tools | user  | autoupdate enabled |
    Then the "claude-plugins.json" file of the user scope declares these marketplaces:
      | name  | source                    | autoupdate |
      | tools | {home}/marketplaces/tools | true       |
    Then the "claude-plugins.local.json" file of the project scope declares these marketplaces:
      | name  | source                    |
      | tools | {home}/marketplaces/tools |
    Then the "claude-plugins.json" file of the project scope does not exist
