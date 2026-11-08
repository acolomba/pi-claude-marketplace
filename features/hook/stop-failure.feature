Feature: Hook stop failure

  A turn that ends in an error runs the StopFailure hooks of a bridged plugin with the error type Claude Code
  gives them. A scripted model stands in for the provider and ends the turn with a chosen error, and a local
  marketplace stands in for a published one.

  Scenario: A turn the model ends in an authentication error runs the StopFailure hook
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name    | event       | matcher |
      | failure | StopFailure | *       |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply | error                       |
      |       | Authentication failed (401) |
    When the user prompts "hello"
    Then the hooks record these runs:
      | event       | session | error                 | last assistant message      | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | StopFailure | first   | authentication_failed | Authentication failed (401) | {project dir} |                 | failure   | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
