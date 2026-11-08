Feature: Hook async

  A plugin's async rewake hooks run in the background, wake the model or the
  user when they exit, and stop when Pi reloads or starts again after a crash.
  Waiting scripts stand in for slow hooks, a local marketplace for a published one.

  Scenario: An async rewake hook goes on running after the prompt that started it
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name | event            | matcher | form   | async rewake | waits | exit code | stderr  | rewake message           | rewake summary |
      | wake | UserPromptSubmit | *       | script | true         | true  | 2         | woke up | The hook woke the model. | wake finished  |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply |
      | Done. |
    When the user prompts "say done" and the hook "wake" goes on in the background
    Then the hooks record these runs:
      | event            | session | prompt   | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | UserPromptSubmit | first   | say done | {project dir} |                 | wake      | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the hook processes record these lifecycle events:
      | hook | phase | exit code |
      | wake | start |           |
    Then the model receives these calls:
      | call | role | text     |
      | 1    | user | say done |

  Scenario: An async rewake hook that exits 2 shows the user its summary
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name | event            | matcher | form   | async rewake | waits | exit code | stderr  | rewake message           | rewake summary |
      | wake | UserPromptSubmit | *       | script | true         | true  | 2         | woke up | The hook woke the model. | wake finished  |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply  |
      | Done.  |
      | Woke.  |
      | Noted. |
    Given the user has prompted "say done" and the hook "wake" goes on in the background
    When the user releases the hook "wake" with the hooks recording
    Then the hook processes record these lifecycle events:
      | hook | phase | exit code |
      | wake | end   | 2         |
    Then the hooks show the user these rewake summaries:
      | text          |
      | wake finished |
    Then the hooks record no runs
    When the user prompts "next" after the woken turn ends
    Then the model receives these calls:
      | call | role      | text                                     |
      | 3    | user      | say done                                 |
      | 3    | assistant | Done.                                    |
      | 3    | user      | The hook woke the model. woke up         |
      | 3    | assistant | Woke.                                    |
      | 3    | user      | next                                     |

  Scenario: An async rewake hook that exits 2 wakes the model with its message and its stderr
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name | event            | matcher | form   | async rewake | waits | exit code | stderr  | rewake message           | rewake summary |
      | wake | UserPromptSubmit | *       | script | true         | true  | 2         | woke up | The hook woke the model. | wake finished  |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply  |
      | Done.  |
      | Woke.  |
      | Noted. |
    Given the user has prompted "say done" and the hook "wake" goes on in the background
    Given the user has released the hook "wake"
    Given the model has answered the woken turn
    When the user prompts "next"
    Then the model receives these calls:
      | call | role      | text                                     |
      | 3    | user      | say done                                 |
      | 3    | assistant | Done.                                    |
      | 3    | user      | The hook woke the model. woke up         |
      | 3    | assistant | Woke.                                    |
      | 3    | user      | next                                     |

  Scenario: An async rewake hook with no message or summary wakes the model with the default texts
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name | event            | matcher | form   | async rewake | waits | exit code | output       |
      | wake | UserPromptSubmit | *       | script | true         | true  | 2         | tests failed |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply |
      | Done. |
      | Woke. |
    Given the user has prompted "say done" and the hook "wake" goes on in the background
    When the user releases the hook "wake" and it wakes the model
    Then the hooks show the user these rewake summaries:
      | text               |
      | Stop hook feedback |
    Then the model receives these calls:
      | call | role      | text                                                                    |
      | 2    | user      | say done                                                                |
      | 2    | assistant | Done.                                                                   |
      | 2    | user      | Stop hook blocking error from command "UserPromptSubmit": tests failed |

  Scenario: An async rewake hook that exits with another code shows nothing and adds nothing to the model's context
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name | event            | matcher | form   | async rewake | waits | exit code | stderr  | rewake message           | rewake summary |
      | wake | UserPromptSubmit | *       | script | true         | true  | 1         | woke up | The hook woke the model. | wake finished  |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply  |
      | Done.  |
      | Noted. |
    Given the user has prompted "say done" and the hook "wake" goes on in the background
    When the user releases the hook "wake" and pi handles its exit
    Then the hook processes record these lifecycle events:
      | hook | phase | exit code |
      | wake | end   | 1         |
    Then the hooks show the user no rewake summaries
    When the user prompts "next" and the hook "wake" goes on in the background
    Then the model receives these calls:
      | call | role      | text     |
      | 2    | user      | say done |
      | 2    | assistant | Done.    |
      | 2    | user      | next     |

  Scenario: A hook process that a dead Pi left stops when Pi starts again
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name | event            | matcher | form   | async rewake | waits | exit code | stderr  | rewake message           | rewake summary |
      | wake | UserPromptSubmit | *       | script | true         | true  | 2         | woke up | The hook woke the model. | wake finished  |
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply |
      | Done. |
    Given the user has prompted "say done" and the hook "wake" goes on in the background
    Given pi's process has died, leaving its hook processes running
    When the user starts pi again with the hooks recording
    Then no hook process is running
    Then the hooks record no runs
    Then the session reports no results

  Scenario: Reloading Pi stops its waiting hook processes
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name   | event            | matcher | form   | async rewake | waits | exit code | stderr     |
      | wake   | SessionStart     | startup | script | true         | true  |           |            |
      | marker | UserPromptSubmit |         | script |              |       | 2         | not needed |
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user has started pi in the terminal and the hook "wake" goes on in the background
    When the user reloads pi in the terminal and then prompts "after the reload" with the hooks recording
    Then the hooks record these runs:
      | event            | session | prompt           | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                   | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | UserPromptSubmit | first   | after the reload | {project dir} |                 | marker    | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {agent dir}/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then no hook process is running
