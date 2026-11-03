Feature: Plugin project trust

  A plugin installed into a project Pi does not trust runs none of its commands or hooks there, as
  Claude Code loads no project-scope plugin before the workspace is trusted. The project holds a pi
  settings file, so Pi's trust store alone decides. A local marketplace, a scripted model, and a hook
  that records each run stand in for published and real ones.

  Background:
    Given the project holds a pi settings file
    Given pi runs with the scripted model in an untrusted project
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the slash command "check" with this command file:
      """
      ---
      name: probe
      description: Checks the status.
      ---

      Check: !`printf command-ran`
      """
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name       | event      | matcher |
      | bash-guard | PreToolUse | Bash    |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"

  Scenario: A project hook of an untrusted project does not run
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply | tool | arguments                      |
      |       | bash | {"command": "echo from-model"} |
      | Done. |      |                                |
    When the user prompts "run the echo"
    Then the hooks record no runs
    Then the model receives these calls:
      | call | role        | text                                         |
      | 1    | user        | run the echo                                 |
      | 2    | user        | run the echo                                 |
      | 2    | assistant   | tool call bash {"command":"echo from-model"} |
      | 2    | tool result | bash returned: from-model\n                  |

  Scenario: A project command of an untrusted project runs no context command and reaches the model as typed
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply  |
      | Noted. |
    When the user prompts "/demo:check"
    Then the model receives these calls:
      | call | role | text        |
      | 1    | user | /demo:check |

  Scenario: A project command alias of an untrusted project reaches the model as typed
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply  |
      | Noted. |
    When the user prompts "/probe now"
    Then the model receives these calls:
      | call | role | text       |
      | 1    | user | /probe now |

  Scenario: The model is offered no command tool for the commands of an untrusted project
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply  |
      | Hello. |
    When the user prompts "hello"
    Then the model receives these calls:
      | call | role | text  |
      | 1    | user | hello |
    Then the model calls are offered these marketplace tools:
      | call | tools                                                         |
      | 1    | pi_claude_marketplace_list, pi_claude_marketplace_plugin_list |
