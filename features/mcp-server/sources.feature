Feature: MCP server sources

  A plugin can declare its MCP servers in more than one place, and the active MCP implementation
  runs the servers Claude Code would run, merged in Claude Code's order: pi-mcp-adapter through its
  mcp tool (D-CF6-01, D-CF6-05), and Pi's built-in MCP through the servers the extension registers
  (BLT-02, D-CF6-01). Each stub server tags its echo with the source that declared it. The stub
  stands in for a real server, a scripted model for a real model, and a local marketplace for a
  published one.

  @adapter-only
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
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given pi runs with the scripted model and these companions:
      | companion      |
      | pi-mcp-adapter |
    Given pi-mcp-adapter has listed the tools of the stub mcp server "a" of the plugin "demo"
    Given pi-mcp-adapter has listed the tools of the stub mcp server "c" of the plugin "demo"
    Given pi-mcp-adapter has listed the tools of the stub mcp server "b" of the plugin "demo"
    Given the scripted model plays these steps:
      | reply | tool | arguments                                                      |
      |       | mcp  | {}                                                             |
      |       | mcp  | {"tool": "mcp__plugin_demo_a__echo", "args": {"text": "ping"}} |
      | Done. |      |                                                                |
    When the user prompts "call the merged server"
    Then the model receives these calls:
      | call | role        | text                                                                              |
      | 1    | user        | call the merged server                                                            |
      | 2    | user        | call the merged server                                                            |
      | 2    | assistant   | tool call mcp {}                                                                  |
      | 2    | tool result | mcp returned: server plugin_demo_a_\nserver plugin_demo_c_\nserver plugin_demo_b_ |
      | 3    | user        | call the merged server                                                            |
      | 3    | assistant   | tool call mcp {}                                                                  |
      | 3    | tool result | mcp returned: server plugin_demo_a_\nserver plugin_demo_c_\nserver plugin_demo_b_ |
      | 3    | assistant   | tool call mcp {"tool":"mcp__plugin_demo_a__echo","args":{"text":"ping"}}          |
      | 3    | tool result | mcp returned: a-manifest:echo:ping                                                |

  @builtin-only
  Scenario: Pi's built-in MCP registers the union of a plugin's .mcp.json and plugin.json servers in Claude Code's merge order (BLT-02, D-CF6-01)
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
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given pi runs with the scripted model and the mcp implementation
    Given the mcp implementation has listed the tools of the stub mcp server "a" of the plugin "demo"
    Given the mcp implementation has listed the tools of the stub mcp server "c" of the plugin "demo"
    Given the mcp implementation has listed the tools of the stub mcp server "b" of the plugin "demo"
    When the user lists the mcp tools pi offers
    Then pi lists these registered mcp servers:
      | name          |
      | plugin_demo_a |
      | plugin_demo_c |
      | plugin_demo_b |

  @builtin-only
  Scenario: Under Pi's built-in MCP the plugin.json declaration of a server name the .mcp.json shares wins (BLT-02, D-CF6-01)
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
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given pi runs with the scripted model and the mcp implementation
    Given the mcp implementation has listed the tools of the stub mcp server "a" of the plugin "demo"
    Given the mcp implementation has listed the tools of the stub mcp server "c" of the plugin "demo"
    Given the mcp implementation has listed the tools of the stub mcp server "b" of the plugin "demo"
    Given the scripted model plays these steps:
      | reply | tool                     | arguments                             |
      |       | tool_search              | {"query": "mcp__plugin_demo_a__echo"} |
      |       | mcp__plugin_demo_a__echo | {"text": "ping"}                      |
      | Done. |                          |                                       |
    When the user prompts "call the merged server"
    Then the model receives these calls, with each tool search reduced to the tools it loads:
      | call | role        | text                                                                                                                                                                                                           |
      | 1    | user        | call the merged server                                                                                                                                                                                         |
      | 2    | user        | call the merged server                                                                                                                                                                                         |
      | 2    | assistant   | tool call tool_search {"query":"mcp__plugin_demo_a__echo"}                                                                                                                                                     |
      | 2    | tool result | tool_search returned: found mcp__plugin_demo_a__echo: Echoes the text it is given.\nfound mcp__plugin_demo_b__echo: Echoes the text it is given.\nfound mcp__plugin_demo_c__echo: Echoes the text it is given. |
      | 3    | user        | call the merged server                                                                                                                                                                                         |
      | 3    | assistant   | tool call tool_search {"query":"mcp__plugin_demo_a__echo"}                                                                                                                                                     |
      | 3    | tool result | tool_search returned: found mcp__plugin_demo_a__echo: Echoes the text it is given.\nfound mcp__plugin_demo_b__echo: Echoes the text it is given.\nfound mcp__plugin_demo_c__echo: Echoes the text it is given. |
      | 3    | assistant   | tool call mcp__plugin_demo_a__echo {"text":"ping"}                                                                                                                                                             |
      | 3    | tool result | mcp__plugin_demo_a__echo returned: a-manifest:echo:ping                                                                                                                                                        |

  @adapter-only
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
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given pi runs with the scripted model and these companions:
      | companion      |
      | pi-mcp-adapter |
    Given pi-mcp-adapter has listed the tools of the stub mcp server "x" of the plugin "demo"
    Given pi-mcp-adapter has listed the tools of the stub mcp server "z" of the plugin "demo"
    Given pi-mcp-adapter has listed the tools of the stub mcp server "y" of the plugin "demo"
    Given the scripted model plays these steps:
      | reply | tool | arguments                                                      |
      |       | mcp  | {}                                                             |
      |       | mcp  | {"tool": "mcp__plugin_demo_x__echo", "args": {"text": "ping"}} |
      | Done. |      |                                                                |
    When the user prompts "call the array server"
    Then the model receives these calls:
      | call | role        | text                                                                              |
      | 1    | user        | call the array server                                                             |
      | 2    | user        | call the array server                                                             |
      | 2    | assistant   | tool call mcp {}                                                                  |
      | 2    | tool result | mcp returned: server plugin_demo_x_\nserver plugin_demo_z_\nserver plugin_demo_y_ |
      | 3    | user        | call the array server                                                             |
      | 3    | assistant   | tool call mcp {}                                                                  |
      | 3    | tool result | mcp returned: server plugin_demo_x_\nserver plugin_demo_z_\nserver plugin_demo_y_ |
      | 3    | assistant   | tool call mcp {"tool":"mcp__plugin_demo_x__echo","args":{"text":"ping"}}          |
      | 3    | tool result | mcp returned: x-fileb:echo:ping                                                   |

  @builtin-only
  Scenario: Pi's built-in MCP registers the servers of an array of MCP sources in Claude Code's order (BLT-02, D-CF6-01)
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
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given pi runs with the scripted model and the mcp implementation
    Given the mcp implementation has listed the tools of the stub mcp server "x" of the plugin "demo"
    Given the mcp implementation has listed the tools of the stub mcp server "z" of the plugin "demo"
    Given the mcp implementation has listed the tools of the stub mcp server "y" of the plugin "demo"
    When the user lists the mcp tools pi offers
    Then pi lists these registered mcp servers:
      | name          |
      | plugin_demo_x |
      | plugin_demo_z |
      | plugin_demo_y |

  @builtin-only
  Scenario: Under Pi's built-in MCP a later MCP source of an array replaces an earlier server (BLT-02, D-CF6-01)
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
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given pi runs with the scripted model and the mcp implementation
    Given the mcp implementation has listed the tools of the stub mcp server "x" of the plugin "demo"
    Given the mcp implementation has listed the tools of the stub mcp server "z" of the plugin "demo"
    Given the mcp implementation has listed the tools of the stub mcp server "y" of the plugin "demo"
    Given the scripted model plays these steps:
      | reply | tool                     | arguments                             |
      |       | tool_search              | {"query": "mcp__plugin_demo_x__echo"} |
      |       | mcp__plugin_demo_x__echo | {"text": "ping"}                      |
      | Done. |                          |                                       |
    When the user prompts "call the array server"
    Then the model receives these calls, with each tool search reduced to the tools it loads:
      | call | role        | text                                                                                                                                                                                                           |
      | 1    | user        | call the array server                                                                                                                                                                                          |
      | 2    | user        | call the array server                                                                                                                                                                                          |
      | 2    | assistant   | tool call tool_search {"query":"mcp__plugin_demo_x__echo"}                                                                                                                                                     |
      | 2    | tool result | tool_search returned: found mcp__plugin_demo_x__echo: Echoes the text it is given.\nfound mcp__plugin_demo_y__echo: Echoes the text it is given.\nfound mcp__plugin_demo_z__echo: Echoes the text it is given. |
      | 3    | user        | call the array server                                                                                                                                                                                          |
      | 3    | assistant   | tool call tool_search {"query":"mcp__plugin_demo_x__echo"}                                                                                                                                                     |
      | 3    | tool result | tool_search returned: found mcp__plugin_demo_x__echo: Echoes the text it is given.\nfound mcp__plugin_demo_y__echo: Echoes the text it is given.\nfound mcp__plugin_demo_z__echo: Echoes the text it is given. |
      | 3    | assistant   | tool call mcp__plugin_demo_x__echo {"text":"ping"}                                                                                                                                                             |
      | 3    | tool result | mcp__plugin_demo_x__echo returned: x-fileb:echo:ping                                                                                                                                                           |

  @adapter-only
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
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given pi runs with the scripted model and these companions:
      | companion      |
      | pi-mcp-adapter |
    Given pi-mcp-adapter has listed the tools of the stub mcp server "e" of the plugin "demo"
    Given pi-mcp-adapter has listed the tools of the stub mcp server "f" of the plugin "demo"
    Given the scripted model plays these steps:
      | reply | tool | arguments                                                      |
      |       | mcp  | {}                                                             |
      |       | mcp  | {"tool": "mcp__plugin_demo_e__echo", "args": {"text": "ping"}} |
      | Done. |      |                                                                |
    When the user prompts "call the entry server"
    Then the model receives these calls:
      | call | role        | text                                                                     |
      | 1    | user        | call the entry server                                                    |
      | 2    | user        | call the entry server                                                    |
      | 2    | assistant   | tool call mcp {}                                                         |
      | 2    | tool result | mcp returned: server plugin_demo_e_\nserver plugin_demo_f_               |
      | 3    | user        | call the entry server                                                    |
      | 3    | assistant   | tool call mcp {}                                                         |
      | 3    | tool result | mcp returned: server plugin_demo_e_\nserver plugin_demo_f_               |
      | 3    | assistant   | tool call mcp {"tool":"mcp__plugin_demo_e__echo","args":{"text":"ping"}} |
      | 3    | tool result | mcp returned: e-entry:echo:ping                                          |

  @builtin-only
  Scenario: Without a plugin.json, Pi's built-in MCP registers the marketplace entry's servers after the .mcp.json servers (BLT-02, D-CF6-01)
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
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given pi runs with the scripted model and the mcp implementation
    Given the mcp implementation has listed the tools of the stub mcp server "e" of the plugin "demo"
    Given the mcp implementation has listed the tools of the stub mcp server "f" of the plugin "demo"
    When the user lists the mcp tools pi offers
    Then pi lists these registered mcp servers:
      | name          |
      | plugin_demo_e |
      | plugin_demo_f |

  @builtin-only
  Scenario: Without a plugin.json, Pi's built-in MCP runs the marketplace entry's declaration of a shared server name (BLT-02, D-CF6-01)
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
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given pi runs with the scripted model and the mcp implementation
    Given the mcp implementation has listed the tools of the stub mcp server "e" of the plugin "demo"
    Given the mcp implementation has listed the tools of the stub mcp server "f" of the plugin "demo"
    Given the scripted model plays these steps:
      | reply | tool                     | arguments                             |
      |       | tool_search              | {"query": "mcp__plugin_demo_e__echo"} |
      |       | mcp__plugin_demo_e__echo | {"text": "ping"}                      |
      | Done. |                          |                                       |
    When the user prompts "call the entry server"
    Then the model receives these calls, with each tool search reduced to the tools it loads:
      | call | role        | text                                                                                                                                             |
      | 1    | user        | call the entry server                                                                                                                            |
      | 2    | user        | call the entry server                                                                                                                            |
      | 2    | assistant   | tool call tool_search {"query":"mcp__plugin_demo_e__echo"}                                                                                       |
      | 2    | tool result | tool_search returned: found mcp__plugin_demo_e__echo: Echoes the text it is given.\nfound mcp__plugin_demo_f__echo: Echoes the text it is given. |
      | 3    | user        | call the entry server                                                                                                                            |
      | 3    | assistant   | tool call tool_search {"query":"mcp__plugin_demo_e__echo"}                                                                                       |
      | 3    | tool result | tool_search returned: found mcp__plugin_demo_e__echo: Echoes the text it is given.\nfound mcp__plugin_demo_f__echo: Echoes the text it is given. |
      | 3    | assistant   | tool call mcp__plugin_demo_e__echo {"text":"ping"}                                                                                               |
      | 3    | tool result | mcp__plugin_demo_e__echo returned: e-entry:echo:ping                                                                                             |

  @adapter-only
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
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
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
      | call | role        | text                                |
      | 1    | user        | list the plugin servers             |
      | 2    | user        | list the plugin servers             |
      | 2    | assistant   | tool call mcp {}                    |
      | 2    | tool result | mcp returned: server plugin_demo_h_ |

  @builtin-only
  Scenario: With a plugin.json, Pi's built-in MCP registers none of the marketplace entry's servers (BLT-02, D-CF6-01)
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
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given pi runs with the scripted model and the mcp implementation
    Given the mcp implementation has listed the tools of the stub mcp server "h" of the plugin "demo"
    When the user lists the mcp tools pi offers
    Then pi lists these registered mcp servers:
      | name          |
      | plugin_demo_h |

  @mcp
  Scenario: An .mcpb bundle source makes the plugin partially available
    Claude Code unpacks and runs an MCP bundle. Neither MCP implementation has a
    bundle runner, so this extension cannot run one (D-CF6-01).

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

  @mcp
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
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given pi runs with the scripted model and the mcp implementation
    Given the mcp implementation has listed the tools of the stub mcp server "r" of the plugin "demo"
    When the user lists the mcp tools pi offers
    Then pi offers these plugin mcp tools:
      | tool                     | active |
      | mcp__plugin_demo_r__echo | no     |

  @mcp
  Scenario: A server reference that is a symbolic link to a file inside the plugin loads its servers
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".claude-plugin/plugin.json" with this text:
      """
      {"name": "demo", "version": "1.0.0", "mcpServers": "./servers.json"}
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file "config/servers.json" with these stub mcp servers:
      """
      {"mcpServers": {"r": {"stub": {}}}}
      """
    Given the mcp file "servers.json" of the published plugin "demo" of the marketplace "fixtures" is a symbolic link to "config/servers.json"
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given pi runs with the scripted model and the mcp implementation
    Given the mcp implementation has listed the tools of the stub mcp server "r" of the plugin "demo"
    When the user lists the mcp tools pi offers
    Then pi offers these plugin mcp tools:
      | tool                     | active |
      | mcp__plugin_demo_r__echo | no     |
