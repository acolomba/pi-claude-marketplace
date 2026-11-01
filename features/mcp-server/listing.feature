Feature: MCP server listing

  pi-mcp-adapter and Pi name and list a plugin's MCP server tools the way
  Claude Code names them. A stdio stub server stands in for a real one, a
  scripted model for a real model, and a local marketplace for a published one.

  Scenario: A search through the mcp tool activates the plugin's tool under Claude Code's name
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
      | reply | tool | arguments          |
      |       | mcp  | {"search": "echo"} |
      | Done. |      |                    |
    When the user prompts "find the echo tool"
    Then the model receives these calls:
      | call | role        | text                                                                                                                                                                                                     |
      | 1    | user        | find the echo tool                                                                                                                                                                                       |
      | 2    | user        | find the echo tool                                                                                                                                                                                       |
      | 2    | assistant   | tool call mcp {"search":"echo"}                                                                                                                                                                          |
      | 2    | tool result | mcp returned: Activated as direct tools: mcp__plugin_demo_stub__echo.\n\nFound 1 tool matching "echo":\n\nmcp__plugin_demo_stub__echo\n  Echoes the text it is given.\n\n  Shape:\n    { text: string; } |
    Then the model calls are offered these tools:
      | call | tools                                                                                                                    |
      | 1    | read, bash, edit, write, pi_claude_marketplace_list, pi_claude_marketplace_plugin_list, mcp                              |
      | 2    | read, bash, edit, write, pi_claude_marketplace_list, pi_claude_marketplace_plugin_list, mcp, mcp__plugin_demo_stub__echo |
    Then the stub mcp server "stub" of the plugin "demo" receives these messages:
      | kind         | method                    | params                                                                                                                                                                                                                                                          |
      | request      | initialize                | {"protocolVersion":"2025-11-25","capabilities":{"extensions":{"io.modelcontextprotocol/ui":{"mimeTypes":["text/html;profile=mcp-app"]}},"sampling":{},"roots":{},"elicitation":{"form":{}}},"clientInfo":{"name":"pi-mcp-plugin_demo_stub_","version":"1.0.0"}} |
      | notification | notifications/initialized |                                                                                                                                                                                                                                                                 |
      | request      | tools/list                |                                                                                                                                                                                                                                                                 |

  Scenario: The mcp tool lists the plugin's server under its generated key
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
      | reply | tool | arguments                        |
      |       | mcp  | {}                               |
      |       | mcp  | {"connect": "plugin_demo_stub_"} |
      |       | mcp  | {"server": "plugin_demo_stub_"}  |
      | Done. |      |                                  |
    When the user prompts "list the mcp servers"
    Then the model receives these calls:
      | call | role        | text                                                                                                                                                                       |
      | 1    | user        | list the mcp servers                                                                                                                                                       |
      | 2    | user        | list the mcp servers                                                                                                                                                       |
      | 2    | assistant   | tool call mcp {}                                                                                                                                                           |
      | 2    | tool result | mcp returned: MCP: 0/1 servers, 1 tools\n\n○ plugin_demo_stub_ (1 tools, cached; not listening)\n\nmcp({ server: "name" }) to list tools, mcp({ search: "..." }) to search |
      | 3    | user        | list the mcp servers                                                                                                                                                       |
      | 3    | assistant   | tool call mcp {}                                                                                                                                                           |
      | 3    | tool result | mcp returned: MCP: 0/1 servers, 1 tools\n\n○ plugin_demo_stub_ (1 tools, cached; not listening)\n\nmcp({ server: "name" }) to list tools, mcp({ search: "..." }) to search |
      | 3    | assistant   | tool call mcp {"connect":"plugin_demo_stub_"}                                                                                                                              |
      | 3    | tool result | mcp returned: plugin_demo_stub_ (1 tools):\n\n- mcp__plugin_demo_stub__echo(text) - Echoes the text it is given.                                                           |
      | 4    | user        | list the mcp servers                                                                                                                                                       |
      | 4    | assistant   | tool call mcp {}                                                                                                                                                           |
      | 4    | tool result | mcp returned: MCP: 0/1 servers, 1 tools\n\n○ plugin_demo_stub_ (1 tools, cached; not listening)\n\nmcp({ server: "name" }) to list tools, mcp({ search: "..." }) to search |
      | 4    | assistant   | tool call mcp {"connect":"plugin_demo_stub_"}                                                                                                                              |
      | 4    | tool result | mcp returned: plugin_demo_stub_ (1 tools):\n\n- mcp__plugin_demo_stub__echo(text) - Echoes the text it is given.                                                           |
      | 4    | assistant   | tool call mcp {"server":"plugin_demo_stub_"}                                                                                                                               |
      | 4    | tool result | mcp returned: plugin_demo_stub_ (1 tools):\n\n- mcp__plugin_demo_stub__echo(text) - Echoes the text it is given.                                                           |

  Scenario: Pi registers the plugin's tool under Claude Code's name, inactive until a search
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
    When the user lists the mcp tools pi offers
    Then pi offers these mcp tools:
      | tool                        | active |
      | mcp                         | yes    |
      | mcp__plugin_demo_stub__echo | no     |

  Scenario: Each server of a plugin gets tools named after the plugin and the server
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers": {"api": {"stub": {}}, "my.db": {"stub": {}}}}
      """
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which warned
    Given pi runs with the scripted model and these companions:
      | companion      |
      | pi-mcp-adapter |
    Given pi-mcp-adapter has listed the tools of the stub mcp server "api" of the plugin "demo"
    Given pi-mcp-adapter has listed the tools of the stub mcp server "my.db" of the plugin "demo"
    When the user lists the mcp tools pi offers
    Then pi offers these mcp tools:
      | tool                         | active |
      | mcp                          | yes    |
      | mcp__plugin_demo_api__echo   | no     |
      | mcp__plugin_demo_my_db__echo | no     |

  Scenario: A plugin without MCP servers adds no server to pi-mcp-adapter
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given pi runs with the scripted model and these companions:
      | companion      |
      | pi-mcp-adapter |
    Given the scripted model plays these steps:
      | reply | tool | arguments |
      |       | mcp  | {}        |
      | Done. |      |           |
    When the user prompts "list the mcp servers"
    Then the model receives these calls:
      | call | role        | text                                    |
      | 1    | user        | list the mcp servers                    |
      | 2    | user        | list the mcp servers                    |
      | 2    | assistant   | tool call mcp {}                        |
      | 2    | tool result | mcp returned: MCP: 0/0 servers, 0 tools |
    Then no stub mcp server receives a message

  Scenario: A search that matches no tool activates none
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
      | reply | tool | arguments             |
      |       | mcp  | {"search": "nothing"} |
      | Done. |      |                       |
    When the user prompts "find a tool"
    Then the model receives these calls:
      | call | role        | text                                      |
      | 1    | user        | find a tool                               |
      | 2    | user        | find a tool                               |
      | 2    | assistant   | tool call mcp {"search":"nothing"}        |
      | 2    | tool result | mcp returned: No tools matching "nothing" |
    Then the model calls are offered these tools:
      | call | tools                                                                                       |
      | 1    | read, bash, edit, write, pi_claude_marketplace_list, pi_claude_marketplace_plugin_list, mcp |
      | 2    | read, bash, edit, write, pi_claude_marketplace_list, pi_claude_marketplace_plugin_list, mcp |
