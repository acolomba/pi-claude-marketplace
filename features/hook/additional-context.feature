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
      | reply | tool | arguments                                 |
      |       | bash | {"command": "sleep 3 && echo from-model"} |
      | Done. |      |                                           |
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
      | reply | tool | arguments                                 |
      |       | bash | {"command": "sleep 3 && echo from-model"} |
      |       | bash | {"command": "echo again"}                 |
      | Done. |      |                                           |
      | Hi.   |      |                                           |
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

  Scenario: A prompt hook's context over 10,000 characters reaches the model as a saved file and a preview
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name | event            | matcher | form   | output                                                                          | output bytes | trailing output |
      | big  | UserPromptSubmit |         | script | {"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":" | 12000        | "}}             |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply | tool | arguments |
      | Done. |      |           |
    When the user prompts "hello there"
    Then the model receives these saved hook outputs:
      | label                                    | size   | path                                                                                               | preview characters | saved characters |
      | UserPromptSubmit hook additional context | 11.7KB | {project dir}/.pi/pi-claude-marketplace/data/_shared/hook-output/hook-{uuid}-additionalContext.txt | 2000               | 12000            |

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
      | 1    | user | SessionStart hook additional context: ss-ctx |
      | 1    | user | hello there                                  |

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
      | 1    | user | SessionStart hook additional context: ss-ctx |
      | 1    | user | hello there                                  |

  Scenario: Session start context reaches the model before the prompt, and prompt hook context after it
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
      | call | role | text                                                    |
      | 1    | user | SessionStart hook additional context: ss-ctx            |
      | 1    | user | hello there                                             |
      | 1    | user | UserPromptSubmit hook additional context: ctx-from-hook |

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
      | 2    | user      | SessionStart hook additional context: ss-ctx |
      | 2    | user      | first prompt                                 |
      | 2    | assistant | First.                                       |
      | 2    | user      | second prompt                                |

  Scenario: Reloading pi before the first prompt keeps the session start hook's additional context for the first prompt
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
    Given the scripted model plays these steps:
      | reply | tool | arguments |
      | Done. |      |           |
    When the user starts pi in the terminal with the scripted model and the hooks recording
    Then the hooks record these runs:
      | event        | session | source  | model  | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_ENV_FILE                                                           | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | SessionStart | first   | startup | faux-1 | {project dir} |                 | primer    | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | {project dir}/.pi/pi-claude-marketplace/data/_shared/claude-env-first.env | first                  | first             | 1          |
    When the user reloads pi in the terminal and then prompts "hello there"
    Then the model receives these calls:
      | call | role | text                                         |
      | 1    | user | SessionStart hook additional context: ss-ctx |
      | 1    | user | hello there                                  |

  Scenario: A fork at the first prompt keeps one copy of the session start hook's additional context
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
      | reply  |
      | Hello. |
      | Done.  |
    Given the user has prompted "hello"
    Given the user has forked the session at its first prompt
    When the user prompts "hello again"
    Then the model receives these calls:
      | call | role | text                                         |
      | 2    | user | SessionStart hook additional context: ss-ctx |
      | 2    | user | hello again                                  |

  Scenario: A continued session keeps one copy of the session start hook's additional context
    Given pi runs with the scripted model and saves its session
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
      | reply  |
      | Hello. |
      | Done.  |
    Given the user has prompted "first prompt"
    Given the user has started pi again and continued the last session
    When the user prompts "second prompt"
    Then the model receives these calls:
      | call | role      | text                                         |
      | 2    | user      | SessionStart hook additional context: ss-ctx |
      | 2    | user      | first prompt                                 |
      | 2    | assistant | Hello.                                       |
      | 2    | user      | second prompt                                |

  Scenario: A continued session adds only the session start context that changed
    Given pi runs with the scripted model and saves its session
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name    | event        | matcher | form   | output                                                                                   |
      | primer  | SessionStart |         | script | {"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"ss-ctx"}}     |
      | notes   | SessionStart |         | script | {"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"notes-ctx"}}  |
      | refresh | SessionStart | resume  | script | {"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"resume-ctx"}} |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply  |
      | Hello. |
      | Done.  |
    Given the user has prompted "first prompt"
    Given the user has started pi again and continued the last session
    When the user prompts "second prompt"
    Then the model receives these calls:
      | call | role      | text                                                    |
      | 2    | user      | SessionStart hook additional context: ss-ctx\nnotes-ctx |
      | 2    | user      | first prompt                                            |
      | 2    | assistant | Hello.                                                  |
      | 2    | user      | SessionStart hook additional context: resume-ctx        |
      | 2    | user      | second prompt                                           |

  Scenario: A new session carries no session start context or history of the session before
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
      | reply  |
      | Hello. |
      | Done.  |
    Given the user has prompted "first prompt"
    Given the user has started a new pi session
    When the user prompts "second prompt"
    Then the model receives these calls:
      | call | role | text                                         |
      | 2    | user | SessionStart hook additional context: ss-ctx |
      | 2    | user | second prompt                                |

  Scenario: A resumed session carries nothing from the session the user left
    Given pi runs with the scripted model and saves its session
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name    | event        | matcher | form   | output                                                                              |
      | primer  | SessionStart | clear   | script | {"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"a-ctx"}} |
      | other   | SessionStart | startup | script | {"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"b-ctx"}} |
      | refresh | SessionStart | resume  | script | {"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"a-ctx"}} |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply  |
      | Hello. |
      | Hi.    |
      | Done.  |
    Given the user has prompted "a prompt"
    Given the user has started pi again in a new session
    Given the user has prompted "b prompt"
    Given the user has resumed the session of the prompt "a prompt"
    When the user prompts "again"
    Then the model call 3 receives these messages:
      | role      | text                                        |
      | user      | SessionStart hook additional context: a-ctx |
      | user      | a prompt                                    |
      | assistant | Hello.                                      |
      | user      | again                                       |

  Scenario: A continued session keeps one copy of a session start context saved to a file
    Given pi runs with the scripted model and saves its session
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name | event        | matcher | form   | output                                                                      | output bytes | trailing output |
      | big  | SessionStart |         | script | {"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":" | 12000        | "}}             |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply  |
      | Hello. |
      | Done.  |
    Given the user has prompted "first prompt"
    Given the user has started pi again and continued the last session
    When the user prompts "second prompt"
    Then the model receives these saved hook outputs:
      | label                                | size   | path                                                                                               | preview characters | saved characters |
      | SessionStart hook additional context | 11.7KB | {project dir}/.pi/pi-claude-marketplace/data/_shared/hook-output/hook-{uuid}-additionalContext.txt | 2000               | 12000            |

  Scenario: A continued session sends the session start context again after a compaction summarized it away
    Given pi keeps only one recent token when the hooks session compacts
    Given pi runs with the scripted model and saves its session
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name    | event        | matcher | form   | output                                                                               |
      | primer  | SessionStart | clear   | script | {"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"ss-ctx"}} |
      | refresh | SessionStart | resume  | script | {"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"ss-ctx"}} |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply      |
      | Hello.     |
      | Summary A. |
      | Summary B. |
      | Done.      |
    Given the user has prompted "first prompt"
    Given the user has compacted the session with the hooks recording
    Given the user has started pi again and continued the last session
    When the user prompts "second prompt"
    Then the model call 4 receives these messages:
      | role      | text                                                                                                                                                                             |
      | user      | The conversation history before this point was compacted into the following summary:\n\n<summary>\nSummary A.\n\n---\n\n**Turn Context (split turn):**\n\nSummary B.\n</summary> |
      | assistant | Hello.                                                                                                                                                                           |
      | user      | SessionStart hook additional context: ss-ctx                                                                                                                                     |
      | user      | second prompt                                                                                                                                                                    |

  Scenario: A manual compaction puts the session start hook's compact context after the summary
    Given pi keeps only one recent token when the hooks session compacts
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name  | event        | matcher | form   | output                                                                                    |
      | recap | SessionStart | compact | script | {"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"compact-ctx"}} |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply      |
      | Hello.     |
      | Summary A. |
      | Next.      |
    Given the user has prompted "hello"
    Given the user has compacted the session with the hooks recording
    When the user prompts "next"
    Then the model receives these calls:
      | call | role      | text                                                                                                                                                                                    |
      | 3    | user      | The conversation history before this point was compacted into the following summary:\n\n<summary>\nNo prior history.\n\n---\n\n**Turn Context (split turn):**\n\nSummary A.\n</summary> |
      | 3    | assistant | Hello.                                                                                                                                                                                  |
      | 3    | user      | SessionStart hook additional context: compact-ctx                                                                                                                                       |
      | 3    | user      | next                                                                                                                                                                                    |

  Scenario: A compaction after a turn that fills the context window keeps the compact context for the next prompt
    Given pi keeps only one recent token when the hooks session compacts
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name  | event        | matcher | form   | output                                                                                    |
      | recap | SessionStart | compact | script | {"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"compact-ctx"}} |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply      | context tokens |
      | Hello.     | 120000         |
      | Summary A. |                |
      | Next.      |                |
    Given the user has prompted "hello"
    When the user prompts "next"
    Then the model receives these calls:
      | call | role      | text                                                                                                                                                                                    |
      | 3    | user      | The conversation history before this point was compacted into the following summary:\n\n<summary>\nNo prior history.\n\n---\n\n**Turn Context (split turn):**\n\nSummary A.\n</summary> |
      | 3    | assistant | Hello.                                                                                                                                                                                  |
      | 3    | user      | SessionStart hook additional context: compact-ctx                                                                                                                                       |
      | 3    | user      | next                                                                                                                                                                                    |

  Scenario: A compaction in the middle of a run gives the compact context to the next model call
    Given pi keeps only one recent token when the hooks session compacts
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name  | event        | matcher | form   | output                                                                                    |
      | recap | SessionStart | compact | script | {"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"compact-ctx"}} |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply      | tool | arguments                      | context tokens |
      |            | bash | {"command": "echo from-model"} | 120000         |
      | Summary A. |      |                                |                |
      | Done.      |      |                                |                |
    When the user prompts "hello"
    Then the model call 3 receives these messages:
      | role        | text                                                                                                                                                                                    |
      | user        | The conversation history before this point was compacted into the following summary:\n\n<summary>\nNo prior history.\n\n---\n\n**Turn Context (split turn):**\n\nSummary A.\n</summary> |
      | assistant   | tool call bash {"command":"echo from-model"}                                                                                                                                            |
      | tool result | bash returned: from-model\n                                                                                                                                                             |
      | user        | SessionStart hook additional context: compact-ctx                                                                                                                                       |

  Scenario: A compaction before a queued follow-up's turn keeps the compact context without another model call
    Given pi keeps only one recent token when the hooks session compacts
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name  | event        | matcher | form   | output                                                                                    |
      | recap | SessionStart | compact | script | {"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"compact-ctx"}} |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply      | tool | arguments                                 | context tokens |
      |            | bash | {"command": "sleep 3 && echo from-model"} |                |
      | Done.      |      |                                           | 120000         |
      | Summary A. |      |                                           |                |
      | Hi.        |      |                                           |                |
      | Next.      |      |                                           |                |
    When the user prompts "run the echo" and follows up with "also say hi" while the tool runs
    Then the model call 4 receives these messages:
      | role      | text                                                                                                                                                                                    |
      | user      | The conversation history before this point was compacted into the following summary:\n\n<summary>\nNo prior history.\n\n---\n\n**Turn Context (split turn):**\n\nSummary A.\n</summary> |
      | assistant | Done.                                                                                                                                                                                   |
      | user      | also say hi                                                                                                                                                                             |
    When the user prompts "next"
    Then the model call 5 receives these messages:
      | role      | text                                                                                                                                                                                    |
      | user      | The conversation history before this point was compacted into the following summary:\n\n<summary>\nNo prior history.\n\n---\n\n**Turn Context (split turn):**\n\nSummary A.\n</summary> |
      | assistant | Done.                                                                                                                                                                                   |
      | user      | also say hi                                                                                                                                                                             |
      | assistant | Hi.                                                                                                                                                                                     |
      | user      | SessionStart hook additional context: compact-ctx                                                                                                                                       |
      | user      | next                                                                                                                                                                                    |

  Scenario: The retry after an overflow compaction gives the compact context to the retried model call
    Given pi keeps only one recent token when the hooks session compacts
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name  | event        | matcher | form   | output                                                                                    |
      | recap | SessionStart | compact | script | {"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"compact-ctx"}} |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply      | error                                              |
      | Hello.     |                                                    |
      |            | prompt is too long: 200000 tokens > 128000 maximum |
      | Summary A. |                                                    |
      | Summary B. |                                                    |
      | Retried.   |                                                    |
    Given the user has prompted "hello"
    When the user prompts "again"
    Then the model call 5 receives these messages:
      | role | text                                                                                                                                                                             |
      | user | The conversation history before this point was compacted into the following summary:\n\n<summary>\nSummary A.\n\n---\n\n**Turn Context (split turn):**\n\nSummary B.\n</summary> |
      | user | SessionStart hook additional context: compact-ctx                                                                                                                                |
