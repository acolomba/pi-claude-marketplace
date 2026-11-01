Feature: Hook session

  The session hooks of a bridged plugin run on Pi's session events with the
  source or reason Claude Code gives them, and their matchers select on it.
  A scripted model stands in for a real one, and a hook that records each run
  stands in for a plugin's hook.

  Scenario: A new session runs SessionEnd with reason clear and SessionStart with source clear
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name          | event        | matcher |
      | session-end   | SessionEnd   | *       |
      | session-start | SessionStart | *       |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    When the user starts a new pi session with the hooks recording
    Then the hooks record these runs:
      | event        | session | reason | source | cwd           | transcript path | arguments     | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                | CLAUDE_ENV_FILE                                                      | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | SessionEnd   | first   | clear  |        | {project dir} |                 | session-end   | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/demo |                                                                      | first                  | first             | 1          |
      | SessionStart | second  |        | clear  | {project dir} |                 | session-start | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/demo | {project dir}/.pi/pi-claude-marketplace/data/_shared/claude-env-second.env | second                 | second            | 1          |

  Scenario: A clear matcher selects the SessionStart run of a new session
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name       | event        | matcher |
      | on-clear   | SessionStart | clear   |
      | on-startup | SessionStart | startup |
      | on-any     | SessionStart | *       |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    When the user starts a new pi session with the hooks recording
    Then the hooks record these runs in any order:
      | event        | session | source | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                | CLAUDE_ENV_FILE                                                     | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | SessionStart | first   | clear  | {project dir} |                 | on-clear  | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/demo | {project dir}/.pi/pi-claude-marketplace/data/_shared/claude-env-first.env | first                  | first             | 1          |
      | SessionStart | first   | clear  | {project dir} |                 | on-any    | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/demo | {project dir}/.pi/pi-claude-marketplace/data/_shared/claude-env-first.env | first                  | first             | 1          |

  Scenario: A SessionEnd matcher selects the run for its reason
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name      | event      | matcher |
      | end-clear | SessionEnd | clear   |
      | end-other | SessionEnd | other   |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    When the user starts a new pi session with the hooks recording
    Then the hooks record these runs:
      | event      | session | reason | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | SessionEnd | first   | clear  | {project dir} |                 | end-clear | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/demo | first                  | first             | 1          |
