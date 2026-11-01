Feature: Skill aliases

  Protects the names a user can type for a bridged skill: Claude Code's names for it, over
  RPC and in the terminal UI. A local marketplace stands in for a published one, and a
  scripted model for a real one.

  Background:
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |

  Scenario Outline: Each name Claude Code gives a skill sends it to the model
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

  Scenario: A bare frontmatter name two skills share goes to the first skill
    Given the published plugin "demo" of the marketplace "fixtures" has the skill "dupe-a" with this skill file:
      """
      ---
      name: same
      description: The first skill named same.
      ---

      First skill body.
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the skill "dupe-b" with this skill file:
      """
      ---
      name: same
      description: The second skill named same.
      ---

      Second skill body.
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply  |
      | Noted. |
    When the user prompts "/same Ada"
    Then the model receives these calls:
      | call | role | text                                                                                                                                                                                                                                                                 |
      | 1    | user | <skill name="demo-dupe-a" location="{project dir}/.pi/pi-claude-marketplace/resources/skills/demo-dupe-a/SKILL.md">\nReferences are relative to {project dir}/.pi/pi-claude-marketplace/resources/skills/demo-dupe-a.\n\nFirst skill body.\n\nARGUMENTS: Ada\n</skill> |

  Scenario: A plugin-qualified frontmatter name two skills share goes to the first skill
    Given the published plugin "demo" of the marketplace "fixtures" has the skill "dupe-a" with this skill file:
      """
      ---
      name: same
      description: The first skill named same.
      ---

      First skill body.
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the skill "dupe-b" with this skill file:
      """
      ---
      name: same
      description: The second skill named same.
      ---

      Second skill body.
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply  |
      | Noted. |
    When the user prompts "/demo:same Ada"
    Then the model receives these calls:
      | call | role | text                                                                                                                                                                                                                                                                 |
      | 1    | user | <skill name="demo-dupe-a" location="{project dir}/.pi/pi-claude-marketplace/resources/skills/demo-dupe-a/SKILL.md">\nReferences are relative to {project dir}/.pi/pi-claude-marketplace/resources/skills/demo-dupe-a.\n\nFirst skill body.\n\nARGUMENTS: Ada\n</skill> |

  Scenario: A skill no longer answers to the name its plugin prefix was cut from
    Given the published plugin "demo" of the marketplace "fixtures" has the skill "demo-tool" described as "Runs the tool." with this body:
      """
      Run the tool.
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply  |
      | Noted. |
    When the user prompts "/demo:tool Ada"
    Then the model receives these calls:
      | call | role | text           |
      | 1    | user | /demo:tool Ada |

  Scenario: A skill answers to its plugin and directory name
    Given the published plugin "demo" of the marketplace "fixtures" has the skill "demo-tool" described as "Runs the tool." with this body:
      """
      Run the tool.
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply  |
      | Noted. |
    When the user prompts "/demo:demo-tool Ada"
    Then the model receives these calls:
      | call | role | text                                                                                                                                                                                                                                                         |
      | 1    | user | <skill name="demo-tool" location="{project dir}/.pi/pi-claude-marketplace/resources/skills/demo-tool/SKILL.md">\nReferences are relative to {project dir}/.pi/pi-claude-marketplace/resources/skills/demo-tool.\n\nRun the tool.\n\nARGUMENTS: Ada\n</skill> |

  Scenario: A frontmatter name a command of the plugin has leaves the name to the command
    Given the published plugin "demo" of the marketplace "fixtures" has the skill "review" with this skill file:
      """
      ---
      name: clash
      description: Reviews a change.
      ---

      Review the change.
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file "commands/clash.md" with this text:
      """
      ---
      description: Clash command
      ---

      COMMAND CLASH BODY
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply      |
      | Clash ran. |
    When the user prompts "/demo:clash"
    Then the model receives these calls:
      | call | role | text               |
      | 1    | user | COMMAND CLASH BODY |

  Scenario: A name no skill claims reaches the model as typed
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
    When the user prompts "/demo:nothing Ada"
    Then the model receives these calls:
      | call | role | text              |
      | 1    | user | /demo:nothing Ada |

  Scenario: A disabled plugin's skill alias reaches the model as typed
    Given the published plugin "demo" of the marketplace "fixtures" has the skill "greet" described as "Greets a person by name." with this body:
      """
      Greet the person named in the arguments.
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has run "/claude:plugin disable demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply       |
      | Hello, Ada. |
    When the user prompts "/demo:greet Ada"
    Then the model receives these calls:
      | call | role | text            |
      | 1    | user | /demo:greet Ada |

  Scenario: Enabling the plugin again restores its skill alias
    Given the published plugin "demo" of the marketplace "fixtures" has the skill "greet" described as "Greets a person by name." with this body:
      """
      Greet the person named in the arguments.
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has run "/claude:plugin disable demo@fixtures --scope project"
    Given the user has run "/claude:plugin enable demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply       |
      | Hello, Ada. |
    When the user prompts "/demo:greet Ada"
    Then the model receives these calls:
      | call | role | text                                                                                                                                                                                                                                                                                       |
      | 1    | user | <skill name="demo-greet" location="{project dir}/.pi/pi-claude-marketplace/resources/skills/demo-greet/SKILL.md">\nReferences are relative to {project dir}/.pi/pi-claude-marketplace/resources/skills/demo-greet.\n\nGreet the person named in the arguments.\n\nARGUMENTS: Ada\n</skill> |
