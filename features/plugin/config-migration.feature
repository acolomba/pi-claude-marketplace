Feature: Plugin config migration

  A user who upgrades from a release with no config gets one written from the installation
  records on the first load. An earlier release's installation record, and a config the user
  deleted, stand in for the upgrade, and a local marketplace stands in for a published one.

  Background:
    Given the marketplace "fixtures" is published as a dir source

  Scenario: The first load after an upgrade from release 0.4.3 writes the config from the records
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin marketplace autoupdate fixtures --scope user"
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user scope holds what release 0.4.3 left: its installation record and no config
    When the user starts a new pi session
    Then the session reports no results
    Then the "claude-plugins.json" file of the user scope declares these marketplaces:
      | name     | source                       | autoupdate |
      | fixtures | {home}/marketplaces/fixtures | true       |
    Then the "claude-plugins.json" file of the user scope declares these plugins:
      | id            |
      | demo@fixtures |

  Scenario: The first load after the user deleted the config writes it with a disabled plugin's enabled state
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user has run "/claude:plugin disable demo@fixtures --scope user"
    Given the user has deleted the config files of the user scope
    When the user starts a new pi session
    Then the session reports no results
    Then the "claude-plugins.json" file of the user scope declares these marketplaces:
      | name     | source                       |
      | fixtures | {home}/marketplaces/fixtures |
    Then the "claude-plugins.json" file of the user scope declares these plugins:
      | id            | enabled |
      | demo@fixtures | false   |
