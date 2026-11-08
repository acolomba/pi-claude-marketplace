Feature: Plugin state migration

  A user who upgrades keeps every plugin an earlier release installed, and a record that a newer
  release wrote is refused and left as it was. Installation records rewritten in the shapes those
  releases persisted stand in for a real upgrade, and a local marketplace for a published one.

  Background:
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"

  Scenario: Pi lists the plugin of an installation record that release 0.6.0 wrote
    Given the installation record of the user scope is rewritten as release "0.6.0" wrote it
    When the user runs "/claude:plugin list --scope user"
    Then the result has these fields:
      | kind                | cascade     |
      | severity            | info        |
      | needs reload        | false       |
      | tally label         | Plugin list |
      | tally failures      | 0           |
      | tally warnings      | 0           |
      | tally success count | 1           |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope | version |
      | fixtures         | user              | demo@fixtures | demo | installed |         | user  | 1.0.0   |

  Scenario: Pi lists the plugin of an installation record that release 0.19.2 wrote
    Given the installation record of the user scope is rewritten as release "0.19.2" wrote it
    When the user runs "/claude:plugin list --scope user"
    Then the result has these fields:
      | kind                | cascade     |
      | severity            | info        |
      | needs reload        | false       |
      | tally label         | Plugin list |
      | tally failures      | 0           |
      | tally warnings      | 0           |
      | tally success count | 1           |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope | version |
      | fixtures         | user              | demo@fixtures | demo | installed |         | user  | 1.0.0   |

  Scenario: A newer installation record is refused and left as it was
    Given the installation record of the user scope is rewritten with a schema version this release does not read
    Given the config and installation record bytes of the user scope are remembered
    When the user runs "/claude:plugin list --scope user"
    Then the result has these fields:
      | kind           | cascade                        |
      | severity       | error                          |
      | needs reload   | false                          |
      | summary        | A plugin operation has failed. |
      | tally label    | Plugin list                    |
      | tally failures | 1                              |
      | tally warnings | 0                              |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name   | status | reasons    | scope | cause chain                                                                                 | cause truncated | leaks | rollback partial |
      | (list)           | user              | (list)@(list) | (list) | failed | unreadable | user  | state.json at {agent dir}/pi-claude-marketplace/state.json has an unsupported schema version | false           |       |                  |
    Then the config and installation record bytes of the user scope are unchanged
