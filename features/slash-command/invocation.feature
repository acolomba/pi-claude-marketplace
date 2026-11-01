Feature: Slash command invocation

  Invoking a bridged command sends the model the command's body, with the
  typed arguments filled in as Claude Code fills them. A scripted model stands
  in for a real one, and a local marketplace for a published one.

  Scenario: Invoking a command sends the model its body with the typed arguments
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the slash command "greet" described as "Greets a person by name." with this body:
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
      | call | role | text                                                       |
      | 1    | user | Greet the person named in the arguments.\n\nARGUMENTS: Ada |

  Scenario Outline: Arguments fill a command's placeholders as Claude Code fills them
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the slash command "fill" with this command file:
      """
      ---
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
    When the user prompts "/demo:fill <arguments>"
    Then the model receives these calls:
      | call | role | text       |
      | 1    | user | <received> |

    Examples:
      | placeholder   | body                     | arguments      | received                          |
      | named         | Hello $name from $place. | Ada 'New York' | Hello Ada from New York.          |
      | positional    | $0 and $1                | Ada Grace      | Ada and Grace                     |
      | indexed       | Second: $ARGUMENTS[1]    | Ada Grace      | Second: Grace                     |
      | missing index | Third: $2                | Ada Grace      | Third: $2\n\nARGUMENTS: Ada Grace |
      | raw           | All: $ARGUMENTS          | Ada 'New York' | All: Ada 'New York'               |
      | no arguments  | Deploy $ARGUMENTS now    |                | Deploy  now                       |

  Scenario: A command's session id and effort are filled in when it runs
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the slash command "session" with this command file:
      """
      ---
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
    When the user prompts "/demo:session"
    Then the model receives these calls:
      | call | role | text                          |
      | 1    | user | Session {uuid} at effort low. |

  Scenario: A command's path variables keep the values install gave them
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the slash command "paths" with this command file:
      """
      ---
      description: Reports the paths.
      ---

      Root ${CLAUDE_PLUGIN_ROOT}, data ${CLAUDE_PLUGIN_DATA}, project ${CLAUDE_PROJECT_DIR}.
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply  |
      | Noted. |
    When the user prompts "/demo:paths"
    Then the model receives these calls:
      | call | role | text                                                                                                                                    |
      | 1    | user | Root {home}/marketplaces/fixtures/plugins/demo, data {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo, project {project dir}. |

  Scenario: A slash command the user wrote keeps pi's own argument expansion
    Given pi runs with the scripted model
    Given the user's pi directory has the slash command "mine" with this command file:
      """
      First: $1. All: $ARGUMENTS.
      """
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply  |
      | Noted. |
    When the user prompts "/mine Ada Grace"
    Then the model receives these calls:
      | call | role | text                        |
      | 1    | user | First: Ada. All: Ada Grace. |
