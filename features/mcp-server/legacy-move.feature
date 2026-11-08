Feature: MCP server legacy move

  A user upgrading from a release that wrote plugin MCP servers into mcp.json has them moved on
  load. An mcp.json in that release's shape stands in for the upgrade, a local marketplace for a
  published one, and a stdio stub server for a real one.

  @mcp
  Scenario: A load moves a plugin's servers out of a release 0.19.2 mcp.json and keeps the user's own server
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" declares the mcp server "srv"
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given the mcp.json file of the user scope holds the servers of the plugin "demo@fixtures" as release 0.19.2 wrote them, beside the user's own server "mine"
    When the user starts a new pi session
    Then the session reports these results:
      | kind          | severity | needs reload | notices | rows                                                                                                          |
      | mcp-migration | info     | true         |         | [{"kind":"moved","scope":"user","plugin":"demo","marketplace":"fixtures","from":"srv","to":"plugin_demo_srv_"}] |
    Then the mcp configuration file "mcp.json" of the user scope holds this text:
      """
      {
        "mcpServers": {
          "mine": {
            "command": "pi-features-users-own-mcp-server"
          }
        }
      }

      """
    Then the mcp configuration file "mcp-adapter.json" of the user scope holds this text:
      """
      {
        "mcpServers": {
          "plugin_demo_srv_": {
            "command": "pi-features-absent-mcp-server",
            "args": [],
            "env": {
              "CLAUDE_PLUGIN_ROOT": "{home}/marketplaces/fixtures/plugins/demo",
              "CLAUDE_PLUGIN_DATA": "{agent dir}/pi-claude-marketplace/data/fixtures/demo"
            },
            "directTools": "search",
            "toolPrefix": "mcp",
            "_piClaudeMarketplace": {
              "plugin": "demo",
              "marketplace": "fixtures"
            }
          }
        }
      }

      """

  @mcp
  Scenario: A load moves only the plugin's marked servers and leaves each of the user's own servers as written
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" declares the mcp server "srv"
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given the mcp.json file of the user scope holds the user's own servers before the legacy move, in this text:
      """
      {
        "note": "kept by the user",
        "mcpServers": {
          "alpha": {
            "command": "pi-features-users-own-mcp-server",
            "args": [
              "--alpha",
              "1"
            ],
            "env": {
              "ALPHA_MODE": "on",
              "ALPHA_HOME": "${ALPHA_HOME:-/srv/alpha}"
            }
          },
          "srv-copy": {
            "command": "pi-features-absent-mcp-server",
            "args": [],
            "env": {
              "CLAUDE_PLUGIN_ROOT": "{home}/marketplaces/fixtures/plugins/demo",
              "CLAUDE_PLUGIN_DATA": "{agent dir}/pi-claude-marketplace/data/fixtures/demo"
            }
          }
        }
      }

      """
    Given the mcp.json file of the user scope holds the servers of the plugin "demo@fixtures" as release 0.19.2 wrote them, beside the user's own server "mine"
    When the user starts a new pi session
    Then the session reports these results:
      | kind          | severity | needs reload | notices | rows                                                                                                          |
      | mcp-migration | info     | true         |         | [{"kind":"moved","scope":"user","plugin":"demo","marketplace":"fixtures","from":"srv","to":"plugin_demo_srv_"}] |
    Then the mcp configuration file "mcp.json" of the user scope holds this text:
      """
      {
        "note": "kept by the user",
        "mcpServers": {
          "alpha": {
            "command": "pi-features-users-own-mcp-server",
            "args": [
              "--alpha",
              "1"
            ],
            "env": {
              "ALPHA_MODE": "on",
              "ALPHA_HOME": "${ALPHA_HOME:-/srv/alpha}"
            }
          },
          "srv-copy": {
            "command": "pi-features-absent-mcp-server",
            "args": [],
            "env": {
              "CLAUDE_PLUGIN_ROOT": "{home}/marketplaces/fixtures/plugins/demo",
              "CLAUDE_PLUGIN_DATA": "{agent dir}/pi-claude-marketplace/data/fixtures/demo"
            }
          },
          "mine": {
            "command": "pi-features-users-own-mcp-server"
          }
        }
      }

      """

  @mcp
  Scenario: A second load after the move reports nothing and leaves both mcp files as the first load left them
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" declares the mcp server "srv"
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given the mcp.json file of the user scope holds the servers of the plugin "demo@fixtures" as release 0.19.2 wrote them, beside the user's own server "mine"
    Given the user has started a new pi session
    When the user starts a new pi session
    Then the session reports no results
    Then the mcp configuration file "mcp.json" of the user scope holds this text:
      """
      {
        "mcpServers": {
          "mine": {
            "command": "pi-features-users-own-mcp-server"
          }
        }
      }

      """
    Then the mcp configuration file "mcp-adapter.json" of the user scope holds this text:
      """
      {
        "mcpServers": {
          "plugin_demo_srv_": {
            "command": "pi-features-absent-mcp-server",
            "args": [],
            "env": {
              "CLAUDE_PLUGIN_ROOT": "{home}/marketplaces/fixtures/plugins/demo",
              "CLAUDE_PLUGIN_DATA": "{agent dir}/pi-claude-marketplace/data/fixtures/demo"
            },
            "directTools": "search",
            "toolPrefix": "mcp",
            "_piClaudeMarketplace": {
              "plugin": "demo",
              "marketplace": "fixtures"
            }
          }
        }
      }

      """

  @mcp
  Scenario: After the move, the next session offers the plugin's server tools under its new name
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the stub mcp server "stub"
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given the mcp.json file of the user scope holds the servers of the plugin "demo@fixtures" as release 0.19.2 wrote them, beside the user's own server "mine"
    Given pi runs with the scripted model and the mcp implementation
    Given the user has started a new pi session
    Given the mcp implementation has listed the tools of the stub mcp server "stub" of the plugin "demo"
    When the user lists the mcp tools pi offers
    Then pi offers these plugin mcp tools:
      | tool                        | active |
      | mcp__plugin_demo_stub__echo | no     |
    Then the mcp configuration file "mcp.json" of the user scope holds this text:
      """
      {
        "mcpServers": {
          "mine": {
            "command": "pi-features-users-own-mcp-server"
          }
        }
      }

      """

  @mcp
  Scenario: A load moves a plugin's servers out of the project's mcp.json into the project's mcp-adapter.json
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" declares the mcp server "srv"
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project", which did not fail
    Given the mcp.json file of the project scope holds the servers of the plugin "demo@fixtures" as release 0.19.2 wrote them, beside the user's own server "mine"
    When the user starts a new pi session
    Then the session reports these results:
      | kind          | severity | needs reload | notices | rows                                                                                                             |
      | mcp-migration | info     | true         |         | [{"kind":"moved","scope":"project","plugin":"demo","marketplace":"fixtures","from":"srv","to":"plugin_demo_srv_"}] |
    Then the mcp configuration file "mcp.json" of the project scope holds this text:
      """
      {
        "mcpServers": {
          "mine": {
            "command": "pi-features-users-own-mcp-server"
          }
        }
      }

      """
    Then the mcp configuration file "mcp-adapter.json" of the project scope holds this text:
      """
      {
        "mcpServers": {
          "plugin_demo_srv_": {
            "command": "pi-features-absent-mcp-server",
            "args": [],
            "env": {
              "CLAUDE_PLUGIN_ROOT": "{home}/marketplaces/fixtures/plugins/demo",
              "CLAUDE_PLUGIN_DATA": "{project dir}/.pi/pi-claude-marketplace/data/fixtures/demo"
            },
            "directTools": "search",
            "toolPrefix": "mcp",
            "_piClaudeMarketplace": {
              "plugin": "demo",
              "marketplace": "fixtures"
            }
          }
        }
      }

      """
