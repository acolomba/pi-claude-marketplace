Feature: Hook additional context

  A plugin's UserPromptSubmit and SessionStart hooks can add context for the
  model, and the prompt the user typed reaches the model unchanged. A scripted
  model stands in for a real one, and recording script hooks for the plugin's.

  Scenario: A prompt hook's additional context reaches the model beside the prompt
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name | event            | matcher | form   | output                                                                                          |
      | ctx  | UserPromptSubmit |         | script | {"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"ctx-from-hook"}} |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply | tool | arguments |
      | Done. |      |           |
    When the user prompts "hello there"
    Then the model receives these calls:
      | call | role | text                                                    |
      | 1    | user | hello there                                             |
      | 1    | user | UserPromptSubmit hook additional context: ctx-from-hook |

  Scenario: A prompt hook's plain output reaches the model as additional context
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name | event            | matcher | form   | output        |
      | ctx  | UserPromptSubmit |         | script | plain context |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply | tool | arguments |
      | Done. |      |           |
    When the user prompts "hello there"
    Then the model receives these calls:
      | call | role | text                                                    |
      | 1    | user | hello there                                             |
      | 1    | user | UserPromptSubmit hook additional context: plain context |

  Scenario: A prompt hook's additional context for a steer reaches the model on the turn that reads the steer
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name | event            | matcher | form   | output                                                                                          |
      | ctx  | UserPromptSubmit |         | script | {"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"ctx-from-hook"}} |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply | tool | arguments                                  |
      |       | bash | {"command": "sleep 3 && echo from-model"} |
      | Done. |      |                                            |
    When the user prompts "run the echo" and steers with "also say hi" while the tool runs
    Then the model receives these calls:
      | call | role        | text                                                    |
      | 1    | user        | run the echo                                            |
      | 1    | user        | UserPromptSubmit hook additional context: ctx-from-hook |
      | 2    | user        | run the echo                                            |
      | 2    | user        | UserPromptSubmit hook additional context: ctx-from-hook |
      | 2    | assistant   | tool call bash {"command":"sleep 3 && echo from-model"} |
      | 2    | tool result | bash returned: from-model\n                             |
      | 2    | user        | UserPromptSubmit hook additional context: ctx-from-hook |
      | 2    | user        | also say hi                                             |

  Scenario: A prompt hook's additional context for a follow-up reaches the model on the turn that reads the follow-up
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name | event            | matcher | form   | output                                                                                          |
      | ctx  | UserPromptSubmit |         | script | {"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"ctx-from-hook"}} |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply | tool | arguments                                  |
      |       | bash | {"command": "sleep 3 && echo from-model"} |
      |       | bash | {"command": "echo again"}                 |
      | Done. |      |                                            |
      | Hi.   |      |                                            |
    When the user prompts "run the echo" and follows up with "also say hi" while the tool runs
    Then the model receives these calls:
      | call | role        | text                                                    |
      | 1    | user        | run the echo                                            |
      | 1    | user        | UserPromptSubmit hook additional context: ctx-from-hook |
      | 2    | user        | run the echo                                            |
      | 2    | user        | UserPromptSubmit hook additional context: ctx-from-hook |
      | 2    | assistant   | tool call bash {"command":"sleep 3 && echo from-model"} |
      | 2    | tool result | bash returned: from-model\n                             |
      | 3    | user        | run the echo                                            |
      | 3    | user        | UserPromptSubmit hook additional context: ctx-from-hook |
      | 3    | assistant   | tool call bash {"command":"sleep 3 && echo from-model"} |
      | 3    | tool result | bash returned: from-model\n                             |
      | 3    | assistant   | tool call bash {"command":"echo again"}                 |
      | 3    | tool result | bash returned: again\n                                  |
      | 4    | user        | run the echo                                            |
      | 4    | user        | UserPromptSubmit hook additional context: ctx-from-hook |
      | 4    | assistant   | tool call bash {"command":"sleep 3 && echo from-model"} |
      | 4    | tool result | bash returned: from-model\n                             |
      | 4    | assistant   | tool call bash {"command":"echo again"}                 |
      | 4    | tool result | bash returned: again\n                                  |
      | 4    | assistant   | Done.                                                   |
      | 4    | user        | UserPromptSubmit hook additional context: ctx-from-hook |
      | 4    | user        | also say hi                                             |

  Scenario: A session start hook's additional context reaches the model on the first turn
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name   | event        | matcher | form   | output                                                                               |
      | primer | SessionStart |         | script | {"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"ss-ctx"}} |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply | tool | arguments |
      | Done. |      |           |
    When the user prompts "hello there"
    Then the model receives these calls:
      | call | role | text                                         |
      | 1    | user | hello there                                  |
      | 1    | user | SessionStart hook additional context: ss-ctx |

  Scenario: A session start hook's additional context reaches the model when another session start hook exits 2
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name   | event        | matcher | form   | exit code | stderr               | output                                                                               |
      | check  | SessionStart |         | script | 2         | startup check failed |                                                                                      |
      | primer | SessionStart |         | script |           |                      | {"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"ss-ctx"}} |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply | tool | arguments |
      | Done. |      |           |
    When the user prompts "hello there"
    Then the model receives these calls:
      | call | role | text                                         |
      | 1    | user | hello there                                  |
      | 1    | user | SessionStart hook additional context: ss-ctx |

  Scenario: Session start and prompt hook contexts reach the model in one message, session start first
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name   | event            | matcher | form   | output                                                                                          |
      | primer | SessionStart     |         | script | {"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"ss-ctx"}}            |
      | ctx    | UserPromptSubmit |         | script | {"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"ctx-from-hook"}} |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply | tool | arguments |
      | Done. |      |           |
    When the user prompts "hello there"
    Then the model receives these calls:
      | call | role | text                                                                                                 |
      | 1    | user | hello there                                                                                          |
      | 1    | user | SessionStart hook additional context: ss-ctx\nUserPromptSubmit hook additional context: ctx-from-hook |

  Scenario: A session start hook's additional context stays in the history of the next turn
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name   | event        | matcher | form   | output                                                                               |
      | primer | SessionStart |         | script | {"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"ss-ctx"}} |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply  | tool | arguments |
      | First. |      |           |
      | Done.  |      |           |
    Given the user has prompted "first prompt" with the hooks recording
    When the user prompts "second prompt"
    Then the model receives these calls:
      | call | role      | text                                         |
      | 2    | user      | first prompt                                 |
      | 2    | user      | SessionStart hook additional context: ss-ctx |
      | 2    | assistant | First.                                       |
      | 2    | user      | second prompt                                |
