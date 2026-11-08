Feature: Hook compaction

  A compaction that Pi starts on its own runs the PostCompact hooks of a bridged plugin with trigger auto.
  A scripted model stands in for a real one: it reports its context usage and answers the summary call. A
  local marketplace stands in for a published one.

  Scenario: A turn that fills the context window runs PostCompact with trigger auto
    Given pi keeps only one recent token when the hooks session compacts
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name | event       | matcher |
      | post | PostCompact | *       |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply      | context tokens |
      | Hello.     | 120000         |
      | Summary A. |                |
    When the user prompts "hello"
    Then the hooks record these runs:
      | event       | session | trigger | compact summary                                                          | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PostCompact | first   | auto    | No prior history.\n\n---\n\n**Turn Context (split turn):**\n\nSummary A. | {project dir} |                 | post      | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
