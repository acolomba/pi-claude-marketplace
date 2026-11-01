Feature: MCP server companion missing

  An install without pi-mcp-adapter names the missing companion, and the
  plugin's server works once a session loads the adapter, with no reinstall.
  A Pi started after the change stands in for `/reload` (D-CF6-11), a stdio
  stub server for a real one, a scripted model for a real model, and a local
  marketplace for a published one.

  Scenario: Installing a plugin with an MCP server without pi-mcp-adapter reports the missing companion
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the stub mcp server "stub"
    Given the marketplace "fixtures" is added to the user scope
    When the user runs "/claude:plugin install demo@fixtures --scope user"
    Then the result has these fields:
      | kind         | cascade                             |
      | severity     | warning                             |
      | needs reload | true                                |
      | summary      | A plugin operation needs attention. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons                 | scope | version |
      | fixtures         | user              | demo@fixtures | demo | installed | requires pi-mcp-adapter | user  | 1.0.0   |

  Scenario: A server installed without pi-mcp-adapter answers once pi starts with the adapter, with no reinstall
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the stub mcp server "stub"
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which warned
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

  Scenario: Plugin info names pi-mcp-adapter as a missing companion
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the stub mcp server "stub"
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which warned
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

  Scenario: Plugin info names no missing companion once pi loads pi-mcp-adapter
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the stub mcp server "stub"
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which warned
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
