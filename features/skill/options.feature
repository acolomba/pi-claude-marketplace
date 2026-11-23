Feature: Skill options

  A skill's content shows a plugin option as the plugin's manifest declares
  it. A scripted model stands in for a real one, and a local marketplace for
  a published one.

  Scenario Outline: A typed skill shows a plugin option by what the manifest declares for it (PG-CORE-03)
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".claude-plugin/plugin.json" with this text:
      """
      {
        "name": "demo",
        "version": "1.0.0",
        "userConfig": {
          "mode": { "type": "string", "title": "Mode", "description": "The mode.", "default": "fast" },
          "token": { "type": "string", "title": "Token", "description": "The token.", "default": "abc123", "sensitive": true },
          "note": { "type": "string", "title": "Note", "description": "A note.", "required": false }
        }
      }
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the skill "options" with this skill file:
      """
      ---
      name: options
      description: Reports an option.
      ---

      Option <reference>.
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has reloaded pi
    Given the scripted model plays these steps:
      | reply  |
      | Noted. |
    When the user prompts "/skill:demo-options"
    Then the model receives these calls:
      | call | role | text                                                                                                                                                                                                                                                      |
      | 1    | user | <skill name="demo-options" location="{project dir}/.pi/pi-claude-marketplace/resources/skills/demo-options/SKILL.md">\nReferences are relative to {project dir}/.pi/pi-claude-marketplace/resources/skills/demo-options.\n\nOption <text sent>.\n</skill> |

    Examples:
      | reference            | text sent                                                 |
      | ${user_config.mode}  | fast                                                      |
      | ${user_config.token} | [sensitive option 'token' not available in skill content] |
      | ${user_config.note}  | ${user_config.note}                                       |

  Scenario: A skill of a plugin with no options keeps an option reference as written (D-PG10-21)
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the skill "options" with this skill file:
      """
      ---
      name: options
      description: Reports an option.
      ---

      Option ${user_config.mode}.
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has reloaded pi
    Given the scripted model plays these steps:
      | reply  |
      | Noted. |
    When the user prompts "/skill:demo-options"
    Then the model receives these calls:
      | call | role | text                                                                                                                                                                                                                                                              |
      | 1    | user | <skill name="demo-options" location="{project dir}/.pi/pi-claude-marketplace/resources/skills/demo-options/SKILL.md">\nReferences are relative to {project dir}/.pi/pi-claude-marketplace/resources/skills/demo-options.\n\nOption ${user_config.mode}.\n</skill> |

  Scenario: A reinstall writes a changed option default into the plugin's skill (D-PG10-13, D-PG10-15)
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".claude-plugin/plugin.json" with this text:
      """
      {
        "name": "demo",
        "version": "1.0.0",
        "userConfig": {
          "mode": { "type": "string", "title": "Mode", "description": "The mode.", "default": "fast" }
        }
      }
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the skill "options" with this skill file:
      """
      ---
      name: options
      description: Reports an option.
      ---

      Option ${user_config.mode}.
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".claude-plugin/plugin.json" with this text:
      """
      {
        "name": "demo",
        "version": "1.0.0",
        "userConfig": {
          "mode": { "type": "string", "title": "Mode", "description": "The mode.", "default": "slow" }
        }
      }
      """
    Given the user has run "/claude:plugin reinstall demo@fixtures --scope project"
    Given the user has reloaded pi
    Given the scripted model plays these steps:
      | reply  |
      | Noted. |
    When the user prompts "/skill:demo-options"
    Then the model receives these calls:
      | call | role | text                                                                                                                                                                                                                                               |
      | 1    | user | <skill name="demo-options" location="{project dir}/.pi/pi-claude-marketplace/resources/skills/demo-options/SKILL.md">\nReferences are relative to {project dir}/.pi/pi-claude-marketplace/resources/skills/demo-options.\n\nOption slow.\n</skill> |
