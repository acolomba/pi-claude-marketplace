Feature: MCP server sources

  A plugin can declare its MCP servers in more than one place, and
  pi-mcp-adapter runs the servers Claude Code would run, merged in Claude
  Code's order. Each stub server tags its echo with the source that declared
  it. The stub stands in for a real server, a scripted model for a real model,
  and a local marketplace for a published one.

  Scenario: A plugin's MCP servers are the union of its .mcp.json and its plugin.json, the later declaration winning a shared name
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers": {"a": {"stub": {"env": {"STUB_TAG": "a-mcpjson"}}}, "c": {"stub": {"env": {"STUB_TAG": "c-mcpjson"}}}}}
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".claude-plugin/plugin.json" with these stub mcp servers:
      """
      {"name": "demo", "version": "1.0.0", "mcpServers": {"a": {"stub": {"env": {"STUB_TAG": "a-manifest"}}}, "b": {"stub": {"env": {"STUB_TAG": "b-manifest"}}}}}
      """
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which warned
    Given pi runs with the scripted model and these companions:
      | companion      |
      | pi-mcp-adapter |
    Given pi-mcp-adapter has listed the tools of the stub mcp server "a" of the plugin "demo"
    Given pi-mcp-adapter has listed the tools of the stub mcp server "c" of the plugin "demo"
    Given pi-mcp-adapter has listed the tools of the stub mcp server "b" of the plugin "demo"
    Given the scripted model plays these steps:
      | reply | tool | arguments                                                       |
      |       | mcp  | {}                                                              |
      |       | mcp  | {"tool": "mcp__plugin_demo_a__echo", "args": {"text": "ping"}} |
      | Done. |      |                                                                 |
    When the user prompts "call the merged server"
    Then the model receives these calls:
      | call | role        | text                                                                                                                                                                                                                                                                          |
      | 1    | user        | call the merged server                                                                                                                                                                                                                                                        |
      | 2    | user        | call the merged server                                                                                                                                                                                                                                                        |
      | 2    | assistant   | tool call mcp {}                                                                                                                                                                                                                                                              |
      | 2    | tool result | mcp returned: MCP: 0/3 servers, 3 tools\n\n○ plugin_demo_a_ (1 tools, cached; not listening)\n○ plugin_demo_c_ (1 tools, cached; not listening)\n○ plugin_demo_b_ (1 tools, cached; not listening)\n\nmcp({ server: "name" }) to list tools, mcp({ search: "..." }) to search |
      | 3    | user        | call the merged server                                                                                                                                                                                                                                                        |
      | 3    | assistant   | tool call mcp {}                                                                                                                                                                                                                                                              |
      | 3    | tool result | mcp returned: MCP: 0/3 servers, 3 tools\n\n○ plugin_demo_a_ (1 tools, cached; not listening)\n○ plugin_demo_c_ (1 tools, cached; not listening)\n○ plugin_demo_b_ (1 tools, cached; not listening)\n\nmcp({ server: "name" }) to list tools, mcp({ search: "..." }) to search |
      | 3    | assistant   | tool call mcp {"tool":"mcp__plugin_demo_a__echo","args":{"text":"ping"}}                                                                                                                                                                                                      |
      | 3    | tool result | mcp returned: a-manifest:echo:ping                                                                                                                                                                                                                                            |

  Scenario: An array of MCP sources is read in order, a later one replacing an earlier server
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers": {"x": {"stub": {"env": {"STUB_TAG": "x-mcpjson"}}}, "z": {"stub": {"env": {"STUB_TAG": "z-mcpjson"}}}}}
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file "a.json" with these stub mcp servers:
      """
      {"mcpServers": {"x": {"stub": {"env": {"STUB_TAG": "x-filea"}}}}}
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file "b.json" with these stub mcp servers:
      """
      {"x": {"stub": {"env": {"STUB_TAG": "x-fileb"}}}}
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".claude-plugin/plugin.json" with these stub mcp servers:
      """
      {"name": "demo", "version": "1.0.0", "mcpServers": ["./a.json", {"y": {"stub": {"env": {"STUB_TAG": "y-inline"}}}}, "./b.json"]}
      """
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which warned
    Given pi runs with the scripted model and these companions:
      | companion      |
      | pi-mcp-adapter |
    Given pi-mcp-adapter has listed the tools of the stub mcp server "x" of the plugin "demo"
    Given pi-mcp-adapter has listed the tools of the stub mcp server "z" of the plugin "demo"
    Given pi-mcp-adapter has listed the tools of the stub mcp server "y" of the plugin "demo"
    Given the scripted model plays these steps:
      | reply | tool | arguments                                                       |
      |       | mcp  | {}                                                              |
      |       | mcp  | {"tool": "mcp__plugin_demo_x__echo", "args": {"text": "ping"}} |
      | Done. |      |                                                                 |
    When the user prompts "call the array server"
    Then the model receives these calls:
      | call | role        | text                                                                                                                                                                                                                                                                          |
      | 1    | user        | call the array server                                                                                                                                                                                                                                                         |
      | 2    | user        | call the array server                                                                                                                                                                                                                                                         |
      | 2    | assistant   | tool call mcp {}                                                                                                                                                                                                                                                              |
      | 2    | tool result | mcp returned: MCP: 0/3 servers, 3 tools\n\n○ plugin_demo_x_ (1 tools, cached; not listening)\n○ plugin_demo_z_ (1 tools, cached; not listening)\n○ plugin_demo_y_ (1 tools, cached; not listening)\n\nmcp({ server: "name" }) to list tools, mcp({ search: "..." }) to search |
      | 3    | user        | call the array server                                                                                                                                                                                                                                                         |
      | 3    | assistant   | tool call mcp {}                                                                                                                                                                                                                                                              |
      | 3    | tool result | mcp returned: MCP: 0/3 servers, 3 tools\n\n○ plugin_demo_x_ (1 tools, cached; not listening)\n○ plugin_demo_z_ (1 tools, cached; not listening)\n○ plugin_demo_y_ (1 tools, cached; not listening)\n\nmcp({ server: "name" }) to list tools, mcp({ search: "..." }) to search |
      | 3    | assistant   | tool call mcp {"tool":"mcp__plugin_demo_x__echo","args":{"text":"ping"}}                                                                                                                                                                                                      |
      | 3    | tool result | mcp returned: x-fileb:echo:ping                                                                                                                                                                                                                                               |
