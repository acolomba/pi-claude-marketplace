Feature: Hook tool use

  A hook of a bridged plugin runs on a tool call the model makes, with the
  tool call in Claude's shape on its stdin. A scripted model stands in for a
  real one, and a hook that records each run stands in for a plugin's hook.
  The MCP scenarios differ by implementation: pi-mcp-adapter's proxy call runs
  no hook of its own (D-CF5-12), and under Pi's built-in MCP no call is a
  proxy call (MHK-02).
  A tool whose cut name has a proxy's shape is still a tool under either implementation.

  @mcp
  Scenario: An MCP result alias replaces the result
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name      | version |
      | hook-demo | 1.0.0   |
    Given the published plugin "hook-demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name  | event       | matcher                                 | form   | output |
      | alias | PostToolUse | mcp__plugin_hook-demo_stub-server__echo | script | {"hookSpecificOutput":{"hookEventName":"PostToolUse","updatedMCPToolOutput":[{"type":"text","text":"SAFE_ALIAS"}]}} |
    Given the published plugin "hook-demo" of the marketplace "fixtures" has the stub mcp server "stub-server" for its hooks
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install hook-demo@fixtures --scope user", which did not fail
    Given a stand-in registers the stub mcp server "stub-server" of the plugin "hook-demo" with pi's built-in mcp
    Given pi runs with the scripted model, the mcp implementation and a downstream result observer
    Given the mcp implementation has listed the tools of the stub mcp server "stub-server" of the plugin "hook-demo"
    Given the scripted model calls the tool "echo" of the hooks' stub mcp server "stub-server" of the plugin "hook-demo" through the mcp implementation with '{"text":"ping"}', then replies "Done."
    When the user prompts "call the stub"
    Then the hooks record these runs in any order:
      | event       | session | tool name                               | tool input      | tool response                                                                                                         | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                             | CLAUDE_PLUGIN_DATA                                        | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PostToolUse | first   | mcp__plugin_hook-demo_stub-server__echo | {"text":"ping"} | {"content":[{"type":"text","text":"echo:ping"}],"structuredContent":{"content":[{"type":"text","text":"echo:ping"}]}} | {project dir} |                 | alias     | {project dir}      | {home}/marketplaces/fixtures/plugins/hook-demo | {agent dir}/pi-claude-marketplace/data/fixtures/hook-demo | first                  | first             | 1          |
    Then another pi handler observes these complete mcp results:
      | profile | record |
      | adapter | {"toolName":"mcp__plugin_hook-demo_stub-server__echo","content":[{"type":"text","text":"SAFE_ALIAS"}],"details":{"server":"plugin_hook-demo_stub-server_","tool":"echo"},"structuredContent":null,"isError":false} |
      | adapter | {"toolName":"mcp","content":[{"type":"text","text":"SAFE_ALIAS"}],"details":{"server":"plugin_hook-demo_stub-server_","tool":"echo"},"structuredContent":null,"isError":false} |
      | builtin | {"toolName":"tool_search","content":[{"type":"text","text":"Loaded 1 tool. They are available from your next call:\\n- mcp__plugin_hook_demo_stub_server__echo: Echoes the text it is given."}],"details":{"loaded":["mcp__plugin_hook_demo_stub_server__echo"]},"structuredContent":null,"isError":false} |
      | builtin | {"toolName":"mcp__plugin_hook_demo_stub_server__echo","content":[{"type":"text","text":"SAFE_ALIAS"}],"details":{"server":"plugin_hook-demo_stub-server","tool":"echo"},"structuredContent":null,"isError":false} |
    Then the model receives these complete mcp calls:
      | profile | call | role        | text |
      | adapter | 1    | user        | call the stub |
      | adapter | 2    | user        | call the stub |
      | adapter | 2    | assistant   | tool call mcp {"tool":"mcp__plugin_hook-demo_stub-server__echo","args":{"text":"ping"}} |
      | adapter | 2    | tool result | mcp returned: SAFE_ALIAS |
      | builtin | 1    | user        | call the stub |
      | builtin | 2    | user        | call the stub |
      | builtin | 2    | assistant   | tool call tool_search {"query":"mcp__plugin_hook_demo_stub_server__echo","limit":1} |
      | builtin | 2    | tool result | tool_search returned: Loaded 1 tool. They are available from your next call:\n- mcp__plugin_hook_demo_stub_server__echo: Echoes the text it is given. |
      | builtin | 3    | user        | call the stub |
      | builtin | 3    | assistant   | tool call tool_search {"query":"mcp__plugin_hook_demo_stub_server__echo","limit":1} |
      | builtin | 3    | tool result | tool_search returned: Loaded 1 tool. They are available from your next call:\n- mcp__plugin_hook_demo_stub_server__echo: Echoes the text it is given. |
      | builtin | 3    | assistant   | tool call mcp__plugin_hook_demo_stub_server__echo {"text":"ping"} |
      | builtin | 3    | tool result | mcp__plugin_hook_demo_stub_server__echo returned: SAFE_ALIAS |

  @mcp
  Scenario: The modern MCP output wins when both fields are supplied
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name      | version |
      | hook-demo | 1.0.0   |
    Given the published plugin "hook-demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name  | event       | matcher                                 | form   | output |
      | modern | PostToolUse | mcp__plugin_hook-demo_stub-server__echo | script | {"hookSpecificOutput":{"hookEventName":"PostToolUse","updatedToolOutput":[{"type":"text","text":"SAFE_MODERN"}],"updatedMCPToolOutput":[{"type":"text","text":"SAFE_LEGACY"}]}} |
    Given the published plugin "hook-demo" of the marketplace "fixtures" has the stub mcp server "stub-server" for its hooks
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install hook-demo@fixtures --scope user", which did not fail
    Given a stand-in registers the stub mcp server "stub-server" of the plugin "hook-demo" with pi's built-in mcp
    Given pi runs with the scripted model, the mcp implementation and a downstream result observer
    Given the mcp implementation has listed the tools of the stub mcp server "stub-server" of the plugin "hook-demo"
    Given the scripted model calls the tool "echo" of the hooks' stub mcp server "stub-server" of the plugin "hook-demo" through the mcp implementation with '{"text":"ping"}', then replies "Done."
    When the user prompts "call the stub"
    Then the hooks record these runs in any order:
      | event       | session | tool name                               | tool input      | tool response                                                                                                         | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                             | CLAUDE_PLUGIN_DATA                                        | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PostToolUse | first   | mcp__plugin_hook-demo_stub-server__echo | {"text":"ping"} | {"content":[{"type":"text","text":"echo:ping"}],"structuredContent":{"content":[{"type":"text","text":"echo:ping"}]}} | {project dir} |                 | modern    | {project dir}      | {home}/marketplaces/fixtures/plugins/hook-demo | {agent dir}/pi-claude-marketplace/data/fixtures/hook-demo | first                  | first             | 1          |
    Then another pi handler observes these complete mcp results:
      | profile | record |
      | adapter | {"toolName":"mcp__plugin_hook-demo_stub-server__echo","content":[{"type":"text","text":"SAFE_MODERN"}],"details":{"server":"plugin_hook-demo_stub-server_","tool":"echo"},"structuredContent":null,"isError":false} |
      | adapter | {"toolName":"mcp","content":[{"type":"text","text":"SAFE_MODERN"}],"details":{"server":"plugin_hook-demo_stub-server_","tool":"echo"},"structuredContent":null,"isError":false} |
      | builtin | {"toolName":"tool_search","content":[{"type":"text","text":"Loaded 1 tool. They are available from your next call:\\n- mcp__plugin_hook_demo_stub_server__echo: Echoes the text it is given."}],"details":{"loaded":["mcp__plugin_hook_demo_stub_server__echo"]},"structuredContent":null,"isError":false} |
      | builtin | {"toolName":"mcp__plugin_hook_demo_stub_server__echo","content":[{"type":"text","text":"SAFE_MODERN"}],"details":{"server":"plugin_hook-demo_stub-server","tool":"echo"},"structuredContent":null,"isError":false} |
    Then the model receives these complete mcp calls:
      | profile | call | role        | text |
      | adapter | 1    | user        | call the stub |
      | adapter | 2    | user        | call the stub |
      | adapter | 2    | assistant   | tool call mcp {"tool":"mcp__plugin_hook-demo_stub-server__echo","args":{"text":"ping"}} |
      | adapter | 2    | tool result | mcp returned: SAFE_MODERN |
      | builtin | 1    | user        | call the stub |
      | builtin | 2    | user        | call the stub |
      | builtin | 2    | assistant   | tool call tool_search {"query":"mcp__plugin_hook_demo_stub_server__echo","limit":1} |
      | builtin | 2    | tool result | tool_search returned: Loaded 1 tool. They are available from your next call:\n- mcp__plugin_hook_demo_stub_server__echo: Echoes the text it is given. |
      | builtin | 3    | user        | call the stub |
      | builtin | 3    | assistant   | tool call tool_search {"query":"mcp__plugin_hook_demo_stub_server__echo","limit":1} |
      | builtin | 3    | tool result | tool_search returned: Loaded 1 tool. They are available from your next call:\n- mcp__plugin_hook_demo_stub_server__echo: Echoes the text it is given. |
      | builtin | 3    | assistant   | tool call mcp__plugin_hook_demo_stub_server__echo {"text":"ping"} |
      | builtin | 3    | tool result | mcp__plugin_hook_demo_stub_server__echo returned: SAFE_MODERN |

  Scenario: A legacy MCP output field does not replace a built-in result
    Given pi runs with the scripted model and a downstream file result observer
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name   | event       | matcher | form   | output |
      | legacy | PostToolUse | Read    | script | {"hookSpecificOutput":{"hookEventName":"PostToolUse","updatedMCPToolOutput":[{"type":"text","text":"MALICIOUS"}]}} |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the project holds the file "visible.txt" with the text "ORIGINAL" for a tool hook
    Given the scripted model plays these steps:
      | reply | tool | arguments              |
      |       | read | {"path":"visible.txt"} |
      | Done. |      |                        |
    When the user prompts "read the file"
    Then the hooks record these runs:
      | event       | session | tool name | tool input                                   | tool response                                                                 | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PostToolUse | first   | Read      | {"file_path":"{project dir}/visible.txt"} | {"type":"text","file":{"filePath":"{project dir}/visible.txt","content":"ORIGINAL","startLine":1,"numLines":1,"totalLines":1}} | {project dir} |                 | legacy    | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then another pi handler observes these complete file results:
      | record |
      | {"toolName":"read","content":[{"type":"text","text":"ORIGINAL"}],"details":null,"structuredContent":"ORIGINAL","isError":false} |
    Then the model receives these calls:
      | call | role        | text |
      | 1    | user        | read the file |
      | 2    | user        | read the file |
      | 2    | assistant   | tool call read {"path":"visible.txt"} |
      | 2    | tool result | read returned: ORIGINAL |

  Scenario: A search result replacement changes what the model receives
    Given pi runs with the scripted model and search tools
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name    | event       | matcher | form   | output |
      | replace | PostToolUse | Glob    | script | {"hookSpecificOutput":{"hookEventName":"PostToolUse","updatedToolOutput":{"filenames":["SAFE_PATH"]}}} |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the project holds the file "secret.md" with the text "OLD_SECRET" for a tool hook
    Given the scripted model plays these steps:
      | reply | tool | arguments            |
      |       | find | {"pattern":"*.md"}  |
      | Done. |      |                      |
    When the user prompts "find the secret"
    Then another pi handler observes these complete file results:
      | record |
      | {"toolName":"find","content":[{"type":"text","text":"SAFE_PATH"}],"details":null,"structuredContent":null,"isError":false} |
    Then the model receives these calls:
      | call | role        | text                              |
      | 1    | user        | find the secret                   |
      | 2    | user        | find the secret                   |
      | 2    | assistant   | tool call find {"pattern":"*.md"} |
      | 2    | tool result | find returned: SAFE_PATH          |

  Scenario: Search output resembling a notice remains actual tool content
    Given pi runs with the scripted model and search tools
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name  | event       | matcher |
      | after | PostToolUse | Grep    |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the project holds the file "notice.txt" with the text "[2 matches limit reached]" for a tool hook
    Given the scripted model plays these steps:
      | reply | tool | arguments                                         |
      |       | grep | {"pattern":"matches","path":"notice.txt"} |
      | Done. |      |                                                   |
    When the user prompts "search the notice"
    Then the hooks record these runs:
      | event       | session | tool name | tool input | tool response | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PostToolUse | first   | Grep      | {"pattern":"matches","path":"notice.txt","output_mode":"content","-n":true,"head_limit":100} | {"mode":"content","content":"notice.txt:1: [2 matches limit reached]","numLines":1} | {project dir} |                 | after     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then another pi handler observes these complete file results:
      | record |
      | {"toolName":"grep","content":[{"type":"text","text":"notice.txt:1: [2 matches limit reached]"}],"details":null,"structuredContent":null,"isError":false} |
    Then the model receives these calls:
      | call | role        | text                                               |
      | 1    | user        | search the notice                                  |
      | 2    | user        | search the notice                                  |
      | 2    | assistant   | tool call grep {"pattern":"matches","path":"notice.txt"} |
      | 2    | tool result | grep returned: notice.txt:1: [2 matches limit reached] |

  Scenario: A filename matching the empty search notice does not claim zero files
    Given pi runs with the scripted model and search tools
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name  | event       | matcher |
      | after | PostToolUse | Glob    |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the project holds the file "No files found matching pattern" with the text "present" for a tool hook
    Given the scripted model plays these steps:
      | reply | tool | arguments                                     |
      |       | find | {"pattern":"No files found matching pattern"} |
      | Done. |      |                                               |
    When the user prompts "search the notice"
    Then the hooks record these runs:
      | event       | session | tool name | tool input                                    | tool response | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PostToolUse | first   | Glob      | {"pattern":"No files found matching pattern"} | {}            | {project dir} |                 | after     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then another pi handler observes these complete file results:
      | record                                                                                                                                           |
      | {"toolName":"find","content":[{"type":"text","text":"No files found matching pattern"}],"details":null,"structuredContent":null,"isError":false} |
    Then the model receives these calls:
      | call | role        | text                                                         |
      | 1    | user        | search the notice                                            |
      | 2    | user        | search the notice                                            |
      | 2    | assistant   | tool call find {"pattern":"No files found matching pattern"} |
      | 2    | tool result | find returned: No files found matching pattern               |


  Scenario: A shell result replacement preserves supplied images
    Given pi runs with the scripted model and a downstream file result observer
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name    | event       | matcher | form   | output |
      | replace | PostToolUse | Bash    | script | {"hookSpecificOutput":{"hookEventName":"PostToolUse","updatedToolOutput":{"structuredContent":[{"type":"image","data":"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQI12NgYPj/HwADAgH/HXJk1AAAAABJRU5ErkJggg==","mimeType":"image/png"}],"persistedOutputPath":"/tmp/DO_NOT_READ"}}} |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply | tool | arguments                        |
      |       | bash | {"command":"printf OLD_SECRET"} |
      | Done. |      |                                  |
    When the user prompts "run the shell"
    Then another pi handler observes these complete file results:
      | record |
      | {"toolName":"bash","content":[{"type":"image","data":"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQI12NgYPj/HwADAgH/HXJk1AAAAABJRU5ErkJggg==","mimeType":"image/png"}],"details":null,"structuredContent":null,"isError":false} |
    Then the model receives these calls:
      | call | role        | text                                             |
      | 1    | user        | run the shell                                    |
      | 2    | user        | run the shell                                    |
      | 2    | assistant   | tool call bash {"command":"printf OLD_SECRET"} |
      | 2    | tool result | bash returned: image                             |

  Scenario: An empty search or shell replacement clears original output for Glob
    Given pi runs with the scripted model and search tools
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name    | event       | matcher | form   | output                                                                                      |
      | replace | PostToolUse | Glob    | script | {"hookSpecificOutput":{"hookEventName":"PostToolUse","updatedToolOutput":{"filenames":[]}}} |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the project holds the file "secret.md" with the text "OLD_SECRET" for a tool hook
    Given the scripted model plays these steps:
      | reply | tool | arguments          |
      |       | find | {"pattern":"*.md"} |
      | Done. |      |                    |
    When the user prompts "clear output"
    Then another pi handler observes these complete file results:
      | record                                                                                                            |
      | {"toolName":"find","content":[{"type":"text","text":""}],"details":null,"structuredContent":null,"isError":false} |
    Then the model receives these calls, with an empty tool result:
      | call | role        | text                              |
      | 1    | user        | clear output                      |
      | 2    | user        | clear output                      |
      | 2    | assistant   | tool call find {"pattern":"*.md"} |
      | 2    | tool result | find returned: <empty>            |

  Scenario: An empty search or shell replacement clears original output for Bash
    Given pi runs with the scripted model and search tools
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name    | event       | matcher | form   | output                                                                                   |
      | replace | PostToolUse | Bash    | script | {"hookSpecificOutput":{"hookEventName":"PostToolUse","updatedToolOutput":{"stdout":""}}} |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the project holds the file "secret.md" with the text "OLD_SECRET" for a tool hook
    Given the scripted model plays these steps:
      | reply | tool | arguments                       |
      |       | bash | {"command":"printf OLD_SECRET"} |
      | Done. |      |                                 |
    When the user prompts "clear output"
    Then another pi handler observes these complete file results:
      | record                                                                                                            |
      | {"toolName":"bash","content":[{"type":"text","text":""}],"details":null,"structuredContent":null,"isError":false} |
    Then the model receives these calls, with an empty tool result:
      | call | role        | text                                           |
      | 1    | user        | clear output                                   |
      | 2    | user        | clear output                                   |
      | 2    | assistant   | tool call bash {"command":"printf OLD_SECRET"} |
      | 2    | tool result | bash returned: <empty>                         |

  Scenario: A file result replacement changes what the model reads
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name    | event       | matcher | form   | output                                                                                         |
      | replace | PostToolUse | Read    | script | {"hookSpecificOutput":{"hookEventName":"PostToolUse","updatedToolOutput":{"type":"text","file":{"content":"safe"}}}} |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the project holds the file "secret.txt" with the text "OLD_SECRET" for a tool hook
    Given the scripted model plays these steps:
      | reply | tool | arguments             |
      |       | read | {"path":"secret.txt"} |
      | Done. |      |                       |
    When the user prompts "read the secret"
    Then the project file "secret.txt" has the text "OLD_SECRET" after a tool hook
    Then the model receives these calls:
      | call | role        | text                                  |
      | 1    | user        | read the secret                       |
      | 2    | user        | read the secret                       |
      | 2    | assistant   | tool call read {"path":"secret.txt"} |
      | 2    | tool result | read returned: safe                   |

  Scenario: A redacted result leaves no original data for another Pi handler
    Given pi runs with the scripted model and a downstream file result observer
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name    | event       | matcher | form   | output                                                                                         |
      | replace | PostToolUse | Read    | script | {"hookSpecificOutput":{"hookEventName":"PostToolUse","updatedToolOutput":{"type":"text","file":{"content":"safe"}}}} |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the project holds the file "secret.txt" with the text "OLD_TEXT_SECRET" for a tool hook
    Given the scripted model plays these steps:
      | reply | tool | arguments             |
      |       | read | {"path":"secret.txt"} |
      | Done. |      |                       |
    When the user prompts "read the secret"
    Then another pi handler observes these complete file results:
      | record                                                                                       |
      | {"toolName":"read","content":[{"type":"text","text":"safe"}],"details":null,"structuredContent":null,"isError":false} |
    Then the model receives these calls:
      | call | role        | text                                  |
      | 1    | user        | read the secret                       |
      | 2    | user        | read the secret                       |
      | 2    | assistant   | tool call read {"path":"secret.txt"} |
      | 2    | tool result | read returned: safe                   |

  Scenario: An image result replacement preserves only the supplied image
    Given pi runs with the scripted model and a downstream file result observer
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name    | event       | matcher | form   | output |
      | replace | PostToolUse | Read    | script | {"hookSpecificOutput":{"hookEventName":"PostToolUse","updatedToolOutput":{"type":"image","file":{"base64":"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQI12NgYPj/HwADAgH/HXJk1AAAAABJRU5ErkJggg==","type":"image/png"}}}} |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the project holds the tiny red image "original.png" for a tool hook
    Given the scripted model plays these steps:
      | reply | tool | arguments               |
      |       | read | {"path":"original.png"} |
      | Done. |      |                         |
    When the user prompts "read the image"
    Then the tiny red image "original.png" is unchanged after a tool hook
    Then another pi handler observes these complete file results:
      | record |
      | {"toolName":"read","content":[{"type":"image","data":"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQI12NgYPj/HwADAgH/HXJk1AAAAABJRU5ErkJggg==","mimeType":"image/png"}],"details":null,"structuredContent":null,"isError":false} |
    Then the model receives these calls:
      | call | role        | text                                    |
      | 1    | user        | read the image                          |
      | 2    | user        | read the image                          |
      | 2    | assistant   | tool call read {"path":"original.png"} |
      | 2    | tool result | read returned: image                    |

  Scenario: An empty replacement removes the original file result
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name    | event       | matcher | form   | output                                                                                     |
      | replace | PostToolUse | Read    | script | {"hookSpecificOutput":{"hookEventName":"PostToolUse","updatedToolOutput":{"type":"text","file":{"content":""}}}} |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the project holds the file "secret.txt" with the text "OLD_SECRET" for a tool hook
    Given the scripted model plays these steps:
      | reply | tool | arguments             |
      |       | read | {"path":"secret.txt"} |
      | Done. |      |                       |
    When the user prompts "read the secret"
    Then the project file "secret.txt" has the text "OLD_SECRET" after a tool hook
    Then the model receives these calls, with an empty file result:
      | call | role        | text                                  |
      | 1    | user        | read the secret                       |
      | 2    | user        | read the secret                       |
      | 2    | assistant   | tool call read {"path":"secret.txt"} |
      | 2    | tool result | read returned: <empty>                |

  Scenario: Every edit result hook receives the same actual batch result
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name  | event       | matcher |
      | after | PostToolUse | Edit    |
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
      | event       | session | tool name | tool input                                                                            | tool response                                                                         | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PostToolUse | first   | Edit      | {"file_path":"{project dir}/document.txt","old_string":"first","new_string":"one"}   | {"filePath":"{project dir}/document.txt","oldString":"first","newString":"one","replaceAll":false,"structuredPatch":[{"oldStart":1,"oldLines":3,"newStart":1,"newLines":3,"lines":["-first","+one"," middle","-second","+two"]}]} | {project dir} |                 | after     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
      | PostToolUse | first   | Edit      | {"file_path":"{project dir}/document.txt","old_string":"second","new_string":"two"} | {"filePath":"{project dir}/document.txt","oldString":"second","newString":"two","replaceAll":false,"structuredPatch":[{"oldStart":1,"oldLines":3,"newStart":1,"newLines":3,"lines":["-first","+one"," middle","-second","+two"]}]} | {project dir} |                 | after     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the project file "document.txt" has the text "one\nmiddle\ntwo\n" after a tool hook
    Then the model receives these calls:
      | call | role        | text                                                                                                                     |
      | 1    | user        | edit both blocks                                                                                                         |
      | 2    | user        | edit both blocks                                                                                                         |
      | 2    | assistant   | tool call edit {"path":"document.txt","edits":[{"oldText":"first","newText":"one"},{"oldText":"second","newText":"two"}]} |
      | 2    | tool result | edit returned: Successfully replaced 2 block(s) in document.txt.                                                       |

  Scenario: An earlier edit result rewrite does not change later hook stdin
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name    | event       | matcher | form   | output                                                                                                                     |
      | replace | PostToolUse | Edit    | script | {"hookSpecificOutput":{"hookEventName":"PostToolUse","updatedToolOutput":{"filePath":"{project dir}/document.txt","newString":"replaced"}}} |
      | observe | PostToolUse | Edit    |        |                                                                                                                            |
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
      | event       | session | tool name | tool input                                                                            | tool response                                                                         | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PostToolUse | first   | Edit      | {"file_path":"{project dir}/document.txt","old_string":"first","new_string":"one"}   | {"filePath":"{project dir}/document.txt","oldString":"first","newString":"one","replaceAll":false,"structuredPatch":[{"oldStart":1,"oldLines":3,"newStart":1,"newLines":3,"lines":["-first","+one"," middle","-second","+two"]}]} | {project dir} |                 | replace   | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
      | PostToolUse | first   | Edit      | {"file_path":"{project dir}/document.txt","old_string":"first","new_string":"one"}   | {"filePath":"{project dir}/document.txt","oldString":"first","newString":"one","replaceAll":false,"structuredPatch":[{"oldStart":1,"oldLines":3,"newStart":1,"newLines":3,"lines":["-first","+one"," middle","-second","+two"]}]} | {project dir} |                 | observe   | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
      | PostToolUse | first   | Edit      | {"file_path":"{project dir}/document.txt","old_string":"second","new_string":"two"} | {"filePath":"{project dir}/document.txt","oldString":"second","newString":"two","replaceAll":false,"structuredPatch":[{"oldStart":1,"oldLines":3,"newStart":1,"newLines":3,"lines":["-first","+one"," middle","-second","+two"]}]} | {project dir} |                 | replace   | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
      | PostToolUse | first   | Edit      | {"file_path":"{project dir}/document.txt","old_string":"second","new_string":"two"} | {"filePath":"{project dir}/document.txt","oldString":"second","newString":"two","replaceAll":false,"structuredPatch":[{"oldStart":1,"oldLines":3,"newStart":1,"newLines":3,"lines":["-first","+one"," middle","-second","+two"]}]} | {project dir} |                 | observe   | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the project file "document.txt" has the text "one\nmiddle\ntwo\n" after a tool hook
    Then the model receives these calls:
      | call | role        | text                                                                                                                     |
      | 1    | user        | edit both blocks                                                                                                         |
      | 2    | user        | edit both blocks                                                                                                         |
      | 2    | assistant   | tool call edit {"path":"document.txt","edits":[{"oldText":"first","newText":"one"},{"oldText":"second","newText":"two"}]} |
      | 2    | tool result | edit returned: {project dir}/document.txt: replaced                                                                     |

  Scenario: A hook sees each edit pair before the batch runs
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name  | event      | matcher |
      | guard | PreToolUse | Edit    |
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
      | event      | session | tool name | tool input                                                                              | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse | first   | Edit      | {"file_path":"{project dir}/document.txt","old_string":"first","new_string":"one"}   | {project dir} |                 | guard     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
      | PreToolUse | first   | Edit      | {"file_path":"{project dir}/document.txt","old_string":"second","new_string":"two"} | {project dir} |                 | guard     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the project file "document.txt" has the text "one\nmiddle\ntwo\n" after a tool hook
    Then the model receives these calls:
      | call | role        | text                                                                                                                     |
      | 1    | user        | edit both blocks                                                                                                         |
      | 2    | user        | edit both blocks                                                                                                         |
      | 2    | assistant   | tool call edit {"path":"document.txt","edits":[{"oldText":"first","newText":"one"},{"oldText":"second","newText":"two"}]} |
      | 2    | tool result | edit returned: Successfully replaced 2 block(s) in document.txt.                                                        |

  Scenario: An edit hook rewrites its corresponding pair
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name    | event      | matcher | form   | when old string | matched output                                                                                                                                |
      | rewrite | PreToolUse | Edit    | script | first           | {"hookSpecificOutput":{"hookEventName":"PreToolUse","updatedInput":{"file_path":"document.txt","old_string":"first","new_string":"ONE"}}} |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the project holds the file "document.txt" with the text "first\nmiddle\nsecond\n" for a tool hook
    Given the scripted model plays these steps:
      | reply | tool | arguments                                                                                                        |
      |       | edit | {"path":"document.txt","edits":[{"oldText":"first","newText":"one"},{"oldText":"second","newText":"two"}]} |
      | Done. |      |                                                                                                                  |
    When the user prompts "rewrite the first edit"
    Then the hooks record these runs in any order:
      | event      | session | tool name | tool input                                                                              | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse | first   | Edit      | {"file_path":"{project dir}/document.txt","old_string":"first","new_string":"one"}   | {project dir} |                 | rewrite   | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
      | PreToolUse | first   | Edit      | {"file_path":"{project dir}/document.txt","old_string":"second","new_string":"two"} | {project dir} |                 | rewrite   | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the project file "document.txt" has the text "ONE\nmiddle\ntwo\n" after a tool hook

  Scenario: A denial of the second edit pair leaves the whole file unchanged
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name  | event      | matcher | form   | when old string | output                                                                                                                            | matched output                                                                                                                        |
      | guard | PreToolUse | Edit    | script | second          | {"hookSpecificOutput":{"hookEventName":"PreToolUse","updatedInput":{"file_path":"document.txt","old_string":"first","new_string":"ONE"}}} | {"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"second denied"}} |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the project holds the file "document.txt" with the text "first\nmiddle\nsecond\n" for a tool hook
    Given the scripted model plays these steps:
      | reply | tool | arguments                                                                                                        |
      |       | edit | {"path":"document.txt","edits":[{"oldText":"first","newText":"one"},{"oldText":"second","newText":"two"}]} |
      | Done. |      |                                                                                                                  |
    When the user prompts "deny the second edit"
    Then the hooks record these runs in any order:
      | event      | session | tool name | tool input                                                                              | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse | first   | Edit      | {"file_path":"{project dir}/document.txt","old_string":"first","new_string":"one"}   | {project dir} |                 | guard     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
      | PreToolUse | first   | Edit      | {"file_path":"{project dir}/document.txt","old_string":"second","new_string":"two"} | {project dir} |                 | guard     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the project file "document.txt" has the text "first\nmiddle\nsecond\n" after a tool hook

  Scenario: A stop from a later edit pair prevents the whole call
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name  | event      | matcher | form   | when old string | output                                                                                                                            | matched output                                       |
      | guard | PreToolUse | Edit    | script | second          | {"hookSpecificOutput":{"hookEventName":"PreToolUse","updatedInput":{"file_path":"document.txt","old_string":"first","new_string":"ONE"}}} | {"continue":false,"stopReason":"later stop"} |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the project holds the file "document.txt" with the text "first\nmiddle\nsecond\n" for a tool hook
    Given the scripted model plays these steps:
      | reply | tool | arguments                                                                                                        |
      |       | edit | {"path":"document.txt","edits":[{"oldText":"first","newText":"one"},{"oldText":"second","newText":"two"}]} |
    When the user prompts "stop the second edit"
    Then the hooks record these runs in any order:
      | event      | session | tool name | tool input                                                                              | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse | first   | Edit      | {"file_path":"{project dir}/document.txt","old_string":"first","new_string":"one"}   | {project dir} |                 | guard     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
      | PreToolUse | first   | Edit      | {"file_path":"{project dir}/document.txt","old_string":"second","new_string":"two"} | {project dir} |                 | guard     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the project file "document.txt" has the text "first\nmiddle\nsecond\n" after a tool hook

  Scenario: An unsupported later edit pair keeps every original replacement
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name  | event      | matcher | form   | when old string | output                                                                                                                            | matched output                                                                                                                               |
      | guard | PreToolUse | Edit    | script | second          | {"hookSpecificOutput":{"hookEventName":"PreToolUse","updatedInput":{"file_path":"document.txt","old_string":"first","new_string":"ONE"}}} | {"hookSpecificOutput":{"hookEventName":"PreToolUse","updatedInput":{"file_path":"document.txt","old_string":"second","new_string":"TWO","replace_all":true}}} |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the project holds the file "document.txt" with the text "first\nmiddle\nsecond\n" for a tool hook
    Given the scripted model plays these steps:
      | reply | tool | arguments                                                                                                        |
      |       | edit | {"path":"document.txt","edits":[{"oldText":"first","newText":"one"},{"oldText":"second","newText":"two"}]} |
      | Done. |      |                                                                                                                  |
    When the user prompts "ignore the unsupported edit"
    Then the hooks record these runs in any order:
      | event      | session | tool name | tool input                                                                              | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse | first   | Edit      | {"file_path":"{project dir}/document.txt","old_string":"first","new_string":"one"}   | {project dir} |                 | guard     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
      | PreToolUse | first   | Edit      | {"file_path":"{project dir}/document.txt","old_string":"second","new_string":"two"} | {project dir} |                 | guard     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the hooks show the user these messages:
      | severity | text                                                |
      | info     | PreToolUse:Edit ignored input rewrite (value)       |
    Then the project file "document.txt" has the text "one\nmiddle\ntwo\n" after a tool hook

  Scenario Outline: Edit preflight handles <case>
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name  | event      | matcher | form   | when old string | output         | matched output |
      | guard | PreToolUse | Edit    | script | second          | <first output> | <second output> |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the project holds the file "document.txt" with the text "first\nmiddle\nsecond\n" for a tool hook
    Given the project holds the file "other.txt" with the text "other\n" for a tool hook
    Given the scripted model plays these steps:
      | reply | tool | arguments                                                                                                        |
      |       | edit | {"path":"document.txt","edits":[{"oldText":"first","newText":"one"},{"oldText":"second","newText":"two"}]} |
      | Done. |      |                                                                                                                  |
    When the user prompts "try conflicting edits"
    Then the hooks record these runs in any order:
      | event      | session | tool name | tool input                                                                              | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse | first   | Edit      | {"file_path":"{project dir}/document.txt","old_string":"first","new_string":"one"}   | {project dir} |                 | guard     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
      | PreToolUse | first   | Edit      | {"file_path":"{project dir}/document.txt","old_string":"second","new_string":"two"} | {project dir} |                 | guard     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the project file "document.txt" has the text "first\nmiddle\nsecond\n" after a tool hook
    Then the project file "other.txt" has the text "other\n" after a tool hook
    Then the model receives these calls:
      | call | role        | text                                                                                                                     |
      | 1    | user        | try conflicting edits                                                                                                    |
      | 2    | user        | try conflicting edits                                                                                                    |
      | 2    | assistant   | tool call edit {"path":"document.txt","edits":[{"oldText":"first","newText":"one"},{"oldText":"second","newText":"two"}]} |
      | 2    | tool result | edit failed: PreToolUse:Edit hook error: conflicting edit targets                                                         |

    Examples:
      | case                                                     | first output                                                                                                                              | second output                                                                                                                                       |
      | Conflicting accepted edit targets block the whole batch | {"hookSpecificOutput":{"hookEventName":"PreToolUse","updatedInput":{"file_path":"other.txt","old_string":"first","new_string":"ONE"}}} | {"hookSpecificOutput":{"hookEventName":"PreToolUse","updatedInput":{"file_path":"document.txt","old_string":"second","new_string":"TWO"}}} |
      | An unchanged edit pair prevents a conflicting redirect  | {"hookSpecificOutput":{"hookEventName":"PreToolUse","updatedInput":{"file_path":"other.txt","old_string":"first","new_string":"ONE"}}} |                                                                                                                                                     |
      | An unsupported option does not hide conflicting edit targets | {"hookSpecificOutput":{"hookEventName":"PreToolUse","updatedInput":{"file_path":"other.txt","old_string":"first","new_string":"ONE"}}} | {"hookSpecificOutput":{"hookEventName":"PreToolUse","updatedInput":{"file_path":"document.txt","old_string":"second","new_string":"TWO","replace_all":true}}} |

  Scenario: A PreToolUse hook runs once for a scripted bash call with Claude's tool name and input
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name       | event      | matcher |
      | bash-guard | PreToolUse | Bash    |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply | tool | arguments                      |
      |       | bash | {"command": "echo from-model"} |
      | Done. |      |                                |
    When the user prompts "run the echo"
    Then the hooks record these runs:
      | event      | session | tool name | tool input                    | cwd           | transcript path | arguments  | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse | first   | Bash      | {"command":"echo from-model"} | {project dir} |                 | bash-guard | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the model receives these calls:
      | call | role        | text                                         |
      | 1    | user        | run the echo                                 |
      | 2    | user        | run the echo                                 |
      | 2    | assistant   | tool call bash {"command":"echo from-model"} |
      | 2    | tool result | bash returned: from-model\n                  |

  Scenario: A PreToolUse hook's deny decision blocks the tool call even when the hook exits 1
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name  | event      | matcher | form   | exit code | output                                                                                                                 |
      | guard | PreToolUse | Bash    | script | 1         | {"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"no echo"}} |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply | tool | arguments                      |
      |       | bash | {"command": "echo from-model"} |
      | Done. |      |                                |
    When the user prompts "run the echo"
    Then the hooks record these runs:
      | event      | session | tool name | tool input                    | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse | first   | Bash      | {"command":"echo from-model"} | {project dir} |                 | guard     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the model receives these calls:
      | call | role        | text                                             |
      | 1    | user        | run the echo                                     |
      | 2    | user        | run the echo                                     |
      | 2    | assistant   | tool call bash {"command":"echo from-model"}     |
      | 2    | tool result | bash failed: PreToolUse:Bash hook error: no echo |

  Scenario: A PreToolUse hook that exits 2 blocks the tool call with its command and stderr
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name  | event      | matcher | form   | exit code | stderr            |
      | guard | PreToolUse | Bash    | script | 2         | blocked by policy |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply | tool | arguments                      |
      |       | bash | {"command": "echo from-model"} |
      | Done. |      |                                |
    When the user prompts "run the echo"
    Then the hooks record these runs:
      | event      | session | tool name | tool input                    | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse | first   | Bash      | {"command":"echo from-model"} | {project dir} |                 | guard     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the model receives these calls:
      | call | role        | text                                                                                               |
      | 1    | user        | run the echo                                                                                       |
      | 2    | user        | run the echo                                                                                       |
      | 2    | assistant   | tool call bash {"command":"echo from-model"}                                                       |
      | 2    | tool result | bash failed: PreToolUse:Bash hook error: [${CLAUDE_PLUGIN_ROOT}/hooks/guard.sh]: blocked by policy |

  Scenario: A PreToolUse hook that fails with onFailure block shows the model Claude Code's message
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name  | event      | matcher | form   | exit code | stderr | on failure |
      | guard | PreToolUse | Bash    | script | 1         | boom   | block      |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply | tool | arguments                      |
      |       | bash | {"command": "echo from-model"} |
      | Done. |      |                                |
    When the user prompts "run the echo"
    Then the hooks record these runs:
      | event      | session | tool name | tool input                    | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse | first   | Bash      | {"command":"echo from-model"} | {project dir} |                 | guard     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the model receives these calls:
      | call | role        | text                                                                                                                                 |
      | 1    | user        | run the echo                                                                                                                         |
      | 2    | user        | run the echo                                                                                                                         |
      | 2    | assistant   | tool call bash {"command":"echo from-model"}                                                                                         |
      | 2    | tool result | bash failed: PreToolUse:Bash hook error: [${CLAUDE_PLUGIN_ROOT}/hooks/guard.sh]: failed; blocking because onFailure is "block"\nboom |

  Scenario: A PreToolUse hook with onFailure block that fails after printing more than 1 MB blocks the tool call
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name  | event      | matcher | form   | output bytes | exit code | on failure |
      | guard | PreToolUse | Bash    | script | 1048577      | 1         | block      |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply | tool | arguments                      |
      |       | bash | {"command": "echo from-model"} |
      | Done. |      |                                |
    When the user prompts "run the echo"
    Then the hooks record these runs:
      | event      | session | tool name | tool input                    | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse | first   | Bash      | {"command":"echo from-model"} | {project dir} |                 | guard     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the model receives these calls:
      | call | role        | text                                                                                                                           |
      | 1    | user        | run the echo                                                                                                                   |
      | 2    | user        | run the echo                                                                                                                   |
      | 2    | assistant   | tool call bash {"command":"echo from-model"}                                                                                   |
      | 2    | tool result | bash failed: PreToolUse:Bash hook error: [${CLAUDE_PLUGIN_ROOT}/hooks/guard.sh]: failed; blocking because onFailure is "block" |

  Scenario: A PreToolUse hook that exits 2 after printing more than 1 MB blocks the tool call with its stderr
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name  | event      | matcher | form   | stderr            | output bytes | exit code |
      | guard | PreToolUse | Bash    | script | blocked by policy | 1048577      | 2         |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply | tool | arguments                      |
      |       | bash | {"command": "echo from-model"} |
      | Done. |      |                                |
    When the user prompts "run the echo"
    Then the hooks record these runs:
      | event      | session | tool name | tool input                    | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse | first   | Bash      | {"command":"echo from-model"} | {project dir} |                 | guard     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the model receives these calls:
      | call | role        | text                                                                                               |
      | 1    | user        | run the echo                                                                                       |
      | 2    | user        | run the echo                                                                                       |
      | 2    | assistant   | tool call bash {"command":"echo from-model"}                                                       |
      | 2    | tool result | bash failed: PreToolUse:Bash hook error: [${CLAUDE_PLUGIN_ROOT}/hooks/guard.sh]: blocked by policy |

  Scenario: A PreToolUse hook's deny decision larger than 1 MB blocks the tool call
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name  | event      | matcher | form   | output                                                                                                                                      | output bytes | trailing output |
      | guard | PreToolUse | Bash    | script | {"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"too large to skip"},"padding":" | 1048577      | "}              |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply | tool | arguments                      |
      |       | bash | {"command": "echo from-model"} |
      | Done. |      |                                |
    When the user prompts "run the echo"
    Then the hooks record these runs:
      | event      | session | tool name | tool input                    | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse | first   | Bash      | {"command":"echo from-model"} | {project dir} |                 | guard     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the model receives these calls:
      | call | role        | text                                                       |
      | 1    | user        | run the echo                                               |
      | 2    | user        | run the echo                                               |
      | 2    | assistant   | tool call bash {"command":"echo from-model"}               |
      | 2    | tool result | bash failed: PreToolUse:Bash hook error: too large to skip |

  Scenario: A PreToolUse hook's deny decision keeps its own reason when the hook exits 1 with onFailure block
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name  | event      | matcher | form   | exit code | stderr | output                                                                                                                 | on failure |
      | guard | PreToolUse | Bash    | script | 1         | boom   | {"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"no echo"}} | block      |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply | tool | arguments                      |
      |       | bash | {"command": "echo from-model"} |
      | Done. |      |                                |
    When the user prompts "run the echo"
    Then the hooks record these runs:
      | event      | session | tool name | tool input                    | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse | first   | Bash      | {"command":"echo from-model"} | {project dir} |                 | guard     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the model receives these calls:
      | call | role        | text                                             |
      | 1    | user        | run the echo                                     |
      | 2    | user        | run the echo                                     |
      | 2    | assistant   | tool call bash {"command":"echo from-model"}     |
      | 2    | tool result | bash failed: PreToolUse:Bash hook error: no echo |

  Scenario: A PreToolUse hook with onFailure block that prints an unclosed JSON object lets the tool call run
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name  | event      | matcher | form   | output    | on failure |
      | guard | PreToolUse | Bash    | script | {not json | block      |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply | tool | arguments                      |
      |       | bash | {"command": "echo from-model"} |
      | Done. |      |                                |
    When the user prompts "run the echo"
    Then the hooks record these runs:
      | event      | session | tool name | tool input                    | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse | first   | Bash      | {"command":"echo from-model"} | {project dir} |                 | guard     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the model receives these calls:
      | call | role        | text                                         |
      | 1    | user        | run the echo                                 |
      | 2    | user        | run the echo                                 |
      | 2    | assistant   | tool call bash {"command":"echo from-model"} |
      | 2    | tool result | bash returned: from-model\n                  |

  Scenario: Matching PreToolUse hooks run in parallel
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name  | event      | matcher | form   | meets |
      | left  | PreToolUse | Bash    | script | right |
      | right | PreToolUse | Bash    | script | left  |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply | tool | arguments                      |
      |       | bash | {"command": "echo from-model"} |
      | Done. |      |                                |
    When the user prompts "run the echo"
    Then the hooks record these runs in any order:
      | event      | session | tool name | tool input                    | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse | first   | Bash      | {"command":"echo from-model"} | {project dir} |                 | left met  | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
      | PreToolUse | first   | Bash      | {"command":"echo from-model"} | {project dir} |                 | right met | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |

  Scenario: Identical hooks of one plugin run once
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name  | event      | matcher |
      | guard | PreToolUse | Bash    |
      | guard | PreToolUse | *       |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply | tool | arguments                      |
      |       | bash | {"command": "echo from-model"} |
      | Done. |      |                                |
    When the user prompts "run the echo"
    Then the hooks record these runs:
      | event      | session | tool name | tool input                    | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse | first   | Bash      | {"command":"echo from-model"} | {project dir} |                 | guard     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |

  Scenario: The same hook in two plugins runs once for each plugin
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name  | version |
      | alpha | 1.0.0   |
      | beta  | 1.0.0   |
    Given the published plugin "alpha" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name  | event      | matcher |
      | guard | PreToolUse | Bash    |
    Given the published plugin "beta" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name  | event      | matcher |
      | guard | PreToolUse | Bash    |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install alpha@fixtures --scope project"
    Given the user has run "/claude:plugin install beta@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply | tool | arguments                      |
      |       | bash | {"command": "echo from-model"} |
      | Done. |      |                                |
    When the user prompts "run the echo"
    Then the hooks record these runs in any order:
      | event      | session | tool name | tool input                    | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                         | CLAUDE_PLUGIN_DATA                                          | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse | first   | Bash      | {"command":"echo from-model"} | {project dir} |                 | guard     | {project dir}      | {home}/marketplaces/fixtures/plugins/alpha | {project dir}/.pi/pi-claude-marketplace/data/fixtures/alpha | first                  | first             | 1          |
      | PreToolUse | first   | Bash      | {"command":"echo from-model"} | {project dir} |                 | guard     | {project dir}      | {home}/marketplaces/fixtures/plugins/beta  | {project dir}/.pi/pi-claude-marketplace/data/fixtures/beta  | first                  | first             | 1          |

  @adapter-only
  Scenario: A hook on a plugin MCP tool runs once per call through pi-mcp-adapter's proxy (D-CF5-12, MHK-02)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name      | version |
      | hook-demo | 1.0.0   |
    Given the published plugin "hook-demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name    | event       | matcher                                 |
      | literal | PreToolUse  | mcp__plugin_hook-demo_stub-server__echo |
      | any     | PreToolUse  | *                                       |
      | after   | PostToolUse | *                                       |
    Given the published plugin "hook-demo" of the marketplace "fixtures" has the stub mcp server "stub-server" for its hooks
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install hook-demo@fixtures --scope user"
    Given pi runs with the scripted model and these companions:
      | companion      |
      | pi-mcp-adapter |
    Given pi-mcp-adapter has listed the hooks' stub mcp server "stub-server" of the plugin "hook-demo"
    Given the scripted model plays these steps:
      | reply | tool | arguments                                                                     |
      |       | mcp  | {"tool": "mcp__plugin_hook-demo_stub-server__echo", "args": {"text": "ping"}} |
      | Done. |      |                                                                               |
    When the user prompts "call the stub"
    Then the hooks record these runs in any order:
      | event       | session | tool name                               | tool input      | tool response                        | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                             | CLAUDE_PLUGIN_DATA                                        | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse  | first   | mcp__plugin_hook-demo_stub-server__echo | {"text":"ping"} |                                      | {project dir} |                 | literal   | {project dir}      | {home}/marketplaces/fixtures/plugins/hook-demo | {agent dir}/pi-claude-marketplace/data/fixtures/hook-demo | first                  | first             | 1          |
      | PreToolUse  | first   | mcp__plugin_hook-demo_stub-server__echo | {"text":"ping"} |                                      | {project dir} |                 | any       | {project dir}      | {home}/marketplaces/fixtures/plugins/hook-demo | {agent dir}/pi-claude-marketplace/data/fixtures/hook-demo | first                  | first             | 1          |
      | PostToolUse | first   | mcp__plugin_hook-demo_stub-server__echo | {"text":"ping"} | {"content":[{"type":"text","text":"echo:ping"}],"structuredContent":{"content":[{"type":"text","text":"echo:ping"}]}} | {project dir} |                 | after     | {project dir}      | {home}/marketplaces/fixtures/plugins/hook-demo | {agent dir}/pi-claude-marketplace/data/fixtures/hook-demo | first                  | first             | 1          |

  @builtin-only
  Scenario: A hook on a plugin MCP tool runs on every built-in call, the tool search included (MHK-01, MHK-02)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name      | version |
      | hook-demo | 1.0.0   |
    Given the published plugin "hook-demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name    | event       | matcher                                 |
      | literal | PreToolUse  | mcp__plugin_hook-demo_stub-server__echo |
      | any     | PreToolUse  | *                                       |
      | after   | PostToolUse | mcp__plugin_hook-demo_stub-server__echo |
    Given the published plugin "hook-demo" of the marketplace "fixtures" has the stub mcp server "stub-server" for its hooks
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install hook-demo@fixtures --scope user", which did not fail
    Given a stand-in registers the stub mcp server "stub-server" of the plugin "hook-demo" with pi's built-in mcp
    Given pi runs with the scripted model and the mcp implementation
    Given the mcp implementation has listed the tools of the stub mcp server "stub-server" of the plugin "hook-demo"
    Given the scripted model plays these steps:
      | reply | tool                                    | arguments                                                        |
      |       | tool_search                             | {"query": "mcp__plugin_hook_demo_stub_server__echo", "limit": 1} |
      |       | mcp__plugin_hook_demo_stub_server__echo | {"text": "ping"}                                                 |
      | Done. |                                         |                                                                  |
    When the user prompts "call the stub"
    Then the hooks record these runs in any order:
      | event       | session | tool name                               | tool input                                                    | tool response                        | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                             | CLAUDE_PLUGIN_DATA                                        | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse  | first   | tool_search                             | {"query":"mcp__plugin_hook_demo_stub_server__echo","limit":1} |                                      | {project dir} |                 | any       | {project dir}      | {home}/marketplaces/fixtures/plugins/hook-demo | {agent dir}/pi-claude-marketplace/data/fixtures/hook-demo | first                  | first             | 1          |
      | PreToolUse  | first   | mcp__plugin_hook-demo_stub-server__echo | {"text":"ping"}                                               |                                      | {project dir} |                 | literal   | {project dir}      | {home}/marketplaces/fixtures/plugins/hook-demo | {agent dir}/pi-claude-marketplace/data/fixtures/hook-demo | first                  | first             | 1          |
      | PreToolUse  | first   | mcp__plugin_hook-demo_stub-server__echo | {"text":"ping"}                                               |                                      | {project dir} |                 | any       | {project dir}      | {home}/marketplaces/fixtures/plugins/hook-demo | {agent dir}/pi-claude-marketplace/data/fixtures/hook-demo | first                  | first             | 1          |
      | PostToolUse | first   | mcp__plugin_hook-demo_stub-server__echo | {"text":"ping"}                                               | {"content":[{"type":"text","text":"echo:ping"}],"structuredContent":{"content":[{"type":"text","text":"echo:ping"}]}} | {project dir} |                 | after     | {project dir}      | {home}/marketplaces/fixtures/plugins/hook-demo | {agent dir}/pi-claude-marketplace/data/fixtures/hook-demo | first                  | first             | 1          |

  @builtin-only
  Scenario: A built-in MCP tool whose cut name looks like a proxy call still runs its hooks (MHK-02)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name                                          | version |
      | hook-proxy-shaped-tool-names-of-a-long-plugin | 1.0.0   |
    Given the published plugin "hook-proxy-shaped-tool-names-of-a-long-plugin" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name    | event       | matcher                                                                     |
      | any     | PreToolUse  | *                                                                           |
      | literal | PreToolUse  | mcp__plugin_hook-proxy-shaped-tool-names-of-a-long-plugin_stub-server__echo |
      | after   | PostToolUse | mcp__plugin_hook-proxy-shaped-tool-names-of-a-long-plugin_stub-server__echo |
    Given the published plugin "hook-proxy-shaped-tool-names-of-a-long-plugin" of the marketplace "fixtures" has the stub mcp server "stub-server" for its hooks
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install hook-proxy-shaped-tool-names-of-a-long-plugin@fixtures --scope user", which did not fail
    Given a stand-in registers the stub mcp server "stub-server" of the plugin "hook-proxy-shaped-tool-names-of-a-long-plugin" with pi's built-in mcp
    Given pi runs with the scripted model and the mcp implementation
    Given the mcp implementation has listed the tools of the stub mcp server "stub-server" of the plugin "hook-proxy-shaped-tool-names-of-a-long-plugin"
    Given the scripted model plays these steps:
      | reply | tool                                                             | arguments                                                                                 |
      |       | tool_search                                                      | {"query": "mcp__plugin_hook_proxy_shaped_tool_names_of_a_long_plug_b152d32d", "limit": 1} |
      |       | mcp__plugin_hook_proxy_shaped_tool_names_of_a_long_plug_b152d32d | {"text": "ping", "tool": "echo"}                                                          |
      | Done. |                                                                  |                                                                                           |
    When the user prompts "call the stub"
    Then the hooks record these runs in any order:
      | event       | session | tool name                                                        | tool input                                                                             | tool response                        | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                                                                 | CLAUDE_PLUGIN_DATA                                                                            | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse  | first   | tool_search                                                      | {"query":"mcp__plugin_hook_proxy_shaped_tool_names_of_a_long_plug_b152d32d","limit":1} |                                      | {project dir} |                 | any       | {project dir}      | {home}/marketplaces/fixtures/plugins/hook-proxy-shaped-tool-names-of-a-long-plugin | {agent dir}/pi-claude-marketplace/data/fixtures/hook-proxy-shaped-tool-names-of-a-long-plugin | first                  | first             | 1          |
      | PreToolUse  | first   | mcp__plugin_hook_proxy_shaped_tool_names_of_a_long_plug_b152d32d | {"text":"ping","tool":"echo"}                                                          |                                      | {project dir} |                 | any       | {project dir}      | {home}/marketplaces/fixtures/plugins/hook-proxy-shaped-tool-names-of-a-long-plugin | {agent dir}/pi-claude-marketplace/data/fixtures/hook-proxy-shaped-tool-names-of-a-long-plugin | first                  | first             | 1          |
      | PreToolUse  | first   | mcp__plugin_hook_proxy_shaped_tool_names_of_a_long_plug_b152d32d | {"text":"ping","tool":"echo"}                                                          |                                      | {project dir} |                 | literal   | {project dir}      | {home}/marketplaces/fixtures/plugins/hook-proxy-shaped-tool-names-of-a-long-plugin | {agent dir}/pi-claude-marketplace/data/fixtures/hook-proxy-shaped-tool-names-of-a-long-plugin | first                  | first             | 1          |
      | PostToolUse | first   | mcp__plugin_hook_proxy_shaped_tool_names_of_a_long_plug_b152d32d | {"text":"ping","tool":"echo"}                                                          | {"content":[{"type":"text","text":"echo:ping"}],"structuredContent":{"content":[{"type":"text","text":"echo:ping"}]}} | {project dir} |                 | after     | {project dir}      | {home}/marketplaces/fixtures/plugins/hook-proxy-shaped-tool-names-of-a-long-plugin | {agent dir}/pi-claude-marketplace/data/fixtures/hook-proxy-shaped-tool-names-of-a-long-plugin | first                  | first             | 1          |

  @adapter-only
  Scenario: A pi-mcp-adapter tool whose cut name looks like a proxy call still runs its hooks (PG-MCP-02, D-PG1-08)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name                                          | version |
      | hook-proxy-shaped-tool-names-of-a-long-plugin | 1.0.0   |
    Given the published plugin "hook-proxy-shaped-tool-names-of-a-long-plugin" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name    | event       | matcher                                                                     |
      | any     | PreToolUse  | *                                                                           |
      | literal | PreToolUse  | mcp__plugin_hook-proxy-shaped-tool-names-of-a-long-plugin_stub-server__echo |
      | after   | PostToolUse | mcp__plugin_hook-proxy-shaped-tool-names-of-a-long-plugin_stub-server__echo |
    Given the published plugin "hook-proxy-shaped-tool-names-of-a-long-plugin" of the marketplace "fixtures" has the stub mcp server "stub-server" for its hooks
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install hook-proxy-shaped-tool-names-of-a-long-plugin@fixtures --scope user", which did not fail
    Given pi runs with the scripted model and these companions:
      | companion      |
      | pi-mcp-adapter |
    Given pi-mcp-adapter has listed the hooks' stub mcp server "stub-server" of the plugin "hook-proxy-shaped-tool-names-of-a-long-plugin"
    Given the scripted model plays these steps:
      | reply | tool | arguments                                                                                                           |
      |       | mcp  | {"tool":"mcp__plugin_hook-proxy-shaped-tool-names-of-a-long-plug_aa6b8bc3","args":{"text":"ping","tool":"echo"}} |
      | Done. |      |                                                                                                                     |
    When the user prompts "call the stub"
    Then the hooks record these runs in any order:
      | event       | session | tool name                                                                  | tool input                    | tool response                        | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                                                                 | CLAUDE_PLUGIN_DATA                                                                            | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse  | first   | mcp__plugin_hook-proxy-shaped-tool-names-of-a-long-plugin_stub-server__echo | {"text":"ping","tool":"echo"} |                                      | {project dir} |                 | any       | {project dir}      | {home}/marketplaces/fixtures/plugins/hook-proxy-shaped-tool-names-of-a-long-plugin | {agent dir}/pi-claude-marketplace/data/fixtures/hook-proxy-shaped-tool-names-of-a-long-plugin | first                  | first             | 1          |
      | PreToolUse  | first   | mcp__plugin_hook-proxy-shaped-tool-names-of-a-long-plugin_stub-server__echo | {"text":"ping","tool":"echo"} |                                      | {project dir} |                 | literal   | {project dir}      | {home}/marketplaces/fixtures/plugins/hook-proxy-shaped-tool-names-of-a-long-plugin | {agent dir}/pi-claude-marketplace/data/fixtures/hook-proxy-shaped-tool-names-of-a-long-plugin | first                  | first             | 1          |
      | PostToolUse | first   | mcp__plugin_hook-proxy-shaped-tool-names-of-a-long-plugin_stub-server__echo | {"text":"ping","tool":"echo"} | {"content":[{"type":"text","text":"echo:ping"}],"structuredContent":{"content":[{"type":"text","text":"echo:ping"}]}} | {project dir} |                 | after     | {project dir}      | {home}/marketplaces/fixtures/plugins/hook-proxy-shaped-tool-names-of-a-long-plugin | {agent dir}/pi-claude-marketplace/data/fixtures/hook-proxy-shaped-tool-names-of-a-long-plugin | first                  | first             | 1          |

  Scenario: A PreToolUse ask decision blocks the tool call when pi has no terminal
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name  | event      | matcher | form   | output                                                                                                                       |
      | guard | PreToolUse | Bash    | script | {"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"ask","permissionDecisionReason":"please confirm"}} |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply | tool | arguments                      |
      |       | bash | {"command": "echo from-model"} |
      | Done. |      |                                |
    When the user prompts "run the echo"
    Then the hooks record these runs:
      | event      | session | tool name | tool input                    | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse | first   | Bash      | {"command":"echo from-model"} | {project dir} |                 | guard     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the model receives these calls:
      | call | role        | text                                         |
      | 1    | user        | run the echo                                 |
      | 2    | user        | run the echo                                 |
      | 2    | assistant   | tool call bash {"command":"echo from-model"} |
      | 2    | tool result | bash failed: please confirm                  |

  Scenario: A Read hook receives and rewrites a Claude file input
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name    | event      | matcher | form   | output                                                                                                                        |
      | rewrite | PreToolUse | Read    | script | {"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow","updatedInput":{"file_path":"replacement.txt","offset":2,"limit":1}}} |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the project holds the file "original.txt" with the text "original" for a tool hook
    Given the project holds the file "replacement.txt" with the text "first\nsecond" for a tool hook
    Given the scripted model plays these steps:
      | reply | tool | arguments                                |
      |       | read | {"path":"original.txt","offset":1} |
      | Done. |      |                                          |
    When the user prompts "read the original file"
    Then the hooks record these runs:
      | event      | session | tool name | tool input                                                | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse | first   | Read      | {"file_path":"{project dir}/original.txt","offset":1} | {project dir} |                 | rewrite   | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the model receives these calls:
      | call | role        | text                                                        |
      | 1    | user        | read the original file                                      |
      | 2    | user        | read the original file                                      |
      | 2    | assistant   | tool call read {"path":"original.txt","offset":1}           |
      | 2    | tool result | read returned: second                                       |

  Scenario: A Write hook changes the bytes written to disk
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name    | event      | matcher | form   | output                                                                                                                         |
      | rewrite | PreToolUse | Write   | script | {"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow","updatedInput":{"file_path":"written.txt","content":"after"}}} |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply | tool  | arguments                                    |
      |       | write | {"path":"before.txt","content":"before"} |
      | Done. |       |                                              |
    When the user prompts "write the original file"
    Then the hooks record these runs:
      | event      | session | tool name | tool input                                                     | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse | first   | Write     | {"file_path":"{project dir}/before.txt","content":"before"} | {project dir} |                 | rewrite   | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the project directory holds the file "written.txt" with the text "after"
    Then the project has no file "before.txt" after a tool hook
    Then the model receives these calls:
      | call | role        | text                                                          |
      | 1    | user        | write the original file                                       |
      | 2    | user        | write the original file                                       |
      | 2    | assistant   | tool call write {"path":"before.txt","content":"before"}   |
      | 2    | tool result | write returned: Successfully wrote to {project dir}/written.txt |

  Scenario: A Bash hook receives milliseconds and changes the command
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name    | event      | matcher | form   | output                                                                                                                                        |
      | rewrite | PreToolUse | Bash    | script | {"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow","updatedInput":{"command":"printf replacement > replacement.txt; echo rewritten","timeout":2000}}} |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply | tool | arguments                                                  |
      |       | bash | {"command":"echo original","timeout":1.5}              |
      | Done. |      |                                                            |
    When the user prompts "run the original command"
    Then the hooks record these runs:
      | event      | session | tool name | tool input                                      | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse | first   | Bash      | {"command":"echo original","timeout":1500}   | {project dir} |                 | rewrite   | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the project directory holds the file "replacement.txt" with the text "replacement"
    Then the model receives these calls:
      | call | role        | text                                                     |
      | 1    | user        | run the original command                                 |
      | 2    | user        | run the original command                                 |
      | 2    | assistant   | tool call bash {"command":"echo original","timeout":1.5} |
      | 2    | tool result | bash returned: rewritten\n                                |

  Scenario: An unsupported rewrite runs the original whole call and shows a notice
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name    | event      | matcher | form   | output                                                                                                                                                          |
      | rewrite | PreToolUse | Bash    | script | {"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow","updatedInput":{"command":"printf replacement > replacement.txt","timeout":2000,"run_in_background":true}}} |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply | tool | arguments                                                         |
      |       | bash | {"command":"printf original > original.txt; echo original","timeout":1} |
      | Done. |      |                                                                   |
    When the user prompts "run the original command"
    Then the hooks record these runs:
      | event      | session | tool name | tool input                                                                                  | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse | first   | Bash      | {"command":"printf original > original.txt; echo original","timeout":1000}               | {project dir} |                 | rewrite   | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the project directory holds the file "original.txt" with the text "original"
    Then the project has no file "replacement.txt" after a tool hook
    Then the hooks show the user these messages:
      | severity | text                                                   |
      | info     | PreToolUse:Bash ignored input rewrite (value)          |
    Then the model receives these calls:
      | call | role        | text                                                                                       |
      | 1    | user        | run the original command                                                                   |
      | 2    | user        | run the original command                                                                   |
      | 2    | assistant   | tool call bash {"command":"printf original > original.txt; echo original","timeout":1} |
      | 2    | tool result | bash returned: original\n                                                                  |

  Scenario: A native path condition still selects a translated Read hook
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name    | event      | matcher | if                 | form   | output                                                                                               |
      | rewrite | PreToolUse | Read    | Read(original.txt) | script | {"hookSpecificOutput":{"hookEventName":"PreToolUse","updatedInput":{"file_path":"replacement.txt"}}} |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the project holds the file "original.txt" with the text "original" for a tool hook
    Given the project holds the file "replacement.txt" with the text "replacement" for a tool hook
    Given the scripted model plays these steps:
      | reply | tool | arguments                 |
      |       | read | {"path":"original.txt"} |
      | Done. |      |                           |
    When the user prompts "read the original file"
    Then the hooks record these runs:
      | event      | session | tool name | tool input                                         | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse | first   | Read      | {"file_path":"{project dir}/original.txt"}       | {project dir} |                 | rewrite   | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the model receives these calls:
      | call | role        | text                                           |
      | 1    | user        | read the original file                         |
      | 2    | user        | read the original file                         |
      | 2    | assistant   | tool call read {"path":"original.txt"}         |
      | 2    | tool result | read returned: replacement                     |

  Scenario: An unsupported rewrite notice hides argument values
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name    | event      | matcher | form   | output                                                                                                                               |
      | rewrite | PreToolUse | Read    | script | {"hookSpecificOutput":{"hookEventName":"PreToolUse","updatedInput":{"file_path":"replacement.txt","pages":"secret-value"}}} |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the project holds the file "original.txt" with the text "original" for a tool hook
    Given the project holds the file "replacement.txt" with the text "replacement" for a tool hook
    Given the scripted model plays these steps:
      | reply | tool | arguments                 |
      |       | read | {"path":"original.txt"} |
      | Done. |      |                           |
    When the user prompts "read the original file"
    Then the hooks record these runs:
      | event      | session | tool name | tool input                                         | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse | first   | Read      | {"file_path":"{project dir}/original.txt"}       | {project dir} |                 | rewrite   | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the hooks show the user these messages:
      | severity | text                                               |
      | info     | PreToolUse:Read ignored input rewrite (field)      |
    Then the model receives these calls:
      | call | role        | text                                           |
      | 1    | user        | read the original file                         |
      | 2    | user        | read the original file                         |
      | 2    | assistant   | tool call read {"path":"original.txt"}         |
      | 2    | tool result | read returned: original                        |

  Scenario: A PreToolUse hook's updatedInput replaces the tool's whole input
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name     | event       | matcher | form   | output                                                                                                                         |
      | rewrite  | PreToolUse  | Bash    | script | {"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow","updatedInput":{"command":"echo rewritten"}}} |
      | observer | PostToolUse | Bash    |        |                                                                                                                                |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply | tool | arguments                                     |
      |       | bash | {"command": "echo from-model", "timeout": 30} |
      | Done. |      |                                               |
    When the user prompts "run the echo"
    Then the hooks record these runs:
      | event       | session | tool name | tool input                                    | tool response                                                                     | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse  | first   | Bash      | {"command":"echo from-model","timeout":30000} |                                                                                   | {project dir} |                 | rewrite   | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
      | PostToolUse | first   | Bash      | {"command":"echo rewritten"}                  | {"interrupted":false,"structuredContent":[{"type":"text","text":"rewritten\\n"}]} | {project dir} |                 | observer  | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the model receives these calls:
      | call | role        | text                                                      |
      | 1    | user        | run the echo                                              |
      | 2    | user        | run the echo                                              |
      | 2    | assistant   | tool call bash {"command":"echo from-model","timeout":30} |
      | 2    | tool result | bash returned: rewritten\n                                |

  Scenario: A PreToolUse hook's continue false ends the turn
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name  | event      | matcher | form   | output                                 |
      | guard | PreToolUse | Bash    | script | {"continue":false,"stopReason":"halt"} |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply | tool | arguments                      |
      |       | bash | {"command": "echo from-model"} |
    When the user prompts "run the echo"
    Then the hooks record these runs:
      | event      | session | tool name | tool input                    | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse | first   | Bash      | {"command":"echo from-model"} | {project dir} |                 | guard     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the model receives these calls:
      | call | role | text         |
      | 1    | user | run the echo |

  Scenario: A PostToolUse block keeps the tool output and adds the hook's feedback
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name | event       | matcher | form   | output                                           |
      | post | PostToolUse | Bash    | script | {"decision":"block","reason":"check the output"} |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply | tool | arguments                      |
      |       | bash | {"command": "echo from-model"} |
      | Done. |      |                                |
    When the user prompts "run the echo"
    Then the hooks record these runs:
      | event       | session | tool name | tool input                    | tool response                                                                      | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PostToolUse | first   | Bash      | {"command":"echo from-model"} | {"interrupted":false,"structuredContent":[{"type":"text","text":"from-model\\n"}]} | {project dir} |                 | post      | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the model receives these calls:
      | call | role        | text                                                                                                                                    |
      | 1    | user        | run the echo                                                                                                                            |
      | 2    | user        | run the echo                                                                                                                            |
      | 2    | assistant   | tool call bash {"command":"echo from-model"}                                                                                            |
      | 2    | tool result | bash returned: from-model\n\nPostToolUse:Bash hook blocking error from command: "${CLAUDE_PLUGIN_ROOT}/hooks/post.sh": check the output |

  Scenario: A PostToolUse hook's updated tool output replaces what the model reads
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name    | event       | matcher | form   | output                                                                                           |
      | replace | PostToolUse | Bash    | script | {"hookSpecificOutput":{"hookEventName":"PostToolUse","updatedToolOutput":{"stdout":"replaced"}}} |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply | tool | arguments                      |
      |       | bash | {"command": "echo from-model"} |
      | Done. |      |                                |
    When the user prompts "run the echo"
    Then the hooks record these runs:
      | event       | session | tool name | tool input                    | tool response                                                                      | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PostToolUse | first   | Bash      | {"command":"echo from-model"} | {"interrupted":false,"structuredContent":[{"type":"text","text":"from-model\\n"}]} | {project dir} |                 | replace   | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the model receives these calls:
      | call | role        | text                                         |
      | 1    | user        | run the echo                                 |
      | 2    | user        | run the echo                                 |
      | 2    | assistant   | tool call bash {"command":"echo from-model"} |
      | 2    | tool result | bash returned: replaced                      |

  Scenario: A tool hook's additional context reaches the model after the tool result
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name | event       | matcher | form   | output                                                                                       |
      | ctx  | PostToolUse | Bash    | script | {"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"checked by hook"}} |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply | tool | arguments                      |
      |       | bash | {"command": "echo from-model"} |
      | Done. |      |                                |
    When the user prompts "run the echo"
    Then the hooks record these runs:
      | event       | session | tool name | tool input                    | tool response                                                                      | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PostToolUse | first   | Bash      | {"command":"echo from-model"} | {"interrupted":false,"structuredContent":[{"type":"text","text":"from-model\\n"}]} | {project dir} |                 | ctx       | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the model receives these calls:
      | call | role        | text                                                      |
      | 1    | user        | run the echo                                              |
      | 2    | user        | run the echo                                              |
      | 2    | assistant   | tool call bash {"command":"echo from-model"}              |
      | 2    | tool result | bash returned: from-model\n                               |
      | 2    | user        | PostToolUse:Bash hook additional context: checked by hook |

  Scenario: A denied tool call's hook context still reaches the model
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name  | event      | matcher | form   | output                                                                                                                                                      |
      | guard | PreToolUse | Bash    | script | {"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"no echo","additionalContext":"denied by hook"}} |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply | tool | arguments                      |
      |       | bash | {"command": "echo from-model"} |
      | Done. |      |                                |
    When the user prompts "run the echo"
    Then the hooks record these runs:
      | event      | session | tool name | tool input                    | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse | first   | Bash      | {"command":"echo from-model"} | {project dir} |                 | guard     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the model receives these calls:
      | call | role        | text                                                    |
      | 1    | user        | run the echo                                            |
      | 2    | user        | run the echo                                            |
      | 2    | assistant   | tool call bash {"command":"echo from-model"}            |
      | 2    | tool result | bash failed: PreToolUse:Bash hook error: no echo        |
      | 2    | user        | PreToolUse:Bash hook additional context: denied by hook |

  Scenario: A failed tool call runs PostToolUseFailure and not PostToolUse
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name    | event              | matcher |
      | after   | PostToolUse        | Bash    |
      | failure | PostToolUseFailure | Bash    |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply | tool | arguments             |
      |       | bash | {"command": "exit 3"} |
      | Done. |      |                       |
    When the user prompts "run the failing command"
    Then the hooks record these runs:
      | event              | session | tool name | tool input           | error                                     | is interrupt | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PostToolUseFailure | first   | Bash      | {"command":"exit 3"} | (no output)\n\nCommand exited with code 3 | false        | {project dir} |                 | failure   | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |

  Scenario: A Glob hook rewrites the search pattern
    Given pi runs with the scripted model and search tools
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name    | event      | matcher | form   | output                                                                                         |
      | rewrite | PreToolUse | Glob    | script | {"hookSpecificOutput":{"hookEventName":"PreToolUse","updatedInput":{"pattern":"found*.md"}}} |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the project holds the file "found.ts" with the text "source" for a tool hook
    Given the project holds the file "found.md" with the text "notes" for a tool hook
    Given the scripted model plays these steps:
      | reply | tool | arguments                        |
      |       | find | {"pattern":"found*.ts","limit":2}   |
      | Done. |      |                                  |
    When the user prompts "find source files"
    Then the model receives these calls:
      | call | role        | text                                        |
      | 1    | user        | find source files                           |
      | 2    | user        | find source files                           |
      | 2    | assistant   | tool call find {"pattern":"found*.ts","limit":2} |
      | 2    | tool result | find returned: found.md                     |
    Then the hooks record these runs:
      | event      | session | tool name | tool input         | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse | first   | Glob      | {"pattern":"found*.ts"} | {project dir} |                 | rewrite   | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |

  Scenario: A Grep hook rewrites equivalent content options
    Given pi runs with the scripted model and search tools
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name    | event      | matcher | form   | output                                                                                                                                        |
      | rewrite | PreToolUse | Grep    | script | {"hookSpecificOutput":{"hookEventName":"PreToolUse","updatedInput":{"pattern":"NEEDLE","output_mode":"content","-n":true,"-i":true,"head_limit":2}}} |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the project holds the file "search.txt" with the text "needle\nother" for a tool hook
    Given the scripted model plays these steps:
      | reply | tool | arguments                                   |
      |       | grep | {"pattern":"other","path":"search.txt"}  |
      | Done. |      |                                             |
    When the user prompts "search the file"
    Then the hooks record these runs:
      | event      | session | tool name | tool input                                                                                                  | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse | first   | Grep      | {"pattern":"other","path":"search.txt","output_mode":"content","-n":true,"head_limit":100} | {project dir} |                 | rewrite   | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the model receives these calls:
      | call | role        | text                                                     |
      | 1    | user        | search the file                                          |
      | 2    | user        | search the file                                          |
      | 2    | assistant   | tool call grep {"pattern":"other","path":"search.txt"} |
      | 2    | tool result | grep returned: search.txt:1: needle                     |

  Scenario: An unsupported Grep rewrite runs the unchanged search
    Given pi runs with the scripted model and search tools
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name    | event      | matcher | form   | output                                                                                                                                                        |
      | rewrite | PreToolUse | Grep    | script | {"hookSpecificOutput":{"hookEventName":"PreToolUse","updatedInput":{"pattern":"replacement","output_mode":"content","-n":true,"context":1,"head_limit":1}}} |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the project holds the file "search.txt" with the text "original\nreplacement" for a tool hook
    Given the scripted model plays these steps:
      | reply | tool | arguments                                   |
      |       | grep | {"pattern":"original","path":"search.txt"} |
      | Done. |      |                                             |
    When the user prompts "search the original word"
    Then the hooks record these runs:
      | event      | session | tool name | tool input                                                                                                     | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse | first   | Grep      | {"pattern":"original","path":"search.txt","output_mode":"content","-n":true,"head_limit":100} | {project dir} |                 | rewrite   | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the hooks show the user these messages:
      | severity | text                                      |
      | info     | PreToolUse:Grep ignored input rewrite (value) |
    Then the model receives these calls:
      | call | role        | text                                                        |
      | 1    | user        | search the original word                                    |
      | 2    | user        | search the original word                                    |
      | 2    | assistant   | tool call grep {"pattern":"original","path":"search.txt"} |
      | 2    | tool result | grep returned: search.txt:1: original                      |

  Scenario: File result hooks receive the facts Pi supplies for Read
    Given pi runs with the scripted model and search tools
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
    Given the user has started a new pi session
    Given the project holds the file "search.txt" with the text "needle\nother" for a tool hook
    Given the project holds the file "found.md" with the text "found" for a tool hook
    Given the scripted model plays these steps:
      | reply | tool | arguments             |
      |       | read | {"path":"search.txt"} |
      | Done. |      |                       |
    When the user prompts "run Read"
    Then the hooks record these runs:
      | event       | session | tool name | tool input                               | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE | tool response                                                                                                                       |
      | PreToolUse  | first   | Read      | {"file_path":"{project dir}/search.txt"} | {project dir} |                 | before    | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |                                                                                                                                     |
      | PostToolUse | first   | Read      | {"file_path":"{project dir}/search.txt"} | {project dir} |                 | after     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          | {"type":"text","file":{"filePath":"{project dir}/search.txt","content":"needle\\nother","startLine":1,"numLines":2,"totalLines":2}} |

  Scenario: File result hooks receive the facts Pi supplies for Write
    Given pi runs with the scripted model and search tools
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
    Given the user has started a new pi session
    Given the project holds the file "search.txt" with the text "needle\nother" for a tool hook
    Given the project holds the file "found.md" with the text "found" for a tool hook
    Given the scripted model plays these steps:
      | reply | tool  | arguments                                 |
      |       | write | {"path":"output.txt","content":"written"} |
      | Done. |       |                                           |
    When the user prompts "run Write"
    Then the hooks record these runs:
      | event       | session | tool name | tool input                                                   | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE | tool response                                               |
      | PreToolUse  | first   | Write     | {"file_path":"{project dir}/output.txt","content":"written"} | {project dir} |                 | before    | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |                                                             |
      | PostToolUse | first   | Write     | {"file_path":"{project dir}/output.txt","content":"written"} | {project dir} |                 | after     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          | {"filePath":"{project dir}/output.txt","content":"written"} |

  Scenario: Search result hooks receive emitted facts and truncation for Glob
    Given pi runs with the scripted model and search tools
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
    Given the user has started a new pi session
    Given the project holds the file "search.txt" with the text "needle\nother" for a tool hook
    Given the project holds the file "found.md" with the text "found" for a tool hook
    Given the scripted model plays these steps:
      | reply | tool | arguments                         |
      |       | find | {"pattern":"found*.md","limit":2} |
      | Done. |      |                                   |
    When the user prompts "run Glob"
    Then the hooks record these runs:
      | event       | session | tool name | tool input              | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE | tool response                                         |
      | PreToolUse  | first   | Glob      | {"pattern":"found*.md"} | {project dir} |                 | before    | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |                                                       |
      | PostToolUse | first   | Glob      | {"pattern":"found*.md"} | {project dir} |                 | after     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          | {"filenames":["{project dir}/found.md"],"numFiles":1} |

  Scenario: Search result hooks receive emitted facts and truncation for Grep
    Given pi runs with the scripted model and search tools
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
    Given the user has started a new pi session
    Given the project holds the file "search.txt" with the text "needle\nother" for a tool hook
    Given the project holds the file "found.md" with the text "found" for a tool hook
    Given the scripted model plays these steps:
      | reply | tool | arguments                                          |
      |       | grep | {"pattern":"needle","path":"search.txt","limit":2} |
      | Done. |      |                                                    |
    When the user prompts "run Grep"
    Then the hooks record these runs:
      | event       | session | tool name | tool input                                                                                | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE | tool response                                                    |
      | PreToolUse  | first   | Grep      | {"pattern":"needle","path":"search.txt","output_mode":"content","-n":true,"head_limit":2} | {project dir} |                 | before    | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |                                                                  |
      | PostToolUse | first   | Grep      | {"pattern":"needle","path":"search.txt","output_mode":"content","-n":true,"head_limit":2} | {project dir} |                 | after     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          | {"mode":"content","content":"search.txt:1: needle","numLines":1} |

  Scenario: A Bash result hook receives combined output without invented streams for Bash
    Given pi runs with the scripted model and search tools
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
    Given the user has started a new pi session
    Given the project holds the file "search.txt" with the text "needle\nother" for a tool hook
    Given the project holds the file "found.md" with the text "found" for a tool hook
    Given the scripted model plays these steps:
      | reply | tool | arguments                              |
      |       | bash | {"command":"echo ready","timeout":0.5} |
      | Done. |      |                                        |
    When the user prompts "run Bash"
    Then the hooks record these runs:
      | event       | session | tool name | tool input                             | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE | tool response                                                                 |
      | PreToolUse  | first   | Bash      | {"command":"echo ready","timeout":500} | {project dir} |                 | before    | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |                                                                               |
      | PostToolUse | first   | Bash      | {"command":"echo ready","timeout":500} | {project dir} |                 | after     | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          | {"interrupted":false,"structuredContent":[{"type":"text","text":"ready\\n"}]} |
