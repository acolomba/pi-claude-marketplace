Feature: MCP server invocation

  A plugin's MCP server is reached through pi-mcp-adapter, and the model
  receives what the server returns. A stdio stub server stands in for a real
  one, a scripted model for a real model, and a local marketplace for a
  published one. pi-subagents 0.84.0 gives a foreground agent no MCP tool,
  a recorded companion gap (D-CF6-10), so the agent scenarios pin that gap.

  Scenario: A scripted call through the mcp tool reaches the plugin's server and returns its result
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

  Scenario: A variable set after install reaches the plugin's server when it connects
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the stub mcp server "stub" with "STUB_TAG" set to "${PI_CM_STUB_TAG:-install-default}"
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which warned
    Given pi runs with the scripted model, pi-mcp-adapter, and the environment variable "PI_CM_STUB_TAG" set to "late"
    Given pi-mcp-adapter has listed the tools of the stub mcp server "stub" of the plugin "demo"
    Given the scripted model plays these steps:
      | reply | tool | arguments                                                          |
      |       | mcp  | {"tool": "mcp__plugin_demo_stub__echo", "args": {"text": "ping"}} |
      | Done. |      |                                                                    |
    When the user prompts "call the stub"
    Then the model receives these calls:
      | call | role        | text                                                                        |
      | 1    | user        | call the stub                                                               |
      | 2    | user        | call the stub                                                               |
      | 2    | assistant   | tool call mcp {"tool":"mcp__plugin_demo_stub__echo","args":{"text":"ping"}} |
      | 2    | tool result | mcp returned: late:echo:ping                                                |

  Scenario: A direct call to the tool a search activated reaches the plugin's server
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
      | reply | tool                        | arguments          |
      |       | mcp                         | {"search": "echo"} |
      |       | mcp__plugin_demo_stub__echo | {"text": "direct"} |
      | Done. |                             |                    |
    When the user prompts "call the echo tool directly"
    Then the model receives these calls:
      | call | role        | text                                                                                                                                                                                                     |
      | 1    | user        | call the echo tool directly                                                                                                                                                                              |
      | 2    | user        | call the echo tool directly                                                                                                                                                                              |
      | 2    | assistant   | tool call mcp {"search":"echo"}                                                                                                                                                                          |
      | 2    | tool result | mcp returned: Activated as direct tools: mcp__plugin_demo_stub__echo.\n\nFound 1 tool matching "echo":\n\nmcp__plugin_demo_stub__echo\n  Echoes the text it is given.\n\n  Shape:\n    { text: string; } |
      | 3    | user        | call the echo tool directly                                                                                                                                                                              |
      | 3    | assistant   | tool call mcp {"search":"echo"}                                                                                                                                                                          |
      | 3    | tool result | mcp returned: Activated as direct tools: mcp__plugin_demo_stub__echo.\n\nFound 1 tool matching "echo":\n\nmcp__plugin_demo_stub__echo\n  Echoes the text it is given.\n\n  Shape:\n    { text: string; } |
      | 3    | assistant   | tool call mcp__plugin_demo_stub__echo {"text":"direct"}                                                                                                                                                  |
      | 3    | tool result | mcp__plugin_demo_stub__echo returned: echo:direct                                                                                                                                                        |
    Then the stub mcp server "stub" of the plugin "demo" receives these messages:
      | kind         | method                    | params                                                                                                                                                                                                                                                          |
      | request      | initialize                | {"protocolVersion":"2025-11-25","capabilities":{"extensions":{"io.modelcontextprotocol/ui":{"mimeTypes":["text/html;profile=mcp-app"]}},"sampling":{},"roots":{},"elicitation":{"form":{}}},"clientInfo":{"name":"pi-mcp-plugin_demo_stub_","version":"1.0.0"}} |
      | notification | notifications/initialized |                                                                                                                                                                                                                                                                 |
      | request      | tools/list                |                                                                                                                                                                                                                                                                 |
      | request      | initialize                | {"protocolVersion":"2025-11-25","capabilities":{"extensions":{"io.modelcontextprotocol/ui":{"mimeTypes":["text/html;profile=mcp-app"]}},"sampling":{},"roots":{},"elicitation":{"form":{}}},"clientInfo":{"name":"pi-mcp-plugin_demo_stub_","version":"1.0.0"}} |
      | notification | notifications/initialized |                                                                                                                                                                                                                                                                 |
      | request      | tools/list                |                                                                                                                                                                                                                                                                 |
      | request      | tools/call                | {"name":"echo","arguments":{"text":"direct"},"_meta":{"pi-mcp-adapter/toolCallId":"{tool call 2}","progressToken":2}}                                                                                                                                           |

  Scenario: A call to a tool the plugin's server does not list is never sent to the server
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
      | reply | tool | arguments                                                            |
      |       | mcp  | {"tool": "mcp__plugin_demo_stub__missing", "args": {"text": "ping"}} |
      | Done. |      |                                                                      |
    When the user prompts "call the missing tool"
    Then the model receives these calls:
      | call | role        | text                                                                                                                       |
      | 1    | user        | call the missing tool                                                                                                      |
      | 2    | user        | call the missing tool                                                                                                      |
      | 2    | assistant   | tool call mcp {"tool":"mcp__plugin_demo_stub__missing","args":{"text":"ping"}}                                             |
      | 2    | tool result | mcp returned: Tool "mcp__plugin_demo_stub__missing" not found. Server "plugin_demo_stub_" has: mcp__plugin_demo_stub__echo |
    Then the stub mcp server "stub" of the plugin "demo" receives these messages:
      | kind         | method                    | params                                                                                                                                                                                                                                                          |
      | request      | initialize                | {"protocolVersion":"2025-11-25","capabilities":{"extensions":{"io.modelcontextprotocol/ui":{"mimeTypes":["text/html;profile=mcp-app"]}},"sampling":{},"roots":{},"elicitation":{"form":{}}},"clientInfo":{"name":"pi-mcp-plugin_demo_stub_","version":"1.0.0"}} |
      | notification | notifications/initialized |                                                                                                                                                                                                                                                                 |
      | request      | tools/list                |                                                                                                                                                                                                                                                                 |
      | request      | initialize                | {"protocolVersion":"2025-11-25","capabilities":{"extensions":{"io.modelcontextprotocol/ui":{"mimeTypes":["text/html;profile=mcp-app"]}},"sampling":{},"roots":{},"elicitation":{"form":{}}},"clientInfo":{"name":"pi-mcp-plugin_demo_stub_","version":"1.0.0"}} |
      | notification | notifications/initialized |                                                                                                                                                                                                                                                                 |
      | request      | tools/list                |                                                                                                                                                                                                                                                                 |

  Scenario: A foreground run of an agent granted a plugin MCP tool is refused before the child runs (D-CF6-10)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the stub mcp server "stub"
    Given the published plugin "demo" of the marketplace "fixtures" has the agent "runner" granted the mcp tool "mcp__plugin_demo_stub__echo"
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which warned
    Given pi runs with the scripted model and these companions:
      | companion      |
      | pi-subagents   |
      | pi-mcp-adapter |
    Given pi-mcp-adapter has listed the tools of the stub mcp server "stub" of the plugin "demo"
    Given the scripted model plays these steps:
      | reply | tool     | arguments                                               |
      |       | subagent | {"agent":"demo:runner","task":"say ping","async":false} |
      | Done. |          |                                                         |
    When the user prompts "ask the runner to say ping"
    Then the model receives these calls:
      | call | role        | text                                                                                                                                                                                                                                                 |
      | 1    | user        | ask the runner to say ping                                                                                                                                                                                                                           |
      | 2    | user        | ask the runner to say ping                                                                                                                                                                                                                           |
      | 2    | assistant   | tool call subagent {"agent":"demo:runner","task":"say ping","async":false}                                                                                                                                                                           |
      | 2    | tool result | subagent failed: Unresolved MCP direct-tool selectors: plugin_demo_stub_/echo. Direct MCP tools require a matching configured server and fresh metadata cache; runtime-registered servers require a host/pi-mcp-adapter handoff before child launch. |
    Then the stub mcp server "stub" of the plugin "demo" receives these messages:
      | kind         | method                    | params                                                                                                                                                                                                                                                          |
      | request      | initialize                | {"protocolVersion":"2025-11-25","capabilities":{"extensions":{"io.modelcontextprotocol/ui":{"mimeTypes":["text/html;profile=mcp-app"]}},"sampling":{},"roots":{},"elicitation":{"form":{}}},"clientInfo":{"name":"pi-mcp-plugin_demo_stub_","version":"1.0.0"}} |
      | notification | notifications/initialized |                                                                                                                                                                                                                                                                 |
      | request      | tools/list                |                                                                                                                                                                                                                                                                 |

  Scenario: A foreground agent without a tools list runs without the plugin's MCP tools (D-CF6-10)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the stub mcp server "stub"
    Given the published plugin "demo" of the marketplace "fixtures" has the agent "helper" with no mcp tools
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which warned
    Given pi runs with the scripted model and these companions:
      | companion      |
      | pi-subagents   |
      | pi-mcp-adapter |
    Given pi-mcp-adapter has listed the tools of the stub mcp server "stub" of the plugin "demo"
    Given the scripted model plays these steps:
      | reply | tool     | arguments                                               |
      |       | subagent | {"agent":"demo:helper","task":"say ping","async":false} |
      | pong  |          |                                                         |
      | Done. |          |                                                         |
    When the user prompts "ask the helper to say ping"
    Then the model calls are offered these tools:
      | call | tools                                                                                                                                                   |
      | 1    | read, bash, edit, write, pi_claude_marketplace_list, pi_claude_marketplace_plugin_list, subagent, contact_supervisor, bg_wait, mcp, subagent_supervisor |
      | 2    | read, bash, edit, write, bg_wait, contact_supervisor                                                                                                    |
      | 3    | read, bash, edit, write, pi_claude_marketplace_list, pi_claude_marketplace_plugin_list, subagent, contact_supervisor, bg_wait, mcp, subagent_supervisor |
    Then the model receives these calls:
      | call | role        | text                                                                                       |
      | 1    | user        | ask the helper to say ping                                                                 |
      | 2    | user        | Task: say ping                                                                             |
      | 3    | user        | ask the helper to say ping                                                                 |
      | 3    | assistant   | tool call subagent {"agent":"demo:helper","task":"say ping","async":false}                 |
      | 3    | tool result | subagent returned: Run fan-out: 1/64 used, 63 remaining\npong\nMission: {uuid} (completed) |
    Then the stub mcp server "stub" of the plugin "demo" receives these messages:
      | kind         | method                    | params                                                                                                                                                                                                                                                          |
      | request      | initialize                | {"protocolVersion":"2025-11-25","capabilities":{"extensions":{"io.modelcontextprotocol/ui":{"mimeTypes":["text/html;profile=mcp-app"]}},"sampling":{},"roots":{},"elicitation":{"form":{}}},"clientInfo":{"name":"pi-mcp-plugin_demo_stub_","version":"1.0.0"}} |
      | notification | notifications/initialized |                                                                                                                                                                                                                                                                 |
      | request      | tools/list                |                                                                                                                                                                                                                                                                 |

  Scenario: Installing an agent granted a plugin MCP tool stages it to run in the background (D-CF6-10)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the stub mcp server "stub"
    Given the published plugin "demo" of the marketplace "fixtures" has the agent "runner" granted the mcp tool "mcp__plugin_demo_stub__echo"
    Given the marketplace "fixtures" is added to the user scope
    When the user runs "/claude:plugin install demo@fixtures --scope user"
    Then the command reports these results:
      | kind    | severity | needs reload | summary                             |
      | cascade | warning  | true         | A plugin operation needs attention. |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons                                        | scope | version |
      | fixtures         | user              | demo@fixtures | demo | installed | requires pi-subagents, requires pi-mcp-adapter | user  | 1.0.0   |
    Then the agents folder of the user scope holds the file "pi-claude-marketplace-demo-runner.md" with this text:
      """
      ---
      name: demo:runner
      description: Calls the tools the task names.
      aliases: pi-claude-marketplace-demo-runner
      tools: mcp:plugin_demo_stub_/echo
      systemPromptMode: replace
      inheritProjectContext: true
      inheritSkills: false
      advertise: true
      async: true
      provenance:
        generatedBy: pi-claude-marketplace
        sourcePlugin: demo
        sourceAgent: runner
        sourcePath: {home}/marketplaces/fixtures/plugins/demo/agents/runner.md
        droppedFields: []
        droppedTools: []
        warnings:
          - tools include MCP tools, which pi-subagents serves only to background children -- the agent runs in the background (`async: true`), where Claude Code runs it in the foreground; a launch before pi-mcp-adapter has cached the server's tools still fails
      ---

      Call the tools the task names.
      """
