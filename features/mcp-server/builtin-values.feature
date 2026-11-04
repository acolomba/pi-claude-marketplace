@builtin-only
Feature: MCP server builtin values

  Pi's built-in MCP holds, for each plugin server, the values Claude Code reads from its config
  (BLT-02, D-MB-02, D-MB-11, CC-1). Those values never reach a server process, so a probe of Pi's
  MCP registry stands in for what no stub can log, beside a stdio stub server and a local marketplace.

  Scenario: A stdio server's timeout reaches Pi in seconds and its tools stay deferred (BLT-02, D-MB-02, P2-DC-05)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the stub mcp server "stub" with these fields:
      """
      {"timeout": 2500}
      """
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given pi runs with the scripted model and a probe of the mcp servers registered with pi's built-in mcp
    Given the mcp implementation has listed the tools of the stub mcp server "stub" of the plugin "demo"
    When the user asks pi for the configs of the mcp servers registered with it
    Then pi holds these mcp server configs, apart from each stdio server's command and arguments:
      | name             | config                                                                                                                                                                                     |
      | plugin_demo_stub | {"env":{"CLAUDE_PLUGIN_ROOT":"{home}/marketplaces/fixtures/plugins/demo","CLAUDE_PLUGIN_DATA":"{agent dir}/pi-claude-marketplace/data/fixtures/demo"},"timeout":2.5,"exposure":"deferred"} |

  Scenario: A remote server reaches Pi as streamable HTTP with Claude Code's OAuth fields, and never with a client secret, name, or registration mode (BLT-02, D-MB-11)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with this text:
      """
      {
        "mcpServers": {
          "remote": {
            "type": "streamable-http",
            "url": "http://127.0.0.1:9/mcp",
            "headers": {"X-Api-Key": "key"},
            "oauth": {
              "clientId": "client",
              "callbackPort": 8765,
              "scopes": "read write",
              "authServerMetadataUrl": "https://127.0.0.1:9/.well-known/oauth-authorization-server",
              "clientSecret": "secret",
              "clientName": "Demo client",
              "clientRegistration": "dcr"
            }
          }
        }
      }
      """
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given pi runs with the scripted model and a probe of the mcp servers registered with pi's built-in mcp
    When the user asks pi for the configs of the mcp servers registered with it
    Then pi holds these mcp server configs, apart from each stdio server's command and arguments:
      | name               | config                                                                                                                                                                                                                                                                                    |
      | plugin_demo_remote | {"type":"http","url":"http://127.0.0.1:9/mcp","headers":{"X-Api-Key":"key"},"oauth":{"clientId":"client","callbackUrl":"http://localhost:8765/callback","authServerMetadataUrl":"https://127.0.0.1:9/.well-known/oauth-authorization-server","scope":"read write"},"exposure":"deferred"} |

  Scenario: Pi-only fields a plugin sets never reach Pi (BLT-02, CC-1)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the stub mcp server "stub" with these fields:
      """
      {
        "cwd": "/pi-claude-marketplace-no-such-directory",
        "toolExposure": {"echo": "direct"},
        "enabled": false,
        "auth": {"provider": "anthropic"}
      }
      """
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given pi runs with the scripted model and a probe of the mcp servers registered with pi's built-in mcp
    Given the mcp implementation has listed the tools of the stub mcp server "stub" of the plugin "demo"
    When the user asks pi for the configs of the mcp servers registered with it
    Then pi holds these mcp server configs, apart from each stdio server's command and arguments:
      | name             | config                                                                                                                                                                       |
      | plugin_demo_stub | {"env":{"CLAUDE_PLUGIN_ROOT":"{home}/marketplaces/fixtures/plugins/demo","CLAUDE_PLUGIN_DATA":"{agent dir}/pi-claude-marketplace/data/fixtures/demo"},"exposure":"deferred"} |

  Scenario: A server's description is the plugin's description (BLT-02, ANAME-06)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".claude-plugin/plugin.json" with this text:
      """
      {"name": "demo", "version": "1.0.0", "description": "Demo tools for the team."}
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the stub mcp server "stub"
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given pi runs with the scripted model and a probe of the mcp servers registered with pi's built-in mcp
    Given the mcp implementation has listed the tools of the stub mcp server "stub" of the plugin "demo"
    When the user asks pi for the configs of the mcp servers registered with it
    Then pi holds these mcp server configs, apart from each stdio server's command and arguments:
      | name             | config                                                                                                                                                                                                                |
      | plugin_demo_stub | {"env":{"CLAUDE_PLUGIN_ROOT":"{home}/marketplaces/fixtures/plugins/demo","CLAUDE_PLUGIN_DATA":"{agent dir}/pi-claude-marketplace/data/fixtures/demo"},"exposure":"deferred","description":"Demo tools for the team."} |

  Scenario: A server with alwaysLoad reaches Pi with direct exposure (D-MB-02)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the stub mcp server "stub" with these fields:
      """
      {"alwaysLoad": true}
      """
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given pi runs with the scripted model and a probe of the mcp servers registered with pi's built-in mcp
    Given the mcp implementation has listed the tools of the stub mcp server "stub" of the plugin "demo"
    When the user asks pi for the configs of the mcp servers registered with it
    Then pi holds these mcp server configs, apart from each stdio server's command and arguments:
      | name             | config                                                                                                                                                                     |
      | plugin_demo_stub | {"env":{"CLAUDE_PLUGIN_ROOT":"{home}/marketplaces/fixtures/plugins/demo","CLAUDE_PLUGIN_DATA":"{agent dir}/pi-claude-marketplace/data/fixtures/demo"},"exposure":"direct"} |
