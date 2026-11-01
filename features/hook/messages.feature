Feature: Hook messages

  What a plugin's hooks show the user is shown as Claude Code shows it and
  never reaches the model. A scripted model stands in for a real one, and a
  hook that records each run stands in for a plugin's hook.

  Scenario: A prompt hook's system message is shown to the user and not sent to the model
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name   | event            | matcher | form   | output                                 |
      | notice | UserPromptSubmit |         | script | {"systemMessage":"remember the tests"} |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply |
      | Done. |
    When the user prompts "hello"
    Then the hooks record these runs:
      | event            | session | prompt | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | UserPromptSubmit | first   | hello  | {project dir} |                 | notice    | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/demo | first                  | first             | 1          |
    Then the hooks show the user these messages:
      | severity | text                                      |
      | info     | UserPromptSubmit says: remember the tests |
    Then the model receives these calls:
      | call | role | text  |
      | 1    | user | hello |
