Feature: Hook async

  A plugin's async rewake hooks run in the background and wake the model or
  the user when they exit. Hook scripts that wait for a release stand in for
  slow hooks, the scripted model for the model, and a local marketplace for a
  published one.

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

  Scenario: An async rewake hook shows the user its summary when it exits
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
    Given the user has prompted "say done" and the hook "wake" goes on in the background
    When the user releases the hook "wake" with the hooks recording
    Then the hook processes record these lifecycle events:
      | hook | phase | exit code |
      | wake | end   | 2         |
    Then the hooks show the user these rewake summaries:
      | text          |
      | wake finished |

  Scenario: An async rewake hook that exits 2 puts its message into the model's next call
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
      | Noted. |
    Given the user has prompted "say done" and the hook "wake" goes on in the background
    Given the user has released the hook "wake"
    When the user prompts "next"
    Then the model receives these calls:
      | call | role      | text                                |
      | 2    | user      | say done                            |
      | 2    | assistant | Done.                               |
      | 2    | user      | next                                |
      | 2    | user      | The hook woke the model.\n\nwoke up |
