Feature: Plugin subagent child

  A load in a pi-subagents background child changes nothing installed, yet loads the installed
  components (D-MB-12), and a child runs a plugin's tool hooks but no main-session hook (D-PG3-08). A child's tool hooks
  name its agent and session (D-PG3-06). Stand-ins: Pis with the runner's marker and pi-subagents' agent tag in their
  system prompt beside a main Pi, a json-mode Pi, a scripted model, recording hooks, and a local marketplace.

  Scenario: A background child's load with autoapply on leaves a pending install, uninstall, and update for the next parent load
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
      | old  | 1.0.0   |
      | upd  | 1.0.0   |
    Given a config in scope project and layer base, with this text:
      """
      { "autoapply": true }
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install old@fixtures --scope project"
    Given the user has run "/claude:plugin install upd@fixtures --scope project"
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
      | old  | 1.0.0   |
      | upd  | 1.1.0   |
    Given a config in scope project and layer base, with these plugins:
      | marketplace | plugin | enabled |
      | fixtures    | demo   |         |
      | fixtures    | upd    |         |
    Given pi runs with the scripted model as a pi-subagents background child
    When the user starts a new pi session
    Then the session reports these results:
      | kind    | severity | needs reload | needs apply | tally label       | tally failures | tally warnings | tally success count |
      | cascade | info     | false        | true        | Reconcile pending | 0              | 0              | 3                   |
      | cascade | info     | false        | true        | Reconcile pending | 0              | 0              | 3                   |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status         | reasons | scope   | version | from  | to    |
      | fixtures         | project           | demo@fixtures | demo | will install   |         | project |         |       |       |
      | fixtures         | project           | old@fixtures  | old  | will uninstall |         | project | 1.0.0   |       |       |
      | fixtures         | project           | upd@fixtures  | upd  | will update    |         | project |         | 1.0.0 | 1.1.0 |
      | fixtures         | project           | demo@fixtures | demo | will install   |         | project |         |       |       |
      | fixtures         | project           | old@fixtures  | old  | will uninstall |         | project | 1.0.0   |       |       |
      | fixtures         | project           | upd@fixtures  | upd  | will update    |         | project |         | 1.0.0 | 1.1.0 |
    Then the installation record of the project scope holds these plugins:
      | id           | version | enabled |
      | old@fixtures | 1.0.0   | true    |
      | upd@fixtures | 1.0.0   | true    |
    When the user runs "/claude:plugin list" in pi's json mode
    Then the command reports these results:
      | kind    | severity | needs reload | tally label | tally failures | tally warnings | tally success count |
      | cascade | info     | false        | Plugin list | 0              | 0              | 3                   |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | installed |         | project | 1.0.0   |
      | fixtures         | project           | old@fixtures  | old  | available |         |         | 1.0.0   |
      | fixtures         | project           | upd@fixtures  | upd  | installed |         | project | 1.1.0   |
    Then the installation record of the project scope holds these plugins:
      | id            | version | enabled |
      | demo@fixtures | 1.0.0   | true    |
      | upd@fixtures  | 1.1.0   | true    |

  @own-implementation
  Scenario: A background child's load leaves a release 0.19.2 mcp.json for the next parent load to move
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" declares the mcp server "srv"
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given the mcp.json file of the user scope holds the servers of the plugin "demo@fixtures" as release 0.19.2 wrote them, beside the user's own server "mine"
    Given pi runs with the scripted model as a pi-subagents background child
    When the user starts a new pi session
    Then the session reports no results
    Then the mcp configuration file "mcp.json" of the user scope holds this text:
      """
      {
        "mcpServers": {
          "mine": {
            "command": "pi-features-users-own-mcp-server"
          },
          "srv": {
            "command": "pi-features-absent-mcp-server",
            "args": [],
            "env": {
              "CLAUDE_PLUGIN_ROOT": "{home}/marketplaces/fixtures/plugins/demo",
              "CLAUDE_PLUGIN_DATA": "{agent dir}/pi-claude-marketplace/data/fixtures/demo"
            },
            "_piClaudeMarketplace": {
              "plugin": "demo",
              "marketplace": "fixtures"
            }
          }
        }
      }

      """
    Then the mcp configuration file "mcp-adapter.json" of the user scope holds this text:
      """
      {
        "mcpServers": {}
      }

      """
    When the user runs "/claude:plugin list" in pi's json mode
    Then the command reports these results:
      | kind    | severity | needs reload | tally label | tally failures | tally warnings | tally success count |
      | cascade | info     | false        | Plugin list | 0              | 0              | 1                   |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope | version |
      | fixtures         | user              | demo@fixtures | demo | installed |         | user  | 1.0.0   |
    Then the mcp configuration file "mcp.json" of the user scope holds this text:
      """
      {
        "mcpServers": {
          "mine": {
            "command": "pi-features-users-own-mcp-server"
          }
        }
      }

      """
    Then the mcp configuration file "mcp-adapter.json" of the user scope holds this text:
      """
      {
        "mcpServers": {
          "plugin_demo_srv_": {
            "command": "pi-features-absent-mcp-server",
            "args": [],
            "env": {
              "CLAUDE_PLUGIN_ROOT": "{home}/marketplaces/fixtures/plugins/demo",
              "CLAUDE_PLUGIN_DATA": "{agent dir}/pi-claude-marketplace/data/fixtures/demo"
            },
            "directTools": "search",
            "toolPrefix": "mcp",
            "requestTimeoutMs": 1800000,
            "_piClaudeMarketplace": {
              "plugin": "demo",
              "marketplace": "fixtures",
              "defaultFields": {
                "requestTimeoutMs": 1800000
              }
            }
          }
        }
      }

      """

  Scenario: A background child offers the skill and the slash command of an installed plugin
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the slash command "greet" described as "Greets a person by name." with this body:
      """
      Greet the person named in the arguments.
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given pi runs with the scripted model as a pi-subagents background child
    When the user starts a new pi session
    Then the session reports no results
    Then the session offers these skills:
      | command           | description            |
      | /skill:demo-skill | A skill of demo 1.0.0. |
    When the user lists the slash commands pi offers
    Then pi offers these slash commands from prompt templates:
      | command     | description              |
      | /demo:greet | Greets a person by name. |

  Scenario: A background child runs an installed plugin's PreToolUse hook on a tool call its model makes
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name       | event      | matcher |
      | bash-guard | PreToolUse | Bash    |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given pi runs with the scripted model as a pi-subagents background child
    Given the scripted model plays these steps:
      | reply | tool | arguments                      |
      |       | bash | {"command": "echo from-model"} |
      | Done. |      |                                |
    When the user prompts "run the echo"
    Then the hooks record these runs:
      | event      | session | tool name | tool use id  | tool input                    | cwd           | transcript path | arguments  | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse | first   | Bash      | {tool use 1} | {"command":"echo from-model"} | {project dir} |                 | bash-guard | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the model receives these calls:
      | call | role        | text                                         |
      | 1    | user        | run the echo                                 |
      | 2    | user        | run the echo                                 |
      | 2    | assistant   | tool call bash {"command":"echo from-model"} |
      | 2    | tool result | bash returned: from-model\n                  |

  @mcp
  Scenario: A child runs tool hooks without main-session hooks
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name         | event              | matcher | form   | on reentry | output                                     |
      | start        | SessionStart       |         |        |            |                                            |
      | prompt       | UserPromptSubmit   |         |        |            |                                            |
      | before       | PreToolUse         | *       |        |            |                                            |
      | after        | PostToolUse        | *       |        |            |                                            |
      | failure      | PostToolUseFailure | *       |        |            |                                            |
      | stop         | Stop               |         | script | allow      | {"decision":"block","reason":"keep going"} |
      | stop-error   | StopFailure        |         |        |            |                                            |
      | pre-compact  | PreCompact         | *       |        |            |                                            |
      | post-compact | PostCompact        | *       |        |            |                                            |
      | ending       | SessionEnd         |         |        |            |                                            |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given pi runs with the scripted model and the mcp implementation as a pi-subagents background child
    Given the scripted model plays these steps:
      | reply | tool | arguments                      |
      |       | bash | {"command": "echo from-model"} |
      |       | read | {"path": "missing.txt"}        |
      | Done. |      |                                |
    When the user prompts "run the tools" in pi's startup session
    Then the hooks record these runs:
      | event              | session | tool name | tool use id  | duration ms    | tool input                                | tool response                                                                      | error                                                                 | is interrupt | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse         | first   | Bash      | {tool use 1} |                | {"command":"echo from-model"}             |                                                                                    |                                                                       |              | {project dir} |                 | before    | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
      | PostToolUse        | first   | Bash      | {tool use 1} | {milliseconds} | {"command":"echo from-model"}             | {"interrupted":false,"structuredContent":[{"type":"text","text":"from-model\\n"}]} |                                                                       |              | {project dir} |                 | after     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
      | PreToolUse         | first   | Read      | {tool use 2} |                | {"file_path":"{project dir}/missing.txt"} |                                                                                    |                                                                       |              | {project dir} |                 | before    | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
      | PostToolUseFailure | first   | Read      | {tool use 2} | {milliseconds} | {"file_path":"{project dir}/missing.txt"} |                                                                                    | ENOENT: no such file or directory, access '{project dir}/missing.txt' | false        | {project dir} |                 | failure   | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the model receives these calls:
      | call | role        | text                                                                               |
      | 1    | user        | run the tools                                                                      |
      | 2    | user        | run the tools                                                                      |
      | 2    | assistant   | tool call bash {"command":"echo from-model"}                                       |
      | 2    | tool result | bash returned: from-model\n                                                        |
      | 3    | user        | run the tools                                                                      |
      | 3    | assistant   | tool call bash {"command":"echo from-model"}                                       |
      | 3    | tool result | bash returned: from-model\n                                                        |
      | 3    | assistant   | tool call read {"path":"missing.txt"}                                              |
      | 3    | tool result | read failed: ENOENT: no such file or directory, access '{project dir}/missing.txt' |

  @mcp
  Scenario: A child ignores a Stop hook that would continue the main session
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name   | event      | matcher | form   | on reentry | output                                     |
      | before | PreToolUse | *       |        |            |                                            |
      | stop   | Stop       |         | script | allow      | {"decision":"block","reason":"keep going"} |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given pi runs with the scripted model and the mcp implementation as a pi-subagents background child
    Given the scripted model plays these steps:
      | reply | tool | arguments                      |
      |       | bash | {"command": "echo from-model"} |
      | Done. |      |                                |
    When the user prompts "finish up" in pi's startup session
    Then the hooks record these runs:
      | event      | session | tool name | tool use id  | tool input                    | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse | first   | Bash      | {tool use 1} | {"command":"echo from-model"} | {project dir} |                 | before    | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the model receives these calls:
      | call | role        | text                                         |
      | 1    | user        | finish up                                    |
      | 2    | user        | finish up                                    |
      | 2    | assistant   | tool call bash {"command":"echo from-model"} |
      | 2    | tool result | bash returned: from-model\n                  |

  @mcp
  Scenario: Child compaction runs no main-session hooks
    Given pi keeps only one recent token when the hooks session compacts
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name         | event        | matcher |
      | start        | SessionStart | *       |
      | before       | PreToolUse   | *       |
      | pre-compact  | PreCompact   | *       |
      | post-compact | PostCompact  | *       |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given pi runs with the scripted model and the mcp implementation as a pi-subagents background child
    Given the scripted model plays these steps:
      | reply      | tool | arguments                      | context tokens |
      |            | bash | {"command": "echo from-model"} |                |
      | Hello.     |      |                                | 120000         |
      | Summary A. |      |                                |                |
    When the user prompts "hello" in pi's startup session
    Then the hooks record these runs:
      | event      | session | tool name | tool use id  | tool input                    | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse | first   | Bash      | {tool use 1} | {"command":"echo from-model"} | {project dir} |                 | before    | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then pi compacts the session once for its context threshold

  @mcp
  Scenario: A main session still runs its lifecycle hooks
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name         | event              | matcher | form   | on reentry | output                                     |
      | start        | SessionStart       |         |        |            |                                            |
      | prompt       | UserPromptSubmit   |         |        |            |                                            |
      | before       | PreToolUse         | *       |        |            |                                            |
      | after        | PostToolUse        | *       |        |            |                                            |
      | failure      | PostToolUseFailure | *       |        |            |                                            |
      | stop         | Stop               |         | script | allow      | {"decision":"block","reason":"keep going"} |
      | stop-error   | StopFailure        |         |        |            |                                            |
      | pre-compact  | PreCompact         | *       |        |            |                                            |
      | post-compact | PostCompact        | *       |        |            |                                            |
      | ending       | SessionEnd         |         |        |            |                                            |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given pi runs with the scripted model and the mcp implementation
    Given the scripted model plays these steps:
      | reply  | tool | arguments                      |
      |        | bash | {"command": "echo from-model"} |
      |        | read | {"path": "missing.txt"}        |
      | Done.  |      |                                |
      | Fixed. |      |                                |
    When the user prompts "run the tools" in pi's startup session
    Then the hooks record these runs:
      | event              | session | source  | model  | prompt        | tool name | tool use id  | duration ms    | tool input                                | tool response                                                                      | error                                                                 | is interrupt | last assistant message | stop hook active | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_ENV_FILE                                                           | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | SessionStart       | first   | startup | faux-1 |               |           |              |                |                                           |                                                                                    |                                                                       |              |                        |                  | {project dir} |                 | start     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | {project dir}/.pi/pi-claude-marketplace/data/_shared/claude-env-first.env | first                  | first             | 1          |
      | UserPromptSubmit   | first   |         |        | run the tools |           |              |                |                                           |                                                                                    |                                                                       |              |                        |                  | {project dir} |                 | prompt    | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo |                                                                           | first                  | first             | 1          |
      | PreToolUse         | first   |         |        |               | Bash      | {tool use 1} |                | {"command":"echo from-model"}             |                                                                                    |                                                                       |              |                        |                  | {project dir} |                 | before    | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo |                                                                           | first                  | first             | 1          |
      | PostToolUse        | first   |         |        |               | Bash      | {tool use 1} | {milliseconds} | {"command":"echo from-model"}             | {"interrupted":false,"structuredContent":[{"type":"text","text":"from-model\\n"}]} |                                                                       |              |                        |                  | {project dir} |                 | after     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo |                                                                           | first                  | first             | 1          |
      | PreToolUse         | first   |         |        |               | Read      | {tool use 2} |                | {"file_path":"{project dir}/missing.txt"} |                                                                                    |                                                                       |              |                        |                  | {project dir} |                 | before    | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo |                                                                           | first                  | first             | 1          |
      | PostToolUseFailure | first   |         |        |               | Read      | {tool use 2} | {milliseconds} | {"file_path":"{project dir}/missing.txt"} |                                                                                    | ENOENT: no such file or directory, access '{project dir}/missing.txt' | false        |                        |                  | {project dir} |                 | failure   | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo |                                                                           | first                  | first             | 1          |
      | Stop               | first   |         |        |               |           |              |                |                                           |                                                                                    |                                                                       |              | Done.                  | false            | {project dir} |                 | stop      | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo |                                                                           | first                  | first             | 1          |
      | Stop               | first   |         |        |               |           |              |                |                                           |                                                                                    |                                                                       |              | Fixed.                 | true             | {project dir} |                 | stop      | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo |                                                                           | first                  | first             | 1          |
    Then the model receives these calls:
      | call | role        | text                                                                               |
      | 1    | user        | run the tools                                                                      |
      | 2    | user        | run the tools                                                                      |
      | 2    | assistant   | tool call bash {"command":"echo from-model"}                                       |
      | 2    | tool result | bash returned: from-model\n                                                        |
      | 3    | user        | run the tools                                                                      |
      | 3    | assistant   | tool call bash {"command":"echo from-model"}                                       |
      | 3    | tool result | bash returned: from-model\n                                                        |
      | 3    | assistant   | tool call read {"path":"missing.txt"}                                              |
      | 3    | tool result | read failed: ENOENT: no such file or directory, access '{project dir}/missing.txt' |
      | 4    | user        | run the tools                                                                      |
      | 4    | assistant   | tool call bash {"command":"echo from-model"}                                       |
      | 4    | tool result | bash returned: from-model\n                                                        |
      | 4    | assistant   | tool call read {"path":"missing.txt"}                                              |
      | 4    | tool result | read failed: ENOENT: no such file or directory, access '{project dir}/missing.txt' |
      | 4    | assistant   | Done.                                                                              |
      | 4    | user        | Stop hook feedback:\nkeep going                                                    |

  @mcp
  Scenario: Loading and stopping a child leaves parent and sibling hooks running
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name         | event            | matcher | form   | async rewake | waits |
      | parent-wait  | UserPromptSubmit | *       | script | true         | true  |
      | sibling-wait | PreToolUse       | Bash    | script | true         | true  |
      | child-wait   | PreToolUse       | Read    | script | true         | true  |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the project holds the file "notes.txt" with the text "child notes\n" for a tool hook
    Given pi runs with the scripted model and the mcp implementation
    Given the scripted model plays these steps:
      | reply         | tool | arguments                   |
      | Parent done.  |      |                             |
      |               | bash | {"command": "echo sibling"} |
      | Sibling done. |      |                             |
      |               | read | {"path": "notes.txt"}       |
      | Child done.   |      |                             |
    Given the user has prompted "wait in the parent" and the hook "parent-wait" goes on in the background
    Given a pi-subagents background sibling child has prompted "run the sibling" and the hook "sibling-wait" goes on in the background
    When a pi-subagents background child loads, runs the hook "child-wait" for "read the notes" until the hook ends, starts a new session, and stops
    Then the hooks record these runs:
      | event      | session | tool name | tool use id  | tool input                              | cwd           | transcript path | arguments  | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse | first   | Read      | {tool use 1} | {"file_path":"{project dir}/notes.txt"} | {project dir} |                 | child-wait | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the hook processes record these lifecycle events:
      | hook       | phase | exit code |
      | child-wait | start |           |
      | child-wait | end   | 0         |
    Then these hook processes have started and not ended:
      | hook         | running |
      | parent-wait  | true    |
      | sibling-wait | true    |
    When the user releases the waiting hooks "parent-wait" and "sibling-wait"
    Then the hook processes record these lifecycle events in any order:
      | hook         | phase | exit code |
      | parent-wait  | end   | 0         |
      | sibling-wait | end   | 0         |

  @mcp
  Scenario Outline: A child tool hook identifies its own agent and session
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name         | event              | matcher | form   | on reentry | output                                     |
      | start        | SessionStart       |         |        |            |                                            |
      | prompt       | UserPromptSubmit   |         |        |            |                                            |
      | before       | PreToolUse         | *       |        |            |                                            |
      | after        | PostToolUse        | *       |        |            |                                            |
      | failure      | PostToolUseFailure | *       |        |            |                                            |
      | stop         | Stop               |         | script | allow      | {"decision":"block","reason":"keep going"} |
      | stop-error   | StopFailure        |         |        |            |                                            |
      | pre-compact  | PreCompact         | *       |        |            |                                            |
      | post-compact | PostCompact        | *       |        |            |                                            |
      | ending       | SessionEnd         |         |        |            |                                            |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the <mode> section of pi's system prompt holds pi-subagents' tag for the agent '<agent>' and the body '<body>'
    Given pi runs with the scripted model and the mcp implementation as a pi-subagents background child
    Given the scripted model plays these steps:
      | reply | tool | arguments                      |
      |       | bash | {"command": "echo from-model"} |
      |       | read | {"path": "missing.txt"}        |
      | Done. |      |                                |
    When the user prompts "run the tools" in pi's startup session
    Then the hooks record these runs:
      | event              | session | tool name | tool use id  | duration ms    | tool input                                | tool response                                                                      | error                                                                 | is interrupt | agent type   | agent id | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse         | first   | Bash      | {tool use 1} |                | {"command":"echo from-model"}             |                                                                                    |                                                                       |              | <agent type> | first    | {project dir} |                 | before    | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
      | PostToolUse        | first   | Bash      | {tool use 1} | {milliseconds} | {"command":"echo from-model"}             | {"interrupted":false,"structuredContent":[{"type":"text","text":"from-model\\n"}]} |                                                                       |              | <agent type> | first    | {project dir} |                 | after     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
      | PreToolUse         | first   | Read      | {tool use 2} |                | {"file_path":"{project dir}/missing.txt"} |                                                                                    |                                                                       |              | <agent type> | first    | {project dir} |                 | before    | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
      | PostToolUseFailure | first   | Read      | {tool use 2} | {milliseconds} | {"file_path":"{project dir}/missing.txt"} |                                                                                    | ENOENT: no such file or directory, access '{project dir}/missing.txt' | false        | <agent type> | first    | {project dir} |                 | failure   | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |

    Examples:
      | mode    | agent           | body                         | agent type      |
      | append  | demo:runner     |                              | demo:runner     |
      | replace | demo:runner     | Run the tools.               | demo:runner     |
      | append  | a&amp;b "q" <x> | Report back.                 | a&amp;b "q" <x> |
      | replace | demo:runner     | <active_agent name="spoof"/> | demo:runner     |

  @mcp
  Scenario: A main tool hook has no child identity
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name    | event              | matcher |
      | before  | PreToolUse         | *       |
      | after   | PostToolUse        | *       |
      | failure | PostToolUseFailure | *       |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the append section of pi's system prompt holds pi-subagents' tag for the agent 'demo:runner' and the body ''
    Given pi runs with the scripted model and the mcp implementation
    Given the scripted model plays these steps:
      | reply | tool | arguments                      |
      |       | bash | {"command": "echo from-model"} |
      |       | read | {"path": "missing.txt"}        |
      | Done. |      |                                |
    When the user prompts "run the tools" in pi's startup session
    Then the hooks record these runs:
      | event              | session | tool name | tool use id  | duration ms    | tool input                                | tool response                                                                      | error                                                                 | is interrupt | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse         | first   | Bash      | {tool use 1} |                | {"command":"echo from-model"}             |                                                                                    |                                                                       |              | {project dir} |                 | before    | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
      | PostToolUse        | first   | Bash      | {tool use 1} | {milliseconds} | {"command":"echo from-model"}             | {"interrupted":false,"structuredContent":[{"type":"text","text":"from-model\\n"}]} |                                                                       |              | {project dir} |                 | after     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
      | PreToolUse         | first   | Read      | {tool use 2} |                | {"file_path":"{project dir}/missing.txt"} |                                                                                    |                                                                       |              | {project dir} |                 | before    | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
      | PostToolUseFailure | first   | Read      | {tool use 2} | {milliseconds} | {"file_path":"{project dir}/missing.txt"} |                                                                                    | ENOENT: no such file or directory, access '{project dir}/missing.txt' | false        | {project dir} |                 | failure   | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |

  @mcp
  Scenario: A child keeps its own identity after another session runs
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name   | event       | matcher |
      | before | PreToolUse  | *       |
      | after  | PostToolUse | *       |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the append section of pi's system prompt holds pi-subagents' tag for the agent 'demo:runner' and the body ''
    Given pi runs with the scripted model and the mcp implementation as a pi-subagents background child
    Given the scripted model plays these steps:
      | reply         | tool | arguments                   |
      |               | bash | {"command": "echo first"}   |
      | First done.   |      |                             |
      |               | bash | {"command": "echo sibling"} |
      | Sibling done. |      |                             |
      |               | bash | {"command": "echo again"}   |
      | Again done.   |      |                             |
    When the user prompts "run first" in pi's startup session, a pi-subagents background child of the agent "demo:sibling" prompts "run the sibling" beside it, and the user prompts "run again"
    Then the hooks record these runs:
      | event       | session | tool name | tool use id  | duration ms    | tool input                 | tool response                                                                   | agent type   | agent id | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse  | first   | Bash      | {tool use 1} |                | {"command":"echo first"}   |                                                                                 | demo:runner  | first    | {project dir} |                 | before    | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
      | PostToolUse | first   | Bash      | {tool use 1} | {milliseconds} | {"command":"echo first"}   | {"interrupted":false,"structuredContent":[{"type":"text","text":"first\\n"}]}   | demo:runner  | first    | {project dir} |                 | after     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
      | PreToolUse  | second  | Bash      | {tool use 2} |                | {"command":"echo sibling"} |                                                                                 | demo:sibling | second   | {project dir} |                 | before    | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | second                 | second            | 1          |
      | PostToolUse | second  | Bash      | {tool use 2} | {milliseconds} | {"command":"echo sibling"} | {"interrupted":false,"structuredContent":[{"type":"text","text":"sibling\\n"}]} | demo:sibling | second   | {project dir} |                 | after     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | second                 | second            | 1          |
      | PreToolUse  | first   | Bash      | {tool use 3} |                | {"command":"echo again"}   |                                                                                 | demo:runner  | first    | {project dir} |                 | before    | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
      | PostToolUse | first   | Bash      | {tool use 3} | {milliseconds} | {"command":"echo again"}   | {"interrupted":false,"structuredContent":[{"type":"text","text":"again\\n"}]}   | demo:runner  | first    | {project dir} |                 | after     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |

  @mcp
  Scenario Outline: Missing child metadata clears the previous identity
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name   | event        | matcher | form   | on reentry | output                                     |
      | start  | SessionStart |         |        |            |                                            |
      | before | PreToolUse   | *       |        |            |                                            |
      | after  | PostToolUse  | *       |        |            |                                            |
      | stop   | Stop         |         | script | allow      | {"decision":"block","reason":"keep going"} |
      | ending | SessionEnd   |         |        |            |                                            |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the replace section of pi's system prompt holds pi-subagents' tag for the agent 'demo:runner' and the body 'Run the tools.'
    Given pi runs with the scripted model and the mcp implementation as a pi-subagents background child with its debug log on
    Given the scripted model plays these steps:
      | reply   | tool | arguments                  |
      |         | bash | {"command": "echo tagged"} |
      | Tagged. |      |                            |
      |         | bash | {"command": "echo bare"}   |
      | Bare.   |      |                            |
    When the user prompts "run tagged" in pi's startup session, the child's launch metadata becomes <metadata>, and the user prompts "run bare" in a new session
    Then the hooks record these runs:
      | event       | session | tool name | tool use id  | duration ms    | tool input                | tool response                                                                  | agent type  | agent id | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse  | first   | Bash      | {tool use 1} |                | {"command":"echo tagged"} |                                                                                | demo:runner | first    | {project dir} |                 | before    | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
      | PostToolUse | first   | Bash      | {tool use 1} | {milliseconds} | {"command":"echo tagged"} | {"interrupted":false,"structuredContent":[{"type":"text","text":"tagged\\n"}]} | demo:runner | first    | {project dir} |                 | after     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
      | PreToolUse  | second  | Bash      | {tool use 2} |                | {"command":"echo bare"}   |                                                                                |             |          | {project dir} |                 | before    | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | second                 | second            | 1          |
      | PostToolUse | second  | Bash      | {tool use 2} | {milliseconds} | {"command":"echo bare"}   | {"interrupted":false,"structuredContent":[{"type":"text","text":"bare\\n"}]}   |             |          | {project dir} |                 | after     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | second                 | second            | 1          |
    Then pi's debug log holds these child hook identity diagnostics:
      | diagnostic                                                                                 |
      | [hooks] Child hook identity unavailable: companion launch metadata is missing or malformed |

    Examples:
      | metadata  |
      | missing   |
      | malformed |

  @mcp
  Scenario: A real background child runs its plugin tool hooks and completes
    When pi-subagents, with its async-by-default setting false, launches from a main pi session a real child of each of these agents of a plugin with a stub mcp server, whose hooks record every event and whose stop hook would send a main session back:
      | name    | background | tools                       | tool calls         |
      | runner  | true       |                             | bash, failing read |
      | granted |            | mcp__plugin_demo_stub__echo | stub mcp tool      |
    Then pi-subagents ran the real children like this:
      | agent        | mode       | state    | runner process | session |
      | demo:runner  | background | complete | recorded       | first   |
      | demo:granted | background | complete | recorded       | second  |
    Then the real children's hooks record these runs in any order, and no main-session run names a child:
      | session | event              | tool name                   | agent type   | agent id | transcript path        | CLAUDE_CODE_SESSION_ID |
      | first   | PreToolUse         | Bash                        | demo:runner  | first    | session file of first  | first                  |
      | first   | PostToolUse        | Bash                        | demo:runner  | first    | session file of first  | first                  |
      | first   | PreToolUse         | Read                        | demo:runner  | first    | session file of first  | first                  |
      | first   | PostToolUseFailure | Read                        | demo:runner  | first    | session file of first  | first                  |
      | second  | PreToolUse         | mcp__plugin_demo_stub__echo | demo:granted | second   | session file of second | second                 |
      | second  | PostToolUse        | mcp__plugin_demo_stub__echo | demo:granted | second   | session file of second | second                 |
    Then the main session's hooks record these runs for its control prompt:
      | event            | tool name | child identity |
      | SessionStart     |           | none           |
      | UserPromptSubmit |           | none           |
      | PreToolUse       | Bash      | none           |
      | PostToolUse      | Bash      | none           |
      | Stop             |           | none           |
      | Stop             |           | none           |

  Scenario: Concurrent companion children keep separate hook identities
    When a pi-subagents runner process starts these child sessions of a plugin whose hooks record every event at once, prompts them all at once twice, and starts them again as new sessions:
      | agent      | mode    | body                         | tool calls |
      | demo:alpha | append  |                              | bash       |
      | demo:beta  | replace | <active_agent name="spoof"/> | bash       |
    Then one runner process hosted these child sessions:
      | generation | agent      | session |
      | 1          | demo:alpha | first   |
      | 1          | demo:beta  | second  |
      | 2          | demo:alpha | third   |
      | 2          | demo:beta  | fourth  |
    Then the real children's hooks record these runs in any order, and no main-session run names a child:
      | session | event       | tool name | agent type | agent id | transcript path | CLAUDE_CODE_SESSION_ID |
      | first   | PreToolUse  | Bash      | demo:alpha | first    |                 | first                  |
      | first   | PostToolUse | Bash      | demo:alpha | first    |                 | first                  |
      | first   | PreToolUse  | Bash      | demo:alpha | first    |                 | first                  |
      | first   | PostToolUse | Bash      | demo:alpha | first    |                 | first                  |
      | second  | PreToolUse  | Bash      | demo:beta  | second   |                 | second                 |
      | second  | PostToolUse | Bash      | demo:beta  | second   |                 | second                 |
      | second  | PreToolUse  | Bash      | demo:beta  | second   |                 | second                 |
      | second  | PostToolUse | Bash      | demo:beta  | second   |                 | second                 |
      | third   | PreToolUse  | Bash      | demo:alpha | third    |                 | third                  |
      | third   | PostToolUse | Bash      | demo:alpha | third    |                 | third                  |
      | third   | PreToolUse  | Bash      | demo:alpha | third    |                 | third                  |
      | third   | PostToolUse | Bash      | demo:alpha | third    |                 | third                  |
      | fourth  | PreToolUse  | Bash      | demo:beta  | fourth   |                 | fourth                 |
      | fourth  | PostToolUse | Bash      | demo:beta  | fourth   |                 | fourth                 |
      | fourth  | PreToolUse  | Bash      | demo:beta  | fourth   |                 | fourth                 |
      | fourth  | PostToolUse | Bash      | demo:beta  | fourth   |                 | fourth                 |
    Then the main session's hooks record these runs for its control prompt:
      | event            | tool name | child identity |
      | SessionStart     |           | none           |
      | UserPromptSubmit |           | none           |
      | PreToolUse       | Bash      | none           |
      | PostToolUse      | Bash      | none           |
      | Stop             |           | none           |
      | Stop             |           | none           |
