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
