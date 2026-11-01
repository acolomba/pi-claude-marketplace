Feature: Skill project autoapply

  A repository's own config cannot install its plugins and run their skills' context commands at load,
  even when it turns autoapply on, as Claude Code asks before it installs a plugin that repository
  settings name (D-CF2-14). A local marketplace and a scripted model stand in for published and real ones.

  Background:
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the skill "status" with this skill file:
      """
      ---
      name: fancy
      description: Reports the status.
      ---

      Status: !`printf ran`
      """
    Given a config in scope project and layer base, with this text:
      """
      { "autoapply": true }
      """
    Given a config in scope project and layer base, with these marketplaces:
      | name     | source                       | autoupdate |
      | fixtures | {home}/marketplaces/fixtures |            |
    Given a config in scope project and layer base, with these plugins:
      | marketplace | plugin | enabled |
      | fixtures    | demo   |         |

  Scenario: A skill of a plugin that only the repository's autoapply config declares runs no context command
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply  |
      | Noted. |
    When the user prompts "/skill:demo-status"
    Then the model receives these calls:
      | call | role | text               |
      | 1    | user | /skill:demo-status |

  Scenario: A skill of a plugin that the repository's config declares runs its context command after the user applies the config
    Given the user has run "/claude:plugin apply"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply  |
      | Noted. |
    When the user prompts "/skill:demo-status"
    Then the model receives these calls:
      | call | role | text                                                                                                                                                                                                                                           |
      | 1    | user | <skill name="demo-status" location="{project dir}/.pi/pi-claude-marketplace/resources/skills/demo-status/SKILL.md">\nReferences are relative to {project dir}/.pi/pi-claude-marketplace/resources/skills/demo-status.\n\nStatus: ran\n</skill> |
