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
