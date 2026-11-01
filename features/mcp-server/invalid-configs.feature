Feature: MCP server invalid configs

  A plugin whose MCP config holds a server or a file that Claude Code's schema
  rejects installs as Claude Code installs it: Pi skips what Claude Code's
  loader skips and refuses what Claude Code refuses (D-CF6-02). The stub
  stands in for a real server, a scripted model for a real model, and a local
  marketplace for a published one.

  Scenario: A malformed server in .mcp.json is skipped and the plugin's other server answers
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers": {"ok": {"stub": {}}, "broken": {"type": "bogus"}}}
      """
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which warned
    Given pi runs with the scripted model and these companions:
      | companion      |
      | pi-mcp-adapter |
    Given pi-mcp-adapter has listed the tools of the stub mcp server "ok" of the plugin "demo"
    Given the scripted model plays these steps:
      | reply | tool | arguments                                                        |
      |       | mcp  | {}                                                               |
      |       | mcp  | {"tool": "mcp__plugin_demo_ok__echo", "args": {"text": "ping"}} |
      | Done. |      |                                                                  |
    When the user prompts "call the good server"
    Then the model receives these calls:
      | call | role        | text                                                                                                                                                         |
      | 1    | user        | call the good server                                                                                                                                         |
      | 2    | user        | call the good server                                                                                                                                         |
      | 2    | assistant   | tool call mcp {}                                                                                                                                             |
      | 2    | tool result | mcp returned: MCP: 0/1 servers, 1 tools\n\n○ plugin_demo_ok_ (1 tools, cached; not listening)\n\nmcp({ server: "name" }) to list tools, mcp({ search: "..." }) to search |
      | 3    | user        | call the good server                                                                                                                                         |
      | 3    | assistant   | tool call mcp {}                                                                                                                                             |
      | 3    | tool result | mcp returned: MCP: 0/1 servers, 1 tools\n\n○ plugin_demo_ok_ (1 tools, cached; not listening)\n\nmcp({ server: "name" }) to list tools, mcp({ search: "..." }) to search |
      | 3    | assistant   | tool call mcp {"tool":"mcp__plugin_demo_ok__echo","args":{"text":"ping"}}                                                                                   |
      | 3    | tool result | mcp returned: echo:ping                                                                                                                                      |

  Scenario: A malformed server written in plugin.json makes the plugin unavailable
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".claude-plugin/plugin.json" with these stub mcp servers:
      """
      {"name": "demo", "version": "1.0.0", "mcpServers": {"ok": {"stub": {}}, "broken": {"type": "bogus"}}}
      """
    Given the marketplace "fixtures" is added to the user scope
    When the user runs "/claude:plugin install demo@fixtures --scope user"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status      | reasons       |
      | fixtures         | user              | demo@fixtures | demo | unavailable | malformed mcp |
