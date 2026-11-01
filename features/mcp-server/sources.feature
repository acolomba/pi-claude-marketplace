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

  Scenario: Without a plugin.json, the marketplace entry declares the plugin's servers after its .mcp.json
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers": {"e": {"stub": {"env": {"STUB_TAG": "e-mcpjson"}}}, "f": {"stub": {"env": {"STUB_TAG": "f-mcpjson"}}}}}
      """
    Given the marketplace entry of the published plugin "demo" of the marketplace "fixtures" declares these stub mcp servers:
      """
      {"e": {"stub": {"env": {"STUB_TAG": "e-entry"}}}}
      """
    Given the published plugin "demo" of the marketplace "fixtures" has no plugin.json, so its marketplace entry declares its mcp servers
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which warned
    Given pi runs with the scripted model and these companions:
      | companion      |
      | pi-mcp-adapter |
    Given pi-mcp-adapter has listed the tools of the stub mcp server "e" of the plugin "demo"
    Given pi-mcp-adapter has listed the tools of the stub mcp server "f" of the plugin "demo"
    Given the scripted model plays these steps:
      | reply | tool | arguments                                                       |
      |       | mcp  | {}                                                              |
      |       | mcp  | {"tool": "mcp__plugin_demo_e__echo", "args": {"text": "ping"}} |
      | Done. |      |                                                                 |
    When the user prompts "call the entry server"
    Then the model receives these calls:
      | call | role        | text                                                                                                                                                                                                                       |
      | 1    | user        | call the entry server                                                                                                                                                                                                      |
      | 2    | user        | call the entry server                                                                                                                                                                                                      |
      | 2    | assistant   | tool call mcp {}                                                                                                                                                                                                           |
      | 2    | tool result | mcp returned: MCP: 0/2 servers, 2 tools\n\n○ plugin_demo_e_ (1 tools, cached; not listening)\n○ plugin_demo_f_ (1 tools, cached; not listening)\n\nmcp({ server: "name" }) to list tools, mcp({ search: "..." }) to search |
      | 3    | user        | call the entry server                                                                                                                                                                                                      |
      | 3    | assistant   | tool call mcp {}                                                                                                                                                                                                           |
      | 3    | tool result | mcp returned: MCP: 0/2 servers, 2 tools\n\n○ plugin_demo_e_ (1 tools, cached; not listening)\n○ plugin_demo_f_ (1 tools, cached; not listening)\n\nmcp({ server: "name" }) to list tools, mcp({ search: "..." }) to search |
      | 3    | assistant   | tool call mcp {"tool":"mcp__plugin_demo_e__echo","args":{"text":"ping"}}                                                                                                                                                   |
      | 3    | tool result | mcp returned: e-entry:echo:ping                                                                                                                                                                                            |

  Scenario: With a plugin.json, the marketplace entry's servers are ignored
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers": {"h": {"stub": {}}}}
      """
    Given the marketplace entry of the published plugin "demo" of the marketplace "fixtures" declares these stub mcp servers:
      """
      {"d": {"stub": {}}}
      """
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which warned
    Given pi runs with the scripted model and these companions:
      | companion      |
      | pi-mcp-adapter |
    Given pi-mcp-adapter has listed the tools of the stub mcp server "h" of the plugin "demo"
    Given the scripted model plays these steps:
      | reply | tool | arguments |
      |       | mcp  | {}        |
      | Done. |      |           |
    When the user prompts "list the plugin servers"
    Then the model receives these calls:
      | call | role        | text                                                                                                                                                                    |
      | 1    | user        | list the plugin servers                                                                                                                                                 |
      | 2    | user        | list the plugin servers                                                                                                                                                 |
      | 2    | assistant   | tool call mcp {}                                                                                                                                                        |
      | 2    | tool result | mcp returned: MCP: 0/1 servers, 1 tools\n\n○ plugin_demo_h_ (1 tools, cached; not listening)\n\nmcp({ server: "name" }) to list tools, mcp({ search: "..." }) to search |

  Scenario: An .mcpb bundle source makes the plugin partially available
    Claude Code unpacks and runs an MCP bundle. pi-mcp-adapter has no bundle
    runner, so this extension cannot run one (D-CF6-01).

    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".claude-plugin/plugin.json" with this text:
      """
      {"name": "demo", "version": "1.0.0", "mcpServers": "./server.mcpb"}
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file "server.mcpb" with this text:
      """
      not a bundle
      """
    Given the marketplace "fixtures" is added to the user scope
    When the user runs "/claude:plugin install demo@fixtures --scope user"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status              | reasons         | hint            |
      | fixtures         | user              | demo@fixtures | demo | partially-available | unsupported mcp | partial-install |

  Scenario: A server reference without ./ still loads, a recorded residual (D-CF6-01)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".claude-plugin/plugin.json" with this text:
      """
      {"name": "demo", "version": "1.0.0", "mcpServers": "servers.json"}
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file "servers.json" with these stub mcp servers:
      """
      {"mcpServers": {"r": {"stub": {}}}}
      """
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which warned
    Given pi runs with the scripted model and these companions:
      | companion      |
      | pi-mcp-adapter |
    Given pi-mcp-adapter has listed the tools of the stub mcp server "r" of the plugin "demo"
    When the user lists the mcp tools pi offers
    Then pi offers these mcp tools:
      | tool                     | active |
      | mcp                      | yes    |
      | mcp__plugin_demo_r__echo | no     |
