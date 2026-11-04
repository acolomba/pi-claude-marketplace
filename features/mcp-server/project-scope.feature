Feature: MCP server project scope

  A project-scope plugin server runs only while the project is trusted. Under pi-mcp-adapter it also
  needs the adapter's approval or the user's allow setting (D-CF6-03); under Pi's built-in MCP, Pi's
  trust alone admits it, as Claude Code asks no approval (BLT-03, D-MB-09). The info status of an
  untrusted project's server is in builtin-status.feature. A stdio stub, a scripted model, and a
  local marketplace stand in.

  @adapter-only
  Scenario: An allowed project-scope plugin server connects and answers a scripted call
    Given pi-mcp-adapter allows project mcp servers for the user
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the stub mcp server "stub"
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the project holds a pi settings file
    Given pi runs with the scripted model and these companions:
      | companion      |
      | pi-mcp-adapter |
    Given pi-mcp-adapter has listed the tools of the stub mcp server "stub" of the plugin "demo"
    Given the scripted model plays these steps:
      | reply | tool | arguments                                                          |
      |       | mcp  | {"tool": "mcp__plugin_demo_stub__echo", "args": {"text": "ping"}} |
      | Done. |      |                                                                    |
    When the user prompts "call the stub"
    Then the stub mcp server "stub" of the plugin "demo" receives these messages:
      | kind         | method                    | params                                                                                                                                                                                                                                                          |
      | request      | initialize                | {"protocolVersion":"2025-11-25","capabilities":{"extensions":{"io.modelcontextprotocol/ui":{"mimeTypes":["text/html;profile=mcp-app"]}},"sampling":{},"roots":{},"elicitation":{"form":{}}},"clientInfo":{"name":"pi-mcp-plugin_demo_stub_","version":"1.0.0"}} |
      | notification | notifications/initialized |                                                                                                                                                                                                                                                                 |
      | request      | tools/list                |                                                                                                                                                                                                                                                                 |
      | request      | initialize                | {"protocolVersion":"2025-11-25","capabilities":{"extensions":{"io.modelcontextprotocol/ui":{"mimeTypes":["text/html;profile=mcp-app"]}},"sampling":{},"roots":{},"elicitation":{"form":{}}},"clientInfo":{"name":"pi-mcp-plugin_demo_stub_","version":"1.0.0"}} |
      | notification | notifications/initialized |                                                                                                                                                                                                                                                                 |
      | request      | tools/list                |                                                                                                                                                                                                                                                                 |
      | request      | tools/call                | {"name":"echo","arguments":{"text":"ping"},"_meta":{"pi-mcp-adapter/toolCallId":"{tool call 1}","progressToken":2}}                                                                                                                                             |
    Then the model receives these calls:
      | call | role        | text                                                                        |
      | 1    | user        | call the stub                                                               |
      | 2    | user        | call the stub                                                               |
      | 2    | assistant   | tool call mcp {"tool":"mcp__plugin_demo_stub__echo","args":{"text":"ping"}} |
      | 2    | tool result | mcp returned: echo:ping                                                     |

  @builtin-only
  Scenario: A trusted project's plugin server answers a scripted call with no approval or allow setting (BLT-03, D-MB-09)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the stub mcp server "stub"
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project", which did not fail
    Given the project holds a pi settings file
    Given pi runs with the scripted model and the mcp implementation
    Given the mcp implementation has listed the tools of the stub mcp server "stub" of the plugin "demo"
    Given the scripted model plays these steps:
      | reply | tool                        | arguments         |
      |       | tool_search                 | {"query": "echo"} |
      |       | mcp__plugin_demo_stub__echo | {"text": "ping"}  |
      | Done. |                             |                   |
    When the user prompts "call the stub"
    Then the stub mcp server "stub" of the plugin "demo" receives these messages:
      | kind         | method                    | params                                                                                                    |
      | request      | initialize                | {"protocolVersion":"2025-11-25","capabilities":{"roots":{}},"clientInfo":{"name":"pi","version":"1.5.0"}} |
      | notification | notifications/initialized |                                                                                                           |
      | request      | tools/list                |                                                                                                           |
      | request      | tools/call                | {"name":"echo","arguments":{"text":"ping"},"_meta":{"progressToken":3}}                                   |
    Then the model receives these calls, with each tool search reduced to the tools it loads:
      | call | role        | text                                                                                  |
      | 1    | user        | call the stub                                                                         |
      | 2    | user        | call the stub                                                                         |
      | 2    | assistant   | tool call tool_search {"query":"echo"}                                                |
      | 2    | tool result | tool_search returned: found mcp__plugin_demo_stub__echo: Echoes the text it is given. |
      | 3    | user        | call the stub                                                                         |
      | 3    | assistant   | tool call tool_search {"query":"echo"}                                                |
      | 3    | tool result | tool_search returned: found mcp__plugin_demo_stub__echo: Echoes the text it is given. |
      | 3    | assistant   | tool call mcp__plugin_demo_stub__echo {"text":"ping"}                                 |
      | 3    | tool result | mcp__plugin_demo_stub__echo returned: echo:ping                                       |

  @adapter-only
  Scenario: A headless session leaves a project-scope plugin server blocked without the user's allow setting
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the stub mcp server "stub"
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the project holds a pi settings file
    Given pi runs with the scripted model and these companions:
      | companion      |
      | pi-mcp-adapter |
    Given the scripted model plays these steps:
      | reply | tool | arguments                                                         |
      |       | mcp  | {"tool": "mcp__plugin_demo_stub__echo", "args": {"text": "ping"}} |
      |       | mcp  | {}                                                                |
      | Done. |      |                                                                   |
    When the user prompts "call the stub"
    Then the model receives these calls:
      | call | role        | text                                                                        |
      | 1    | user        | call the stub                                                               |
      | 2    | user        | call the stub                                                               |
      | 2    | assistant   | tool call mcp {"tool":"mcp__plugin_demo_stub__echo","args":{"text":"ping"}} |
      | 2    | tool result | mcp returned: no tool mcp__plugin_demo_stub__echo                           |
      | 3    | user        | call the stub                                                               |
      | 3    | assistant   | tool call mcp {"tool":"mcp__plugin_demo_stub__echo","args":{"text":"ping"}} |
      | 3    | tool result | mcp returned: no tool mcp__plugin_demo_stub__echo                           |
      | 3    | assistant   | tool call mcp {}                                                            |
      | 3    | tool result | mcp returned: server plugin_demo_stub_ blocked                              |
    Then no stub mcp server receives a message

  @adapter-only
  Scenario: An untrusted project blocks a project-scope plugin server even when the user allows project servers
    Given pi-mcp-adapter allows project mcp servers for the user
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the stub mcp server "stub"
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the project holds a pi settings file
    Given pi runs with the scripted model and these companions in an untrusted project:
      | companion      |
      | pi-mcp-adapter |
    Given the scripted model plays these steps:
      | reply | tool | arguments                                                         |
      |       | mcp  | {"tool": "mcp__plugin_demo_stub__echo", "args": {"text": "ping"}} |
      |       | mcp  | {}                                                                |
      | Done. |      |                                                                   |
    When the user prompts "call the stub"
    Then the model receives these calls:
      | call | role        | text                                                                        |
      | 1    | user        | call the stub                                                               |
      | 2    | user        | call the stub                                                               |
      | 2    | assistant   | tool call mcp {"tool":"mcp__plugin_demo_stub__echo","args":{"text":"ping"}} |
      | 2    | tool result | mcp returned: no tool mcp__plugin_demo_stub__echo                           |
      | 3    | user        | call the stub                                                               |
      | 3    | assistant   | tool call mcp {"tool":"mcp__plugin_demo_stub__echo","args":{"text":"ping"}} |
      | 3    | tool result | mcp returned: no tool mcp__plugin_demo_stub__echo                           |
      | 3    | assistant   | tool call mcp {}                                                            |
      | 3    | tool result | mcp returned: server plugin_demo_stub_ blocked                              |
    Then no stub mcp server receives a message

  @adapter-only
  Scenario: Plugin info shows a blocked project-scope server as pending approval
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the stub mcp server "stub"
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the project holds a pi settings file
    Given pi runs with the scripted model and these companions:
      | companion      |
      | pi-mcp-adapter |
    Given pi-mcp-adapter has reported the mcp servers of the plugin "demo@fixtures" of the project scope
    When the user runs "/claude:plugin info demo@fixtures --scope project"
    Then the result has these fields:
      | kind                           | plugin-info                                               |
      | marketplace details autoupdate | false                                                     |
      | marketplace name               | fixtures                                                  |
      | marketplace scope              | project                                                   |
      | needs reload                   | false                                                     |
      | plugin components mcp          | [{"name":"plugin:demo:stub","status":"pending approval"}] |
      | plugin components resolved     | true                                                      |
      | plugin components skills       | demo-skill                                                |
      | plugin id                      | demo@fixtures                                             |
      | plugin name                    | demo                                                      |
      | plugin reasons                 |                                                           |
      | plugin requires                | [{"companion":"pi-mcp-adapter","missing":false}]          |
      | plugin scope                   | project                                                   |
      | plugin status                  | installed                                                 |
      | plugin version                 | 1.0.0                                                     |
      | severity                       | info                                                      |
