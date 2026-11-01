Feature: Hook lifecycle

  Each plugin verb changes which hooks of a bridged plugin run in a new session. A hook that
  records each run stands in for a plugin's hook, a scripted model for a real one, and a local
  marketplace for a published one.

  Background:
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name  | event      | matcher |
      | guard | PreToolUse | Bash    |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"

  Scenario: Disabling a plugin stops its hooks
    Given the user has run "/claude:plugin disable demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply | tool | arguments                      |
      |       | bash | {"command": "echo from-model"} |
      | Done. |      |                                |
    When the user prompts "run the echo"
    Then the hooks record no runs
