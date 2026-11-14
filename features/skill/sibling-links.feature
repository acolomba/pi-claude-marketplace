Feature: Skill sibling links

  Protects relative links between the skills of one plugin: a link from a staged skill to a
  sibling skill reaches the folder the sibling is staged in. A local marketplace stands in for a
  published one, and a scripted model for a real one.

  Scenario: A link from a skill to a file of a sibling skill reaches the model as a path that holds the file
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the skill "a" described as "Skill a." with this body:
      """
      See ../b/ref.md.
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the skill "b" described as "Skill b." with this body:
      """
      Skill b body.
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file "skills/b/ref.md" with this text:
      """
      The reference of skill b.
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply  | tool | arguments                                                                                   |
      |        | read | {"path":"{project dir}/.pi/pi-claude-marketplace/resources/skills/demo-a/../demo-b/ref.md"} |
      | Noted. |      |                                                                                             |
    When the user prompts "/demo:a"
    Then the model receives these calls:
      | call | role        | text                                                                                                                                                                                                                                      |
      | 1    | user        | <skill name="demo-a" location="{project dir}/.pi/pi-claude-marketplace/resources/skills/demo-a/SKILL.md">\nReferences are relative to {project dir}/.pi/pi-claude-marketplace/resources/skills/demo-a.\n\nSee ../demo-b/ref.md.\n</skill> |
      | 2    | user        | <skill name="demo-a" location="{project dir}/.pi/pi-claude-marketplace/resources/skills/demo-a/SKILL.md">\nReferences are relative to {project dir}/.pi/pi-claude-marketplace/resources/skills/demo-a.\n\nSee ../demo-b/ref.md.\n</skill> |
      | 2    | assistant   | tool call read {"path":"{project dir}/.pi/pi-claude-marketplace/resources/skills/demo-a/../demo-b/ref.md"}                                                                                                                                |
      | 2    | tool result | read returned: The reference of skill b.                                                                                                                                                                                                  |
