Feature: Skill invocation

  Invoking a bridged skill sends the model the skill's body in Pi's skill
  block, with the typed arguments filled in as Claude Code fills them. A
  scripted model stands in for a real one, and a local marketplace for a
  published one.

  Scenario: Invoking a skill sends the model its body in a skill block
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the skill "greet" described as "Greets a person by name." with this body:
      """
      Greet the person named in the arguments.
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply       |
      | Hello, Ada. |
    When the user prompts "/skill:demo-greet Ada"
    Then the model receives these calls:
      | call | role | text                                                                                                                                                                                                                                                                                       |
      | 1    | user | <skill name="demo-greet" location="{project dir}/.pi/pi-claude-marketplace/resources/skills/demo-greet/SKILL.md">\nReferences are relative to {project dir}/.pi/pi-claude-marketplace/resources/skills/demo-greet.\n\nGreet the person named in the arguments.\n\nARGUMENTS: Ada\n</skill> |

  Scenario: Invoking a skill with the companions loaded sends the model the same skill block
    Given pi runs with the scripted model and these companions:
      | companion            |
      | pi-subagents         |
      | pi-mcp-adapter       |
      | pi-dynamic-workflows |
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the skill "greet" described as "Greets a person by name." with this body:
      """
      Greet the person named in the arguments.
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply       |
      | Hello, Ada. |
    When the user prompts "/skill:demo-greet Ada"
    Then the model receives these calls:
      | call | role | text                                                                                                                                                                                                                                                                                       |
      | 1    | user | <skill name="demo-greet" location="{project dir}/.pi/pi-claude-marketplace/resources/skills/demo-greet/SKILL.md">\nReferences are relative to {project dir}/.pi/pi-claude-marketplace/resources/skills/demo-greet.\n\nGreet the person named in the arguments.\n\nARGUMENTS: Ada\n</skill> |
