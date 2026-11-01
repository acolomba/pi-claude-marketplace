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
      | event        | session | reason | source | cwd           | transcript path | arguments     | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                | CLAUDE_ENV_FILE                                                            | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | SessionEnd   | first   | clear  |        | {project dir} |                 | session-end   | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/demo |                                                                            | first                  | first             | 1          |
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
      | event        | session | source | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                | CLAUDE_ENV_FILE                                                           | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
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

  Scenario: A compaction runs SessionStart with source compact between PreCompact and PostCompact
    Given pi keeps only one recent token when the hooks session compacts
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name  | event        | matcher |
      | pre   | PreCompact   | *       |
      | start | SessionStart | compact |
      | post  | PostCompact  | *       |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply      |
      | Hello.     |
      | Summary A. |
    Given the user has prompted "hello" with the hooks recording
    When the user compacts the session with the hooks recording
    Then the hooks record these runs:
      | event        | session | trigger | source  | compact summary                                                          | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                | CLAUDE_ENV_FILE                                                           | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreCompact   | first   | manual  |         |                                                                          | {project dir} |                 | pre       | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/demo |                                                                           | first                  | first             | 1          |
      | SessionStart | first   |         | compact |                                                                          | {project dir} |                 | start     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/demo | {project dir}/.pi/pi-claude-marketplace/data/_shared/claude-env-first.env | first                  | first             | 1          |
      | PostCompact  | first   | manual  |         | No prior history.\n\n---\n\n**Turn Context (split turn):**\n\nSummary A. | {project dir} |                 | post      | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/demo |                                                                           | first                  | first             | 1          |

  Scenario: A PreCompact hook that exits 2 blocks the compaction
    Given pi keeps only one recent token when the hooks session compacts
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name  | event        | matcher | form   | exit code | stderr          |
      | keep  | PreCompact   | *       | script | 2         | keep it all     |
      | start | SessionStart | compact |        |           |                 |
      | post  | PostCompact  | *       |        |           |                 |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply  |
      | Hello. |
    Given the user has prompted "hello" with the hooks recording
    When the user compacts the session with the hooks recording, which fails with "Compaction cancelled"
    Then the hooks record these runs:
      | event      | session | trigger | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreCompact | first   | manual  | {project dir} |                 | keep      | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/demo | first                  | first             | 1          |
    Then the hooks show the user these messages:
      | severity | text                                                                                        |
      | info     | Compaction blocked by PreCompact hook: [${CLAUDE_PLUGIN_ROOT}/hooks/keep.sh]: keep it all |

  Scenario: A PreCompact hook that exits 2 blocks the compaction when another PreCompact hook stops
    Given pi keeps only one recent token when the hooks session compacts
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name  | event        | matcher | form   | exit code | stderr      | output             |
      | halt  | PreCompact   | *       | script |           |             | {"continue":false} |
      | keep  | PreCompact   | *       | script | 2         | keep it all |                    |
      | start | SessionStart | compact |        |           |             |                    |
      | post  | PostCompact  | *       |        |           |             |                    |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply  |
      | Hello. |
    Given the user has prompted "hello" with the hooks recording
    When the user compacts the session with the hooks recording, which fails with "Compaction cancelled"
    Then the hooks record these runs in any order:
      | event      | session | trigger | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreCompact | first   | manual  | {project dir} |                 | halt      | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/demo | first                  | first             | 1          |
      | PreCompact | first   | manual  | {project dir} |                 | keep      | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/demo | first                  | first             | 1          |
    Then the hooks show the user these messages:
      | severity | text                                                                                        |
      | info     | Compaction blocked by PreCompact hook: [${CLAUDE_PLUGIN_ROOT}/hooks/keep.sh]: keep it all |

  Scenario: A second compaction in a session runs SessionStart compact again
    Given pi keeps only one recent token when the hooks session compacts
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name  | event        | matcher |
      | start | SessionStart | compact |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply      |
      | Hello.     |
      | Summary A. |
      | Again.     |
      | Summary B. |
      | Summary C. |
    Given the user has prompted "hello" with the hooks recording
    Given the user has compacted the session with the hooks recording
    Given the user has prompted "hello again" with the hooks recording
    When the user compacts the session with the hooks recording
    Then the hooks record these runs:
      | event        | session | source  | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                | CLAUDE_ENV_FILE                                                           | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | SessionStart | first   | compact | {project dir} |                 | start     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/demo | {project dir}/.pi/pi-claude-marketplace/data/_shared/claude-env-first.env | first                  | first             | 1          |

  Scenario: A compaction trigger matcher selects the PreCompact and PostCompact runs
    Given pi keeps only one recent token when the hooks session compacts
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name        | event       | matcher |
      | pre-manual  | PreCompact  | manual  |
      | pre-auto    | PreCompact  | auto    |
      | post-manual | PostCompact | manual  |
      | post-auto   | PostCompact | auto    |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply      |
      | Hello.     |
      | Summary A. |
    Given the user has prompted "hello" with the hooks recording
    When the user compacts the session with the hooks recording
    Then the hooks record these runs:
      | event       | session | trigger | compact summary                                                          | cwd           | transcript path | arguments   | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreCompact  | first   | manual  |                                                                          | {project dir} |                 | pre-manual  | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/demo | first                  | first             | 1          |
      | PostCompact | first   | manual  | No prior history.\n\n---\n\n**Turn Context (split turn):**\n\nSummary A. | {project dir} |                 | post-manual | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/demo | first                  | first             | 1          |

  Scenario: Forking a session runs SessionEnd with reason resume and SessionStart with source fork
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name       | event        | matcher |
      | end        | SessionEnd   | *       |
      | fork-start | SessionStart | fork    |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply  |
      | Hello. |
    Given the user has prompted "hello" with the hooks recording
    When the user forks the session at its first prompt with the hooks recording
    Then the hooks record these runs:
      | event        | session | reason | source | cwd           | transcript path | arguments  | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                | CLAUDE_ENV_FILE                                                            | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | SessionEnd   | first   | resume |        | {project dir} |                 | end        | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/demo |                                                                            | first                  | first             | 1          |
      | SessionStart | second  |        | fork   | {project dir} |                 | fork-start | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/demo | {project dir}/.pi/pi-claude-marketplace/data/_shared/claude-env-second.env | second                 | second            | 1          |

  Scenario: Stopping an RPC session runs SessionEnd with reason other
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name | event      | matcher |
      | end  | SessionEnd | *       |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    When the user quits pi with the hooks recording
    Then the hooks record these runs:
      | event      | session | reason | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | SessionEnd | first   | other  | {project dir} |                 | end       | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/demo | first                  | first             | 1          |

  Scenario: Reloading pi in the terminal runs no session hook
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name   | event            | matcher | form   | exit code | stderr     |
      | end    | SessionEnd       | *       |        |           |            |
      | start  | SessionStart     | *       |        |           |            |
      | marker | UserPromptSubmit |         | script | 2         | not needed |
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user has started pi in the terminal with the hooks recording
    When the user reloads pi in the terminal and then prompts "after the reload" with the hooks recording
    Then the hooks record these runs:
      | event            | session | prompt           | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                          | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | UserPromptSubmit | first   | after the reload | {project dir} |                 | marker    | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {agent dir}/pi-claude-marketplace/data/demo | first                  | first             | 1          |

  Scenario: Quitting pi in the terminal runs SessionEnd with reason prompt_input_exit
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name  | event        | matcher |
      | end   | SessionEnd   | *       |
      | start | SessionStart | *       |
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user has started pi in the terminal with the hooks recording
    When the user quits pi in the terminal with the hooks recording
    Then the hooks record these runs:
      | event      | session | reason            | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                          | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | SessionEnd | first   | prompt_input_exit | {project dir} |                 | end       | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {agent dir}/pi-claude-marketplace/data/demo | first                  | first             | 1          |
