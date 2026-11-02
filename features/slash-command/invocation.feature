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

  Scenario: A context command in a command runs before the model sees the command
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the slash command "status" described as "Reports the status." with this body:
      """
      Status: !`printf ok`
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply  |
      | Noted. |
    When the user prompts "/demo:status"
    Then the model receives these calls:
      | call | role | text       |
      | 1    | user | Status: ok |

  Scenario: A failing context command stops the command and reports Claude Code's message
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the slash command "check" described as "Checks the build." with this body:
      """
      Check: !`printf partial; exit 3`
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    When the user runs "/demo:check"
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
    Given the published plugin "demo" of the marketplace "fixtures" has the slash command "echo" described as "Echoes the arguments." with this body:
      """
      Echo: $ARGUMENTS
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply  |
      | Noted. |
    When the user prompts '/demo:echo !`printf pwned`'
    Then the model receives these calls:
      | call | role | text                     |
      | 1    | user | Echo: \\! `printf pwned` |

  Scenario: Invoking a command that an uninstall removed before a reload reports the missing file
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
    Given the user has run "/claude:plugin uninstall demo@fixtures --scope project"
    When the user runs "/demo:greet Ada"
    Then the result has these fields:
      | kind         | usage-error                                                                                                                                                                                               |
      | severity     | error                                                                                                                                                                                                     |
      | needs reload | false                                                                                                                                                                                                     |
      | message      | Cannot read the command /demo:greet: ENOENT: no such file or directory, open '{project dir}/.pi/pi-claude-marketplace/resources/prompts/demo:greet.md'. Run /reload to load the installed commands again. |
      | usage        |                                                                                                                                                                                                           |

  Scenario: A command whose body starts with another command sends that line to the model as it is
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the slash command "release" described as "Releases the branch." with this body:
      """
      /demo:deploy production
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the slash command "deploy" described as "Deploys the branch." with this body:
      """
      Deploy the branch to $ARGUMENTS.
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply  |
      | Noted. |
    When the user prompts "/demo:release"
    Then the model receives these calls:
      | call | role | text                                      |
      | 1    | user | {zero width space}/demo:deploy production |
