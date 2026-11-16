Feature: Hook failures

  A hook that cannot start, exits with an error, times out, or prints broken
  JSON blocks the prompt only when it sets onFailure to block, as in Claude
  Code. A scripted model with no script fails any prompt that reaches it.

  Scenario Outline: A failing prompt hook with onFailure block stops the prompt
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name  | event            | matcher | form   | exit code   | stderr   | output   | timeout   | sleep   | on failure |
      | guard | UserPromptSubmit |         | script | <exit code> | <stderr> | <output> | <timeout> | <sleep> | block      |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    When the user prompts "say done"
    Then the hooks record these runs:
      | event            | session | prompt   | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | UserPromptSubmit | first   | say done | {project dir} |                 | guard     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the hooks show the user these messages:
      | severity | text     |
      | info     | <notice> |

    Examples:
      | exit code | stderr                                                                     | output     | timeout | sleep | notice |
      | 1         | boom                                                                       |            |         |       | UserPromptSubmit operation blocked by hook:\n[${CLAUDE_PLUGIN_ROOT}/hooks/guard.sh]: failed; blocking because onFailure is "block"\nboom |
      |           |                                                                            | {not json} |         |       | UserPromptSubmit operation blocked by hook:\n[${CLAUDE_PLUGIN_ROOT}/hooks/guard.sh]: failed; blocking because onFailure is "block" |
      |           |                                                                            |            | 1       | 3     | UserPromptSubmit operation blocked by hook:\n[${CLAUDE_PLUGIN_ROOT}/hooks/guard.sh]: timed out; blocking because onFailure is "block" |
      | 2         | python3: can't open file '/x/gone.py': [Errno 2] No such file or directory |            |         |       | UserPromptSubmit operation blocked by hook:\n[${CLAUDE_PLUGIN_ROOT}/hooks/guard.sh]: failed; blocking because onFailure is "block"\npython3: can't open file '/x/gone.py': [Errno 2] No such file or directory |

  Scenario: A failing prompt hook without onFailure lets the prompt through and shows its error
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name  | event            | matcher | form   | exit code | stderr |
      | guard | UserPromptSubmit |         | script | 1         | boom   |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply |
      | Done. |
    When the user prompts "say done"
    Then the hooks record these runs:
      | event            | session | prompt   | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | UserPromptSubmit | first   | say done | {project dir} |                 | guard     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the model receives these calls:
      | call | role | text     |
      | 1    | user | say done |
    Then the hooks show the user these messages:
      | severity | text                                                                    |
      | info     | UserPromptSubmit hook error: Failed with non-blocking status code: boom |

  Scenario: A prompt hook whose script is missing lets the prompt through and shows its error
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name | event            | matcher | form   | exit code | stderr                                                                     |
      | gone | UserPromptSubmit |         | script | 2         | python3: can't open file '/x/gone.py': [Errno 2] No such file or directory |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply |
      | Done. |
    When the user prompts "say done"
    Then the hooks record these runs:
      | event            | session | prompt   | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | UserPromptSubmit | first   | say done | {project dir} |                 | gone      | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the model receives these calls:
      | call | role | text     |
      | 1    | user | say done |
    Then the hooks show the user these messages:
      | severity | text                                                                                                                                                                                                                                                                                                            |
      | info     | UserPromptSubmit hook error: Hook script appears to be missing {em dash} "${CLAUDE_PLUGIN_ROOT}/hooks/gone.sh" exited 2 with: python3: can't open file '/x/gone.py': [Errno 2] No such file or directory. Treating as non-blocking. Run /claude:plugin reinstall demo@fixtures --scope project to reinstall it. |

  Scenario: A stop hook whose script is missing lets the run end and shows its error
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name | event | matcher | form   | exit code | stderr                                                                     |
      | gone | Stop  |         | script | 2         | python3: can't open file '/x/gone.py': [Errno 2] No such file or directory |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply |
      | Done. |
    When the user prompts "finish up"
    Then the hooks record these runs:
      | event | session | last assistant message | stop hook active | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | Stop  | first   | Done.                  | false            | {project dir} |                 | gone      | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the model receives these calls:
      | call | role | text      |
      | 1    | user | finish up |
    Then the hooks show the user these messages:
      | severity | text                                                                                                                                                                                                                                                                                                |
      | info     | Stop hook error: Hook script appears to be missing {em dash} "${CLAUDE_PLUGIN_ROOT}/hooks/gone.sh" exited 2 with: python3: can't open file '/x/gone.py': [Errno 2] No such file or directory. Treating as non-blocking. Run /claude:plugin reinstall demo@fixtures --scope project to reinstall it. |

  Scenario: A succeeding prompt hook with onFailure block lets the prompt through
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name  | event            | matcher | form   | exit code | on failure |
      | guard | UserPromptSubmit |         | script | 0         | block      |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply |
      | Done. |
    When the user prompts "say done"
    Then the hooks record these runs:
      | event            | session | prompt   | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | UserPromptSubmit | first   | say done | {project dir} |                 | guard     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the model receives these calls:
      | call | role | text     |
      | 1    | user | say done |
    Then the hooks show the user no messages

  Scenario: A prompt hook that cannot start stops the prompt when onFailure is block
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name          | event            | matcher | form    | on failure |
      | observer      | UserPromptSubmit |         |         |            |
      | missing-guard | UserPromptSubmit |         | missing | block      |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    When the user prompts "say done"
    Then the hooks record these runs:
      | event            | session | prompt   | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | UserPromptSubmit | first   | say done | {project dir} |                 | observer  | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the hooks show the user these messages:
      | severity | text                                                                                                                                       |
      | info     | UserPromptSubmit operation blocked by hook:\n[${CLAUDE_PLUGIN_ROOT}/hooks/missing-guard.sh]: failed; blocking because onFailure is "block" |

  Scenario: A prompt hook that cannot start lets the prompt through and shows its error
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name          | event            | matcher | form    |
      | observer      | UserPromptSubmit |         |         |
      | missing-guard | UserPromptSubmit |         | missing |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply |
      | Done. |
    When the user prompts "say done"
    Then the hooks record these runs:
      | event            | session | prompt   | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | UserPromptSubmit | first   | say done | {project dir} |                 | observer  | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the model receives these calls:
      | call | role | text     |
      | 1    | user | say done |
    Then the hooks show the user these messages:
      | severity | text                                                                                                                                          |
      | info     | UserPromptSubmit hook error: Failed with non-blocking status code: Error occurred while executing hook command: spawn missing-guard.sh ENOENT |

  Scenario: An exec-form hook that names a plugin option with no value fails with Claude Code's message (D-PG10-08)
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name       | event            | matcher | form | arguments                |
      | observer   | UserPromptSubmit |         |      |                          |
      | token-hook | UserPromptSubmit |         | exec | ["${user_config.token}"] |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply |
      | Done. |
    When the user prompts "say done"
    Then the hooks record these runs:
      | event            | session | prompt   | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | UserPromptSubmit | first   | say done | {project dir} |                 | observer  | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the model receives these calls:
      | call | role | text     |
      | 1    | user | say done |
    Then the hooks show the user these messages:
      | severity | text                                                                                                                                                                             |
      | info     | UserPromptSubmit hook error: Failed to run: Plugin option "token" isn't set. Open /plugin manage to configure it, or check that the plugin's userConfig schema declares "token". |

  Scenario: An exec-form hook that names a plugin option of a record whose options do not parse fails as unreadable (D-PG10-25)
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".claude-plugin/plugin.json" with this text:
      """
      {
        "name": "demo",
        "version": "1.0.0",
        "userConfig": {
          "token": { "type": "string", "title": "Token", "description": "The token.", "default": "abc" }
        }
      }
      """
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name       | event            | matcher | form | arguments                |
      | observer   | UserPromptSubmit |         |      |                          |
      | token-hook | UserPromptSubmit |         | exec | ["${user_config.token}"] |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the installation record of the plugin "demo@fixtures" in the project scope holds plugin options that do not parse
    Given the scripted model plays these steps:
      | reply |
      | Done. |
    When the user starts a new pi session
    Then the session reports these results:
      | kind                      | severity | needs reload | summary                             | tally label | tally failures | tally warnings |
      | reconcile-applied-cascade | warning  | false        | A plugin operation needs attention. | Reconcile   | 0              | 1              |
      | reconcile-applied-cascade | warning  | false        | A plugin operation needs attention. | Reconcile   | 0              | 1              |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status | reasons    | scope   | cause chain                                                                                                                                                       | cause truncated | leaks | rollback partial |
      | fixtures         | project           | demo@fixtures | demo | failed | unreadable | project | The plugin options in the install record of demo@fixtures do not parse (userConfig is not an object). Run /claude:plugin reinstall demo@fixtures to restore them. | false           |       |                  |
      | fixtures         | project           | demo@fixtures | demo | failed | unreadable | project | The plugin options in the install record of demo@fixtures do not parse (userConfig is not an object). Run /claude:plugin reinstall demo@fixtures to restore them. | false           |       |                  |
    When the user prompts "say done"
    Then the hooks record these runs:
      | event            | session | prompt   | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | UserPromptSubmit | first   | say done | {project dir} |                 | observer  | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the model receives these calls:
      | call | role | text     |
      | 1    | user | say done |
    Then the hooks show the user these messages:
      | severity | text                                                                                                                                                                                                          |
      | info     | UserPromptSubmit hook error: Failed to run: Plugin option "token" can't be read: the options in the install record of demo@fixtures do not parse. Run /claude:plugin reinstall demo@fixtures to restore them. |

  Scenario: A shell-form hook that names a plugin option is not run, with Claude Code's message (D-PG10-10)
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".claude-plugin/plugin.json" with this text:
      """
      {
        "name": "demo",
        "version": "1.0.0",
        "userConfig": {
          "mode": { "type": "string", "title": "Mode", "description": "The mode.", "default": "fast" }
        }
      }
      """
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name      | event            | matcher | form   | arguments               |
      | observer  | UserPromptSubmit |         |        |                         |
      | mode-hook | UserPromptSubmit |         | script | ["${user_config.mode}"] |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply |
      | Done. |
    When the user prompts "say done"
    Then the hooks record these runs:
      | event            | session | prompt   | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_PLUGIN_OPTION_MODE | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | UserPromptSubmit | first   | say done | {project dir} |                 | observer  | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | fast                      | first                  | first             | 1          |
    Then the model receives these calls:
      | call | role | text     |
      | 1    | user | say done |
    Then the hooks show the user these messages:
      | severity | text                                                                                                                                                                                                                                           |
      | info     | UserPromptSubmit hook error: Failed to run: Hook from plugin demo@fixtures references ${user_config.*} in a shell-form command. The substituted value would be re-parsed by the shell. Use exec form instead {em dash} {"command": "<executab… |

  Scenario: An edit hook that fails for each pair of an edit shows its error once
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name  | event      | matcher | form   | exit code | stderr |
      | guard | PreToolUse | Edit    | script | 1         | boom   |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the project holds the file "document.txt" with the text "first\nmiddle\nsecond\n" for a tool hook
    Given the scripted model plays these steps:
      | reply | tool | arguments                                                                                                        |
      |       | edit | {"path":"document.txt","edits":[{"oldText":"first","newText":"one"},{"oldText":"second","newText":"two"}]} |
      | Done. |      |                                                                                                                  |
    When the user prompts "edit both blocks"
    Then the hooks record these runs in any order:
      | event      | session | tool name | tool use id    | tool input                                                                              | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse | first   | Edit      | {tool use 1}#1 | {"file_path":"{project dir}/document.txt","old_string":"first","new_string":"one"}   | {project dir} |                 | guard     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
      | PreToolUse | first   | Edit      | {tool use 1}#2 | {"file_path":"{project dir}/document.txt","old_string":"second","new_string":"two"} | {project dir} |                 | guard     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the hooks show the user these messages:
      | severity | text                                                                   |
      | info     | PreToolUse:Edit hook error: Failed with non-blocking status code: boom |
    Then the project file "document.txt" has the text "one\nmiddle\ntwo\n" after a tool hook
