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
