Feature: MCP server agent grants

  A plugin agent whose tools list grants a plugin MCP tool reaches it through
  pi-subagents and the active MCP implementation. pi-subagents 0.84.0 gives a
  foreground agent no MCP tool, a recorded companion gap (D-CF6-10). The three
  D-CF6-10 scenarios pin that gap and pi-mcp-adapter's grant form, so they run
  under pi-mcp-adapter only. A pi-subagents background child that loads this
  extension changes no installation state (MGRT-02). A Pi started with the
  marker pi-subagents sets in its runner process plays that child. A stdio stub
  server, a scripted model, and a local marketplace stand in.

  @adapter-only
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
      | call | role        | text                                                                       |
      | 1    | user        | ask the runner to say ping                                                 |
      | 2    | user        | ask the runner to say ping                                                 |
      | 2    | assistant   | tool call subagent {"agent":"demo:runner","task":"say ping","async":false} |
      | 2    | tool result | subagent failed: error naming plugin_demo_stub_/echo                       |
    Then the stub mcp server "stub" of the plugin "demo" receives these messages:
      | kind         | method                    | params                                                                                                                                                                                                                                                          |
      | request      | initialize                | {"protocolVersion":"2025-11-25","capabilities":{"extensions":{"io.modelcontextprotocol/ui":{"mimeTypes":["text/html;profile=mcp-app"]}},"sampling":{},"roots":{},"elicitation":{"form":{}}},"clientInfo":{"name":"pi-mcp-plugin_demo_stub_","version":"1.0.0"}} |
      | notification | notifications/initialized |                                                                                                                                                                                                                                                                 |
      | request      | tools/list                |                                                                                                                                                                                                                                                                 |

  @adapter-only
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
    Then the model calls are offered these marketplace tools:
      | call | tools                                                         |
      | 1    | pi_claude_marketplace_list, pi_claude_marketplace_plugin_list |
      | 2    |                                                               |
      | 3    | pi_claude_marketplace_list, pi_claude_marketplace_plugin_list |
    Then the model receives these calls:
      | call | role        | text                                                                       |
      | 1    | user        | ask the helper to say ping                                                 |
      | 2    | user        | task say ping                                                              |
      | 3    | user        | ask the helper to say ping                                                 |
      | 3    | assistant   | tool call subagent {"agent":"demo:helper","task":"say ping","async":false} |
      | 3    | tool result | subagent returned: pong                                                    |
    Then the stub mcp server "stub" of the plugin "demo" receives these messages:
      | kind         | method                    | params                                                                                                                                                                                                                                                          |
      | request      | initialize                | {"protocolVersion":"2025-11-25","capabilities":{"extensions":{"io.modelcontextprotocol/ui":{"mimeTypes":["text/html;profile=mcp-app"]}},"sampling":{},"roots":{},"elicitation":{"form":{}}},"clientInfo":{"name":"pi-mcp-plugin_demo_stub_","version":"1.0.0"}} |
      | notification | notifications/initialized |                                                                                                                                                                                                                                                                 |
      | request      | tools/list                |                                                                                                                                                                                                                                                                 |

  @adapter-only
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
      | marketplace name | marketplace scope | id            | name | status    | reasons               | scope | version |
      | fixtures         | user              | demo@fixtures | demo | installed | requires pi-subagents | user  | 1.0.0   |
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

  Scenario: A pi-subagents background child with autoapply on installs nothing (MGRT-02)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given a config in scope project and layer base, with this text:
      """
      { "autoapply": true }
      """
    Given the marketplace "fixtures" is added to the project scope
    Given a config in scope project and layer base, with these plugins:
      | marketplace | plugin | enabled |
      | fixtures    | demo   |         |
    Given pi runs with the scripted model and pi-subagents as a pi-subagents background child
    When the user starts a new pi session
    Then the session reports these results:
      | kind    | severity | needs reload | needs apply | tally label       | tally failures | tally warnings | tally success count |
      | cascade | info     | false        | true        | Reconcile pending | 0              | 0              | 1                   |
      | cascade | info     | false        | true        | Reconcile pending | 0              | 0              | 1                   |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status       | reasons | scope   |
      | fixtures         | project           | demo@fixtures | demo | will install |         | project |
      | fixtures         | project           | demo@fixtures | demo | will install |         | project |
    Then the project scope has no installed plugins
