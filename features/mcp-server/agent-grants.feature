Feature: MCP server agent grants

  A plugin agent whose tools list grants a plugin MCP tool reaches it through
  pi-subagents and the active MCP implementation. The grant names
  pi-mcp-adapter's server key or Pi's built-in server name, by the
  implementation active when the agent is staged (MGRT-01); after a switch,
  the next session rewrites it (D-MB-03). pi-subagents 0.84.0 refuses a
  foreground agent its MCP tools under both implementations (D-CF6-10). A
  pi-subagents background child changes no grant and no installation state
  (MGRT-02); a Pi started with the marker pi-subagents sets in its runner plays
  that child. A stdio stub server, the built-in stand-in, a scripted model, and
  a local marketplace stand in.

  @adapter-only
  Scenario: Installing a plugin in a pi session stages its agent with pi-mcp-adapter's mcp grant (MGRT-01)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the stub mcp server "stub"
    Given the published plugin "demo" of the marketplace "fixtures" has the agent "runner" granted the mcp tool "mcp__plugin_demo_stub__echo"
    Given the marketplace "fixtures" is added to the user scope
    Given pi runs with the scripted model, pi-subagents, and the mcp implementation
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given the scripted model plays these steps:
      | reply               | tool     | arguments                              |
      |                     | subagent | {"action":"get","agent":"demo:runner"} |
      | The agent is shown. |          |                                        |
    When the user prompts "show the runner"
    Then the model receives these calls:
      | call | role        | text                                                                                                                                                                                                                                                                                                                                                                     |
      | 1    | user        | show the runner                                                                                                                                                                                                                                                                                                                                                          |
      | 2    | user        | show the runner                                                                                                                                                                                                                                                                                                                                                          |
      | 2    | assistant   | tool call subagent {"action":"get","agent":"demo:runner"}                                                                                                                                                                                                                                                                                                                |
      | 2    | tool result | subagent returned: agent demo:runner\npath {agent dir}/agents/pi-claude-marketplace-demo-runner.md\ndescription Calls the tools the task names.\naliases pi-claude-marketplace-demo-runner\ntools mcp:plugin_demo_stub_/echo\nsystem prompt mode replace\ninherit project context true\ninherit skills false\nasync true\nsystem prompt:\nCall the tools the task names. |

  @builtin-only
  Scenario: Installing a plugin in a pi session stages its agent with Pi's built-in mcp grant (MGRT-01)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the stub mcp server "stub"
    Given the published plugin "demo" of the marketplace "fixtures" has the agent "runner" granted the mcp tool "mcp__plugin_demo_stub__echo"
    Given the marketplace "fixtures" is added to the user scope
    Given pi runs with the scripted model, pi-subagents, and the mcp implementation
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given the scripted model plays these steps:
      | reply               | tool     | arguments                              |
      |                     | subagent | {"action":"get","agent":"demo:runner"} |
      | The agent is shown. |          |                                        |
    When the user prompts "show the runner"
    Then the model receives these calls:
      | call | role        | text                                                                                                                                                                                                                                                                                                                                                                    |
      | 1    | user        | show the runner                                                                                                                                                                                                                                                                                                                                                         |
      | 2    | user        | show the runner                                                                                                                                                                                                                                                                                                                                                         |
      | 2    | assistant   | tool call subagent {"action":"get","agent":"demo:runner"}                                                                                                                                                                                                                                                                                                               |
      | 2    | tool result | subagent returned: agent demo:runner\npath {agent dir}/agents/pi-claude-marketplace-demo-runner.md\ndescription Calls the tools the task names.\naliases pi-claude-marketplace-demo-runner\ntools mcp:plugin_demo_stub/echo\nsystem prompt mode replace\ninherit project context true\ninherit skills false\nasync true\nsystem prompt:\nCall the tools the task names. |

  @adapter-only
  Scenario: Updating a plugin in a pi session restages its agent with pi-mcp-adapter's mcp grant (MGRT-01)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the stub mcp server "stub"
    Given the published plugin "demo" of the marketplace "fixtures" has the agent "runner" granted the mcp tool "mcp__plugin_demo_stub__echo"
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.1.0   |
    Given pi runs with the scripted model, pi-subagents, and the mcp implementation
    Given the mcp implementation has listed the tools of the stub mcp server "stub" of the plugin "demo"
    Given the user has run "/claude:plugin update demo@fixtures --scope user", which did not fail
    Given the scripted model plays these steps:
      | reply               | tool     | arguments                              |
      |                     | subagent | {"action":"get","agent":"demo:runner"} |
      | The agent is shown. |          |                                        |
    When the user prompts "show the runner"
    Then the model receives these calls:
      | call | role        | text                                                                                                                                                                                                                                                                                                                                                                     |
      | 1    | user        | show the runner                                                                                                                                                                                                                                                                                                                                                          |
      | 2    | user        | show the runner                                                                                                                                                                                                                                                                                                                                                          |
      | 2    | assistant   | tool call subagent {"action":"get","agent":"demo:runner"}                                                                                                                                                                                                                                                                                                                |
      | 2    | tool result | subagent returned: agent demo:runner\npath {agent dir}/agents/pi-claude-marketplace-demo-runner.md\ndescription Calls the tools the task names.\naliases pi-claude-marketplace-demo-runner\ntools mcp:plugin_demo_stub_/echo\nsystem prompt mode replace\ninherit project context true\ninherit skills false\nasync true\nsystem prompt:\nCall the tools the task names. |

  @builtin-only
  Scenario: Updating a plugin in a pi session restages its agent with Pi's built-in mcp grant (MGRT-01)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the stub mcp server "stub"
    Given the published plugin "demo" of the marketplace "fixtures" has the agent "runner" granted the mcp tool "mcp__plugin_demo_stub__echo"
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.1.0   |
    Given a stand-in registers the stub mcp server "stub" of the plugin "demo" with pi's built-in mcp
    Given pi runs with the scripted model, pi-subagents, and the mcp implementation
    Given the mcp implementation has listed the tools of the stub mcp server "stub" of the plugin "demo"
    Given the user has run "/claude:plugin update demo@fixtures --scope user", which did not fail
    Given the scripted model plays these steps:
      | reply               | tool     | arguments                              |
      |                     | subagent | {"action":"get","agent":"demo:runner"} |
      | The agent is shown. |          |                                        |
    When the user prompts "show the runner"
    Then the model receives these calls:
      | call | role        | text                                                                                                                                                                                                                                                                                                                                                                    |
      | 1    | user        | show the runner                                                                                                                                                                                                                                                                                                                                                         |
      | 2    | user        | show the runner                                                                                                                                                                                                                                                                                                                                                         |
      | 2    | assistant   | tool call subagent {"action":"get","agent":"demo:runner"}                                                                                                                                                                                                                                                                                                               |
      | 2    | tool result | subagent returned: agent demo:runner\npath {agent dir}/agents/pi-claude-marketplace-demo-runner.md\ndescription Calls the tools the task names.\naliases pi-claude-marketplace-demo-runner\ntools mcp:plugin_demo_stub/echo\nsystem prompt mode replace\ninherit project context true\ninherit skills false\nasync true\nsystem prompt:\nCall the tools the task names. |

  @adapter-only
  Scenario: Reinstalling a plugin in a pi session restages its agent with pi-mcp-adapter's mcp grant (MGRT-01)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the stub mcp server "stub"
    Given the published plugin "demo" of the marketplace "fixtures" has the agent "runner" granted the mcp tool "mcp__plugin_demo_stub__echo"
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given pi runs with the scripted model, pi-subagents, and the mcp implementation
    Given the mcp implementation has listed the tools of the stub mcp server "stub" of the plugin "demo"
    Given the user has run "/claude:plugin reinstall demo@fixtures --scope user", which did not fail
    Given the scripted model plays these steps:
      | reply               | tool     | arguments                              |
      |                     | subagent | {"action":"get","agent":"demo:runner"} |
      | The agent is shown. |          |                                        |
    When the user prompts "show the runner"
    Then the model receives these calls:
      | call | role        | text                                                                                                                                                                                                                                                                                                                                                                     |
      | 1    | user        | show the runner                                                                                                                                                                                                                                                                                                                                                          |
      | 2    | user        | show the runner                                                                                                                                                                                                                                                                                                                                                          |
      | 2    | assistant   | tool call subagent {"action":"get","agent":"demo:runner"}                                                                                                                                                                                                                                                                                                                |
      | 2    | tool result | subagent returned: agent demo:runner\npath {agent dir}/agents/pi-claude-marketplace-demo-runner.md\ndescription Calls the tools the task names.\naliases pi-claude-marketplace-demo-runner\ntools mcp:plugin_demo_stub_/echo\nsystem prompt mode replace\ninherit project context true\ninherit skills false\nasync true\nsystem prompt:\nCall the tools the task names. |

  @builtin-only
  Scenario: Reinstalling a plugin in a pi session restages its agent with Pi's built-in mcp grant (MGRT-01)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the stub mcp server "stub"
    Given the published plugin "demo" of the marketplace "fixtures" has the agent "runner" granted the mcp tool "mcp__plugin_demo_stub__echo"
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given a stand-in registers the stub mcp server "stub" of the plugin "demo" with pi's built-in mcp
    Given pi runs with the scripted model, pi-subagents, and the mcp implementation
    Given the mcp implementation has listed the tools of the stub mcp server "stub" of the plugin "demo"
    Given the user has run "/claude:plugin reinstall demo@fixtures --scope user", which did not fail
    Given the scripted model plays these steps:
      | reply               | tool     | arguments                              |
      |                     | subagent | {"action":"get","agent":"demo:runner"} |
      | The agent is shown. |          |                                        |
    When the user prompts "show the runner"
    Then the model receives these calls:
      | call | role        | text                                                                                                                                                                                                                                                                                                                                                                    |
      | 1    | user        | show the runner                                                                                                                                                                                                                                                                                                                                                         |
      | 2    | user        | show the runner                                                                                                                                                                                                                                                                                                                                                         |
      | 2    | assistant   | tool call subagent {"action":"get","agent":"demo:runner"}                                                                                                                                                                                                                                                                                                               |
      | 2    | tool result | subagent returned: agent demo:runner\npath {agent dir}/agents/pi-claude-marketplace-demo-runner.md\ndescription Calls the tools the task names.\naliases pi-claude-marketplace-demo-runner\ntools mcp:plugin_demo_stub/echo\nsystem prompt mode replace\ninherit project context true\ninherit skills false\nasync true\nsystem prompt:\nCall the tools the task names. |

  @adapter-only
  Scenario: Enabling a disabled plugin in a pi session restages its agent with pi-mcp-adapter's mcp grant (MGRT-01)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the stub mcp server "stub"
    Given the published plugin "demo" of the marketplace "fixtures" has the agent "runner" granted the mcp tool "mcp__plugin_demo_stub__echo"
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given pi runs with the scripted model, pi-subagents, and the mcp implementation
    Given the mcp implementation has listed the tools of the stub mcp server "stub" of the plugin "demo"
    Given the user has run "/claude:plugin disable demo@fixtures --scope user", which did not fail
    Given the user has run "/claude:plugin enable demo@fixtures --scope user", which did not fail
    Given the scripted model plays these steps:
      | reply               | tool     | arguments                              |
      |                     | subagent | {"action":"get","agent":"demo:runner"} |
      | The agent is shown. |          |                                        |
    When the user prompts "show the runner"
    Then the model receives these calls:
      | call | role        | text                                                                                                                                                                                                                                                                                                                                                                     |
      | 1    | user        | show the runner                                                                                                                                                                                                                                                                                                                                                          |
      | 2    | user        | show the runner                                                                                                                                                                                                                                                                                                                                                          |
      | 2    | assistant   | tool call subagent {"action":"get","agent":"demo:runner"}                                                                                                                                                                                                                                                                                                                |
      | 2    | tool result | subagent returned: agent demo:runner\npath {agent dir}/agents/pi-claude-marketplace-demo-runner.md\ndescription Calls the tools the task names.\naliases pi-claude-marketplace-demo-runner\ntools mcp:plugin_demo_stub_/echo\nsystem prompt mode replace\ninherit project context true\ninherit skills false\nasync true\nsystem prompt:\nCall the tools the task names. |

  @builtin-only
  Scenario: Enabling a disabled plugin in a pi session restages its agent with Pi's built-in mcp grant (MGRT-01)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the stub mcp server "stub"
    Given the published plugin "demo" of the marketplace "fixtures" has the agent "runner" granted the mcp tool "mcp__plugin_demo_stub__echo"
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given a stand-in registers the stub mcp server "stub" of the plugin "demo" with pi's built-in mcp
    Given pi runs with the scripted model, pi-subagents, and the mcp implementation
    Given the mcp implementation has listed the tools of the stub mcp server "stub" of the plugin "demo"
    Given the user has run "/claude:plugin disable demo@fixtures --scope user", which did not fail
    Given the user has run "/claude:plugin enable demo@fixtures --scope user", which did not fail
    Given the scripted model plays these steps:
      | reply               | tool     | arguments                              |
      |                     | subagent | {"action":"get","agent":"demo:runner"} |
      | The agent is shown. |          |                                        |
    When the user prompts "show the runner"
    Then the model receives these calls:
      | call | role        | text                                                                                                                                                                                                                                                                                                                                                                    |
      | 1    | user        | show the runner                                                                                                                                                                                                                                                                                                                                                         |
      | 2    | user        | show the runner                                                                                                                                                                                                                                                                                                                                                         |
      | 2    | assistant   | tool call subagent {"action":"get","agent":"demo:runner"}                                                                                                                                                                                                                                                                                                               |
      | 2    | tool result | subagent returned: agent demo:runner\npath {agent dir}/agents/pi-claude-marketplace-demo-runner.md\ndescription Calls the tools the task names.\naliases pi-claude-marketplace-demo-runner\ntools mcp:plugin_demo_stub/echo\nsystem prompt mode replace\ninherit project context true\ninherit skills false\nasync true\nsystem prompt:\nCall the tools the task names. |

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

  @builtin-only
  Scenario: A foreground run of an agent granted a plugin MCP tool is refused before the child runs, under Pi's built-in MCP (D-CF6-10)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the stub mcp server "stub"
    Given the published plugin "demo" of the marketplace "fixtures" has the agent "runner" granted the mcp tool "mcp__plugin_demo_stub__echo"
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given a stand-in registers the stub mcp server "stub" of the plugin "demo" with pi's built-in mcp
    Given pi runs with the scripted model, pi-subagents, and the mcp implementation
    Given the mcp implementation has listed the tools of the stub mcp server "stub" of the plugin "demo"
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
      | 2    | tool result | subagent failed: error naming plugin_demo_stub                             |

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

  @own-implementation
  Scenario: A new session after a switch to Pi's built-in MCP gives an agent the built-in grant and keeps an agent without one (MGRT-01, D-MB-03)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the stub mcp server "stub"
    Given the published plugin "demo" of the marketplace "fixtures" has the agent "runner" granted the mcp tool "mcp__plugin_demo_stub__echo"
    Given the published plugin "demo" of the marketplace "fixtures" has these agents:
      | file      | name   | description                  | tools | body                           |
      | helper.md | helper | Reads the files it is given. | Read  | Read the files the task names. |
    Given the marketplace "fixtures" is added to the user scope
    Given the user's pi settings turn off pi's built-in mcp
    Given pi runs with the scripted model and these companions:
      | companion    |
      | pi-subagents |
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given the scripted model plays these steps:
      | reply                 | tool     | arguments                              |
      |                       | subagent | {"action":"get","agent":"demo:runner"} |
      |                       | subagent | {"action":"get","agent":"demo:helper"} |
      | The agents are shown. |          |                                        |
    When the user restarts pi with pi's built-in mcp turned on
    Then the session reports no results
    When the user prompts "show the agents"
    Then the model receives these calls:
      | call | role        | text                                                                                                                                                                                                                                                                                                                                                                    |
      | 1    | user        | show the agents                                                                                                                                                                                                                                                                                                                                                         |
      | 2    | user        | show the agents                                                                                                                                                                                                                                                                                                                                                         |
      | 2    | assistant   | tool call subagent {"action":"get","agent":"demo:runner"}                                                                                                                                                                                                                                                                                                               |
      | 2    | tool result | subagent returned: agent demo:runner\npath {agent dir}/agents/pi-claude-marketplace-demo-runner.md\ndescription Calls the tools the task names.\naliases pi-claude-marketplace-demo-runner\ntools mcp:plugin_demo_stub/echo\nsystem prompt mode replace\ninherit project context true\ninherit skills false\nasync true\nsystem prompt:\nCall the tools the task names. |
      | 3    | user        | show the agents                                                                                                                                                                                                                                                                                                                                                         |
      | 3    | assistant   | tool call subagent {"action":"get","agent":"demo:runner"}                                                                                                                                                                                                                                                                                                               |
      | 3    | tool result | subagent returned: agent demo:runner\npath {agent dir}/agents/pi-claude-marketplace-demo-runner.md\ndescription Calls the tools the task names.\naliases pi-claude-marketplace-demo-runner\ntools mcp:plugin_demo_stub/echo\nsystem prompt mode replace\ninherit project context true\ninherit skills false\nasync true\nsystem prompt:\nCall the tools the task names. |
      | 3    | assistant   | tool call subagent {"action":"get","agent":"demo:helper"}                                                                                                                                                                                                                                                                                                               |
      | 3    | tool result | subagent returned: agent demo:helper\npath {agent dir}/agents/pi-claude-marketplace-demo-helper.md\ndescription Reads the files it is given.\naliases pi-claude-marketplace-demo-helper\ntools read\nsystem prompt mode replace\ninherit project context true\ninherit skills false\nasync false\nsystem prompt:\nRead the files the task names.                        |

  @own-implementation
  Scenario: A session with no mcp implementation keeps the grant an agent holds (MGRT-01)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the stub mcp server "stub"
    Given the published plugin "demo" of the marketplace "fixtures" has the agent "runner" granted the mcp tool "mcp__plugin_demo_stub__echo"
    Given the marketplace "fixtures" is added to the user scope
    Given pi runs with the scripted model and these companions:
      | companion    |
      | pi-subagents |
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given the scripted model plays these steps:
      | reply               | tool     | arguments                              |
      |                     | subagent | {"action":"get","agent":"demo:runner"} |
      | The agent is shown. |          |                                        |
    When the user restarts pi with no mcp
    Then the session reports no results
    When the user prompts "show the runner"
    Then the model receives these calls:
      | call | role        | text                                                                                                                                                                                                                                                                                                                                                                    |
      | 1    | user        | show the runner                                                                                                                                                                                                                                                                                                                                                         |
      | 2    | user        | show the runner                                                                                                                                                                                                                                                                                                                                                         |
      | 2    | assistant   | tool call subagent {"action":"get","agent":"demo:runner"}                                                                                                                                                                                                                                                                                                               |
      | 2    | tool result | subagent returned: agent demo:runner\npath {agent dir}/agents/pi-claude-marketplace-demo-runner.md\ndescription Calls the tools the task names.\naliases pi-claude-marketplace-demo-runner\ntools mcp:plugin_demo_stub/echo\nsystem prompt mode replace\ninherit project context true\ninherit skills false\nasync true\nsystem prompt:\nCall the tools the task names. |

  @own-implementation
  Scenario: An agent an earlier release installed gets Pi's built-in grant at its first built-in session (MGRT-01)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the stub mcp server "stub"
    Given the published plugin "demo" of the marketplace "fixtures" has the agent "runner" granted the mcp tool "mcp__plugin_demo_stub__echo"
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given the agents index of the user scope holds the rows an earlier release wrote
    Given pi runs with the scripted model and these companions:
      | companion    |
      | pi-subagents |
    Given the scripted model plays these steps:
      | reply               | tool     | arguments                              |
      |                     | subagent | {"action":"get","agent":"demo:runner"} |
      | The agent is shown. |          |                                        |
    When the user prompts "show the runner"
    Then the model receives these calls:
      | call | role        | text                                                                                                                                                                                                                                                                                                                                                                    |
      | 1    | user        | show the runner                                                                                                                                                                                                                                                                                                                                                         |
      | 2    | user        | show the runner                                                                                                                                                                                                                                                                                                                                                         |
      | 2    | assistant   | tool call subagent {"action":"get","agent":"demo:runner"}                                                                                                                                                                                                                                                                                                               |
      | 2    | tool result | subagent returned: agent demo:runner\npath {agent dir}/agents/pi-claude-marketplace-demo-runner.md\ndescription Calls the tools the task names.\naliases pi-claude-marketplace-demo-runner\ntools mcp:plugin_demo_stub/echo\nsystem prompt mode replace\ninherit project context true\ninherit skills false\nasync true\nsystem prompt:\nCall the tools the task names. |

  @own-implementation
  Scenario: A pi-subagents background child leaves an agent's grant in the form it holds (MGRT-02)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the stub mcp server "stub"
    Given the published plugin "demo" of the marketplace "fixtures" has the agent "runner" granted the mcp tool "mcp__plugin_demo_stub__echo"
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given pi runs with the scripted model and pi-subagents as a pi-subagents background child
    Given the scripted model plays these steps:
      | reply               | tool     | arguments                              |
      |                     | subagent | {"action":"get","agent":"demo:runner"} |
      | The agent is shown. |          |                                        |
    When the user prompts "show the runner"
    Then the model receives these calls:
      | call | role        | text                                                                                                                                                                                                                                                                                                                                                                     |
      | 1    | user        | show the runner                                                                                                                                                                                                                                                                                                                                                          |
      | 2    | user        | show the runner                                                                                                                                                                                                                                                                                                                                                          |
      | 2    | assistant   | tool call subagent {"action":"get","agent":"demo:runner"}                                                                                                                                                                                                                                                                                                                |
      | 2    | tool result | subagent returned: agent demo:runner\npath {agent dir}/agents/pi-claude-marketplace-demo-runner.md\ndescription Calls the tools the task names.\naliases pi-claude-marketplace-demo-runner\ntools mcp:plugin_demo_stub_/echo\nsystem prompt mode replace\ninherit project context true\ninherit skills false\nasync true\nsystem prompt:\nCall the tools the task names. |
