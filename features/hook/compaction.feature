Feature: Hook compaction

  A compaction runs the PostCompact hooks of a bridged plugin with its trigger, and after /compact the user
  sees how each hook ended, as in Claude Code. A scripted model stands in for a real one: it reports its
  context usage and answers the summary call. A local marketplace stands in for a published one.

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

  Scenario: After a manual compaction one notice lists how each PostCompact hook ended
    Given pi keeps only one recent token when the hooks session compacts
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name    | event       | matcher | form        | arguments | output                                         | stderr    | exit code | timeout | sleep | on failure |
      | slow    | PostCompact | *       | script      |           |                                                |           |           | 1       | 3     |            |
      | saved   | PostCompact | *       | script      |           | notes saved                                    |           |           |         |       |            |
      | quiet   | PostCompact | *       | script      |           |                                                |           |           |         |       |            |
      | json    | PostCompact | *       | script      |           | {"systemMessage":"compacted","continue":false} |           |           |         |       |            |
      | broken  | PostCompact | *       | script      |           |                                                | disk full | 1         |         |       |            |
      | refused | PostCompact | *       | script      |           |                                                | not now   | 2         |         |       |            |
      | strict  | PostCompact | *       | script      |           |                                                | boom      | 1         |         |       | block      |
      | tagged  | PostCompact | *       | exec script | ["note"]  |                                                |           |           |         |       |            |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply      |
      | Hello.     |
      | Summary A. |
    Given the user has prompted "hello" with the hooks recording
    When the user compacts the session with the hooks recording
    Then the hooks show the user these messages:
      | severity | text |
      | info     | PostCompact [${CLAUDE_PLUGIN_ROOT}/hooks/slow.sh] failed: Hook cancelled\nPostCompact [${CLAUDE_PLUGIN_ROOT}/hooks/saved.sh] completed successfully: notes saved\nPostCompact [${CLAUDE_PLUGIN_ROOT}/hooks/quiet.sh] completed successfully\nPostCompact [${CLAUDE_PLUGIN_ROOT}/hooks/json.sh] completed successfully: {"systemMessage":"compacted","continue":false}\nPostCompact [${CLAUDE_PLUGIN_ROOT}/hooks/broken.sh] failed: disk full\nPostCompact [${CLAUDE_PLUGIN_ROOT}/hooks/refused.sh] failed: not now\nPostCompact [${CLAUDE_PLUGIN_ROOT}/hooks/strict.sh] failed: failed; blocking because onFailure is "block"\nboom\nPostCompact [${CLAUDE_PLUGIN_ROOT}/hooks/tagged.sh note] completed successfully |

  Scenario: An automatic compaction shows nothing for a PostCompact hook that exits 2
    Given pi keeps only one recent token when the hooks session compacts
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name    | event       | matcher | form   | stderr  | exit code |
      | refused | PostCompact | *       | script | not now | 2         |
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
      | PostCompact | first   | auto    | No prior history.\n\n---\n\n**Turn Context (split turn):**\n\nSummary A. | {project dir} |                 | refused   | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the hooks show the user no messages
