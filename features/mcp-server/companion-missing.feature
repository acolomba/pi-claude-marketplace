Feature: MCP server companion missing

  With no MCP implementation, a plugin with MCP servers still installs, and its
  row names the implementation that would run every server (MREC-05, D-MB-05,
  D-MB-07). The user's Pi settings stay as the user wrote them (D-MB-01), and a
  server answers once a session loads an implementation, with no reinstall. A
  Pi started after the change stands in for `/reload` (D-CF6-11), a stdio stub
  server for a real one, a scripted model for a real model, and a local
  marketplace for a published one. The plugin info scenarios hold only under
  Pi's built-in MCP until info's requires line follows D-MB-07.

  @own-implementation
  Scenario: Installing a plugin with an MCP server with no MCP implementation names mcp as missing (MREC-05)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the stub mcp server "stub"
    Given the marketplace "fixtures" is added to the user scope
    Given the user's pi settings turn off pi's built-in mcp
    Given pi runs with the scripted model
    When the user runs "/claude:plugin install demo@fixtures --scope user"
    Then the result has these fields:
      | kind         | cascade                             |
      | severity     | warning                             |
      | needs reload | true                                |
      | summary      | A plugin operation needs attention. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons      | scope | version |
      | fixtures         | user              | demo@fixtures | demo | installed | requires mcp | user  | 1.0.0   |
    Then the user's pi settings still turn off pi's built-in mcp

  @own-implementation
  Scenario: A plugin with an sse server installs with no MCP implementation and names pi-mcp-adapter (MREC-05, D-MB-05)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with this text:
      """
      {"mcpServers": {"events": {"type": "sse", "url": "http://127.0.0.1:9/sse"}}}
      """
    Given the marketplace "fixtures" is added to the user scope
    Given the user's pi settings turn off pi's built-in mcp
    Given pi runs with the scripted model
    When the user runs "/claude:plugin install demo@fixtures --scope user"
    Then the result has these fields:
      | kind         | cascade                             |
      | severity     | warning                             |
      | needs reload | true                                |
      | summary      | A plugin operation needs attention. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons                 | scope | version |
      | fixtures         | user              | demo@fixtures | demo | installed | requires pi-mcp-adapter | user  | 1.0.0   |
    Then the user's pi settings still turn off pi's built-in mcp

  @own-implementation
  Scenario: A plugin whose server needs an elicitation handler installs with no MCP implementation and names Pi's built-in MCP (MREC-05, D-MB-05)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with this text:
      """
      {"mcpServers": {"asker": {"command": "node", "bareElicitationCapability": true}}}
      """
    Given the marketplace "fixtures" is added to the user scope
    Given the user's pi settings turn off pi's built-in mcp
    Given pi runs with the scripted model
    When the user runs "/claude:plugin install demo@fixtures --scope user"
    Then the result has these fields:
      | kind         | cascade                             |
      | severity     | warning                             |
      | needs reload | true                                |
      | summary      | A plugin operation needs attention. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons              | scope | version |
      | fixtures         | user              | demo@fixtures | demo | installed | requires builtin mcp | user  | 1.0.0   |
    Then the user's pi settings still turn off pi's built-in mcp

  @own-implementation
  Scenario: A server installed with no MCP implementation answers once pi starts with pi-mcp-adapter, with no reinstall (MREC-05)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the stub mcp server "stub"
    Given the marketplace "fixtures" is added to the user scope
    Given the user's pi settings turn off pi's built-in mcp
    Given pi runs with the scripted model
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which warned
    Given the scripted model plays these steps:
      | reply | tool | arguments                                                          |
      |       | mcp  | {"tool": "mcp__plugin_demo_stub__echo", "args": {"text": "ping"}} |
      | Done. |      |                                                                    |
    When the user restarts pi with pi-mcp-adapter
    Then the session reports no results
    When pi-mcp-adapter finishes listing the tools of the stub mcp server "stub" of the plugin "demo"
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
  Scenario: Plugin info names pi-mcp-adapter as a missing companion
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the stub mcp server "stub"
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    When the user runs "/claude:plugin info demo@fixtures --scope user"
    Then the result has these fields:
      | kind                           | plugin-info                                              |
      | marketplace details autoupdate | false                                                    |
      | marketplace name               | fixtures                                                 |
      | marketplace scope              | user                                                     |
      | needs reload                   | false                                                    |
      | plugin components mcp          | [{"name":"plugin:demo:stub","status":"status unknown"}] |
      | plugin components resolved     | true                                                     |
      | plugin components skills       | demo-skill                                               |
      | plugin id                      | demo@fixtures                                            |
      | plugin name                    | demo                                                     |
      | plugin reasons                 |                                                          |
      | plugin requires                | [{"companion":"pi-mcp-adapter","missing":true}]          |
      | plugin scope                   | user                                                     |
      | plugin status                  | installed                                                |
      | plugin version                 | 1.0.0                                                    |
      | severity                       | info                                                     |

  @builtin-only
  Scenario: Plugin info names no missing companion once pi loads pi-mcp-adapter
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the stub mcp server "stub"
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given pi runs with the scripted model and these companions:
      | companion      |
      | pi-mcp-adapter |
    Given pi-mcp-adapter has listed the tools of the stub mcp server "stub" of the plugin "demo"
    Given pi-mcp-adapter has reported the mcp servers of the plugin "demo@fixtures" of the user scope
    When the user runs "/claude:plugin info demo@fixtures --scope user"
    Then the result has these fields:
      | kind                           | plugin-info                                                             |
      | marketplace details autoupdate | false                                                                   |
      | marketplace name               | fixtures                                                                |
      | marketplace scope              | user                                                                    |
      | needs reload                   | false                                                                   |
      | plugin components mcp          | [{"name":"plugin:demo:stub","status":"cached, connects on first use"}] |
      | plugin components resolved     | true                                                                    |
      | plugin components skills       | demo-skill                                                              |
      | plugin id                      | demo@fixtures                                                           |
      | plugin name                    | demo                                                                    |
      | plugin reasons                 |                                                                         |
      | plugin requires                | [{"companion":"pi-mcp-adapter","missing":false}]                        |
      | plugin scope                   | user                                                                    |
      | plugin status                  | installed                                                               |
      | plugin version                 | 1.0.0                                                                   |
      | severity                       | info                                                                    |
