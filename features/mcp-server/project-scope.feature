Feature: MCP server project scope

  A project-scope plugin server runs only when pi-mcp-adapter's project trust
  admits it, though Claude Code asks no approval for one (D-CF6-03). A stdio stub,
  a scripted model, and a local marketplace stand in; `{em dash}` is an em dash.

  Scenario: An allowed project-scope plugin server connects and answers a scripted call
    Given pi-mcp-adapter allows project mcp servers for the user
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the stub mcp server "stub"
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project", which warned
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

  Scenario: A headless session leaves a project-scope plugin server blocked without the user's allow setting
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the stub mcp server "stub"
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project", which warned
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
    Then the model receives these mcp calls:
      | call | role        | text                                                                                                                                                                                                                                                                                                          |
      | 1    | user        | call the stub                                                                                                                                                                                                                                                                                                 |
      | 2    | user        | call the stub                                                                                                                                                                                                                                                                                                 |
      | 2    | assistant   | tool call mcp {"tool":"mcp__plugin_demo_stub__echo","args":{"text":"ping"}}                                                                                                                                                                                                                                   |
      | 2    | tool result | mcp returned: Tool "mcp__plugin_demo_stub__echo" not found. Use mcp({ search: "..." }) to search.                                                                                                                                                                                                             |
      | 3    | user        | call the stub                                                                                                                                                                                                                                                                                                 |
      | 3    | assistant   | tool call mcp {"tool":"mcp__plugin_demo_stub__echo","args":{"text":"ping"}}                                                                                                                                                                                                                                   |
      | 3    | tool result | mcp returned: Tool "mcp__plugin_demo_stub__echo" not found. Use mcp({ search: "..." }) to search.                                                                                                                                                                                                             |
      | 3    | assistant   | tool call mcp {}                                                                                                                                                                                                                                                                                              |
      | 3    | tool result | mcp returned: MCP: 0/0 servers, 0 tools (1 blocked)\n\n⊘ plugin_demo_stub_ (blocked: project server approval required {em dash} approve it in a trusted interactive session or set user-global settings.projectServers to "allow")\n\nmcp({ server: "name" }) to list tools, mcp({ search: "..." }) to search |
    Then no stub mcp server receives a message

  Scenario: An untrusted project blocks a project-scope plugin server even when the user allows project servers
    Given pi-mcp-adapter allows project mcp servers for the user
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the stub mcp server "stub"
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project", which warned
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
    Then the model receives these mcp calls:
      | call | role        | text                                                                                                                                                                                                                                           |
      | 1    | user        | call the stub                                                                                                                                                                                                                                  |
      | 2    | user        | call the stub                                                                                                                                                                                                                                  |
      | 2    | assistant   | tool call mcp {"tool":"mcp__plugin_demo_stub__echo","args":{"text":"ping"}}                                                                                                                                                                    |
      | 2    | tool result | mcp returned: Tool "mcp__plugin_demo_stub__echo" not found. Use mcp({ search: "..." }) to search.                                                                                                                                              |
      | 3    | user        | call the stub                                                                                                                                                                                                                                  |
      | 3    | assistant   | tool call mcp {"tool":"mcp__plugin_demo_stub__echo","args":{"text":"ping"}}                                                                                                                                                                    |
      | 3    | tool result | mcp returned: Tool "mcp__plugin_demo_stub__echo" not found. Use mcp({ search: "..." }) to search.                                                                                                                                              |
      | 3    | assistant   | tool call mcp {}                                                                                                                                                                                                                               |
      | 3    | tool result | mcp returned: MCP: 0/0 servers, 0 tools (1 blocked)\n\n⊘ plugin_demo_stub_ (blocked by project trust {em dash} trust the project to review and approve this server)\n\nmcp({ server: "name" }) to list tools, mcp({ search: "..." }) to search |
    Then no stub mcp server receives a message

  Scenario: Plugin info shows a blocked project-scope server as pending approval
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the stub mcp server "stub"
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project", which warned
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
