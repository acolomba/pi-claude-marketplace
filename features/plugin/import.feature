Feature: Plugin import

  Import brings the extra known marketplaces and the enabled plugins of a
  Claude Code settings file into a scope. The settings file lives in the
  sandbox, and a local marketplace stands in for a published one.

  Background:
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |

  Scenario: Importing the user's claude code settings adds their marketplace and installs their enabled plugin
    Given the claude code settings file of the user scope holds this text:
      """
      {
        "enabledPlugins": { "demo@fixtures": true },
        "extraKnownMarketplaces": {
          "fixtures": {
            "source": { "source": "directory", "path": "{home}/marketplaces/fixtures" }
          }
        }
      }
      """
    When the user runs "/claude:plugin import --scope user"
    Then the result has these fields:
      | kind                | cascade |
      | severity            | info    |
      | needs reload        | true    |
      | tally label         | Import  |
      | tally failures      | 0       |
      | tally warnings      | 0       |
      | tally success count | 2       |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace status | id            | name | status    | reasons | scope |
      | fixtures         | user              | added              | demo@fixtures | demo | installed |         | user  |
    Then the "claude-plugins.json" file of the user scope declares these marketplaces:
      | name     | source                       |
      | fixtures | {home}/marketplaces/fixtures |
    Then the "claude-plugins.json" file of the user scope declares these plugins:
      | id            |
      | demo@fixtures |
    When the user starts a new pi session
    Then the session offers these skills:
      | command           | description            |
      | /skill:demo-skill | A skill of demo 1.0.0. |

  Scenario: Importing the project's claude code settings adds their marketplace and installs their enabled plugin in the project scope
    Given the claude code settings file of the project scope holds this text:
      """
      {
        "enabledPlugins": { "demo@fixtures": true },
        "extraKnownMarketplaces": {
          "fixtures": {
            "source": { "source": "directory", "path": "{home}/marketplaces/fixtures" }
          }
        }
      }
      """
    When the user runs "/claude:plugin import --scope project"
    Then the result has these fields:
      | kind                | cascade |
      | severity            | info    |
      | needs reload        | true    |
      | tally label         | Import  |
      | tally failures      | 0       |
      | tally warnings      | 0       |
      | tally success count | 2       |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace status | id            | name | status    | reasons | scope   |
      | fixtures         | project           | added              | demo@fixtures | demo | installed |         | project |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name     | source                       |
      | fixtures | {home}/marketplaces/fixtures |
    Then the "claude-plugins.json" file of the project scope declares these plugins:
      | id            |
      | demo@fixtures |
    When the user starts a new pi session
    Then the session offers these skills:
      | command           | description            |
      | /skill:demo-skill | A skill of demo 1.0.0. |
