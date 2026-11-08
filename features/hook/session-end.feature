Feature: Hook session end

  The SessionEnd hooks of a bridged plugin run on each way Pi ends a session, with the reason Claude Code
  gives, their matchers select on that reason, and a failing hook never keeps the session open. A scripted
  model, a hook that records each run, and a one-shot Pi in json mode stand in for a real session.

  Scenario: Resuming a saved session runs SessionEnd with reason resume and SessionStart with source resume
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name  | event        | matcher |
      | end   | SessionEnd   | *       |
      | start | SessionStart | *       |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the user has a saved pi session "saved" in the project
    When the user resumes the saved pi session "saved" with the hooks recording
    Then the hooks record these runs:
      | event        | session | reason | source | cwd           | transcript path                  | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_ENV_FILE                                                            | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | SessionEnd   | first   | resume |        | {project dir} |                                  | end       | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo |                                                                            | first                  | first             | 1          |
      | SessionStart | second  |        | resume | {project dir} | {agent dir}/sessions/saved.jsonl | start     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | {project dir}/.pi/pi-claude-marketplace/data/_shared/claude-env-second.env | second                 | second            | 1          |

  Scenario: A command in pi's json mode runs SessionStart with source startup and SessionEnd with reason other
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name  | event        | matcher |
      | start | SessionStart | *       |
      | end   | SessionEnd   | *       |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    When the user runs "/claude:plugin list" in pi's json mode with the hooks recording
    Then the hooks record these runs:
      | event        | session | reason | source  | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_ENV_FILE                                                           | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | SessionStart | first   |        | startup | {project dir} |                 | start     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | {project dir}/.pi/pi-claude-marketplace/data/_shared/claude-env-first.env | first                  | first             | 1          |
      | SessionEnd   | first   | other  |         | {project dir} |                 | end       | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo |                                                                           | first                  | first             | 1          |

  Scenario: A SessionEnd matcher selects only the clear run of a new session
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name                  | event      | matcher           |
      | end-clear             | SessionEnd | clear             |
      | end-resume            | SessionEnd | resume            |
      | end-logout            | SessionEnd | logout            |
      | end-prompt-input-exit | SessionEnd | prompt_input_exit |
      | end-other             | SessionEnd | other             |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    When the user starts a new pi session with the hooks recording
    Then the hooks record these runs:
      | event      | session | reason | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | SessionEnd | first   | clear  | {project dir} |                 | end-clear | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |

  Scenario: A SessionEnd matcher selects only the resume run of a resumed session
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name                  | event      | matcher           |
      | end-clear             | SessionEnd | clear             |
      | end-resume            | SessionEnd | resume            |
      | end-logout            | SessionEnd | logout            |
      | end-prompt-input-exit | SessionEnd | prompt_input_exit |
      | end-other             | SessionEnd | other             |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the user has a saved pi session "saved" in the project
    When the user resumes the saved pi session "saved" with the hooks recording
    Then the hooks record these runs:
      | event      | session | reason | cwd           | transcript path | arguments  | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | SessionEnd | first   | resume | {project dir} |                 | end-resume | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |

  Scenario: A SessionEnd matcher selects only the other run of an RPC stop
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name                  | event      | matcher           |
      | end-clear             | SessionEnd | clear             |
      | end-resume            | SessionEnd | resume            |
      | end-logout            | SessionEnd | logout            |
      | end-prompt-input-exit | SessionEnd | prompt_input_exit |
      | end-other             | SessionEnd | other             |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    When the user quits pi with the hooks recording
    Then the hooks record these runs:
      | event      | session | reason | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | SessionEnd | first   | other  | {project dir} |                 | end-other | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |

  Scenario: A SessionEnd matcher selects only the prompt_input_exit run of a terminal quit
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name                  | event        | matcher           |
      | start                 | SessionStart | *                 |
      | end-clear             | SessionEnd   | clear             |
      | end-resume            | SessionEnd   | resume            |
      | end-logout            | SessionEnd   | logout            |
      | end-prompt-input-exit | SessionEnd   | prompt_input_exit |
      | end-other             | SessionEnd   | other             |
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user has started pi in the terminal with the hooks recording
    When the user quits pi in the terminal with the hooks recording
    Then the hooks record these runs:
      | event      | session | reason            | cwd           | transcript path | arguments             | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                   | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | SessionEnd | first   | prompt_input_exit | {project dir} |                 | end-prompt-input-exit | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {agent dir}/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
