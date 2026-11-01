Feature: Skill aliases

  Protects the names a user can type for a bridged skill: Claude Code's names for it, over
  RPC and in the terminal UI. A local marketplace stands in for a published one, and a
  scripted model for a real one.

  Scenario Outline: Each name Claude Code gives a skill sends it to the model
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the skill "review" with this skill file:
      """
      ---
      name: fancy
      description: Reviews a change.
      ---

      Review the change.
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply  |
      | Noted. |
    When the user prompts "<typed name> Ada"
    Then the model receives these calls:
      | call | role | text                                                                                                                                                                                                                                                                  |
      | 1    | user | <skill name="demo-review" location="{project dir}/.pi/pi-claude-marketplace/resources/skills/demo-review/SKILL.md">\nReferences are relative to {project dir}/.pi/pi-claude-marketplace/resources/skills/demo-review.\n\nReview the change.\n\nARGUMENTS: Ada\n</skill> |

    Examples:
      | typed name   |
      | /demo:review |
      | /demo:fancy  |
      | /fancy       |
