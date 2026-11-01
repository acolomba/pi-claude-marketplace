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

  Scenario: A context command in a skill runs before the model sees the skill
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the skill "status" described as "Reports the status." with this body:
      """
      Status: !`printf ok`
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply  |
      | Noted. |
    When the user prompts "/skill:demo-status"
    Then the model receives these calls:
      | call | role | text                                                                                                                                                                                                                                          |
      | 1    | user | <skill name="demo-status" location="{project dir}/.pi/pi-claude-marketplace/resources/skills/demo-status/SKILL.md">\nReferences are relative to {project dir}/.pi/pi-claude-marketplace/resources/skills/demo-status.\n\nStatus: ok\n</skill> |

  Scenario: A failing context command stops the skill and reports Claude Code's message
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the skill "check" described as "Checks the build." with this body:
      """
      Check: !`printf partial; exit 3`
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    When the user runs "/skill:demo-check"
    Then the result has these fields:
      | kind         | usage-error                                                           |
      | severity     | error                                                                 |
      | needs reload | false                                                                 |
      | message      | Shell command failed for pattern "!`printf partial; exit 3`": partial |
      | usage        |                                                                       |

  Scenario: An argument that starts with an exclamation mark reaches the model escaped and runs nothing
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the skill "echo" described as "Echoes the arguments." with this body:
      """
      Echo: $ARGUMENTS
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply  |
      | Noted. |
    When the user prompts '/skill:demo-echo !`printf pwned`'
    Then the model receives these calls:
      | call | role | text                                                                                                                                                                                                                                                  |
      | 1    | user | <skill name="demo-echo" location="{project dir}/.pi/pi-claude-marketplace/resources/skills/demo-echo/SKILL.md">\nReferences are relative to {project dir}/.pi/pi-claude-marketplace/resources/skills/demo-echo.\n\nEcho: \\! `printf pwned`\n</skill> |

  Scenario Outline: Arguments fill a skill's placeholders as Claude Code fills them
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the skill "fill" with this skill file:
      """
      ---
      name: fill
      description: Fills its placeholders.
      arguments: [name, place]
      ---

      <body>
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply  |
      | Noted. |
    When the user prompts "/skill:demo-fill <arguments>"
    Then the model receives these calls:
      | call | role | text                                                                                                                                                                                                                                    |
      | 1    | user | <skill name="demo-fill" location="{project dir}/.pi/pi-claude-marketplace/resources/skills/demo-fill/SKILL.md">\nReferences are relative to {project dir}/.pi/pi-claude-marketplace/resources/skills/demo-fill.\n\n<received>\n</skill> |

    Examples:
      | placeholder   | body                     | arguments      | received                          |
      | named         | Hello $name from $place. | Ada 'New York' | Hello Ada from New York.          |
      | positional    | $0 and $1                | Ada Grace      | Ada and Grace                     |
      | indexed       | Second: $ARGUMENTS[1]    | Ada Grace      | Second: Grace                     |
      | missing index | Third: $2                | Ada Grace      | Third: $2\n\nARGUMENTS: Ada Grace |
      | raw           | All: $ARGUMENTS          | Ada 'New York' | All: Ada 'New York'               |

  Scenario: A skill's session id and effort are filled in when it runs
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the skill "session" with this skill file:
      """
      ---
      name: session
      description: Reports the session.
      ---

      Session ${CLAUDE_SESSION_ID} at effort ${CLAUDE_EFFORT}.
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply  |
      | Noted. |
    When the user prompts "/skill:demo-session"
    Then the model receives these calls:
      | call | role | text                                                                                                                                                                                                                                                                |
      | 1    | user | <skill name="demo-session" location="{project dir}/.pi/pi-claude-marketplace/resources/skills/demo-session/SKILL.md">\nReferences are relative to {project dir}/.pi/pi-claude-marketplace/resources/skills/demo-session.\n\nSession {uuid} at effort low.\n</skill> |

  Scenario: Invoking a skill through its plugin-qualified name over RPC sends the same skill block
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
    When the user prompts "/demo:greet Ada"
    Then the model receives these calls:
      | call | role | text                                                                                                                                                                                                                                                                                       |
      | 1    | user | <skill name="demo-greet" location="{project dir}/.pi/pi-claude-marketplace/resources/skills/demo-greet/SKILL.md">\nReferences are relative to {project dir}/.pi/pi-claude-marketplace/resources/skills/demo-greet.\n\nGreet the person named in the arguments.\n\nARGUMENTS: Ada\n</skill> |
