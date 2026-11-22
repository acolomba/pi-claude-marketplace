Feature: MCP server legacy move

  A user upgrading from a release that wrote plugin MCP servers into mcp.json has them moved on
  load (AMIG-01), and an install or a reinstall of a plugin finishes the move of its own entries
  and keeps the user's own servers (AMIG-02). One notice reports the move in both scopes, the
  project rows first (AMIG-03), and the load leaves an entry that no installed plugin owns and
  warns about it (AMIG-04). An mcp.json in that release's shape stands in for the upgrade, a local
  marketplace or a repository on the loopback git host for a published one, and a stdio stub
  server for a real one.

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
            "requestTimeoutMs": 1800000,
            "lifecycle": "lazy-keep-alive",
            "_piClaudeMarketplace": {
              "plugin": "demo",
              "marketplace": "fixtures",
              "defaultFields": {
                "requestTimeoutMs": 1800000,
                "lifecycle": "lazy-keep-alive"
              }
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
            "requestTimeoutMs": 1800000,
            "lifecycle": "lazy-keep-alive",
            "_piClaudeMarketplace": {
              "plugin": "demo",
              "marketplace": "fixtures",
              "defaultFields": {
                "requestTimeoutMs": 1800000,
                "lifecycle": "lazy-keep-alive"
              }
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
  Scenario: After the move, a server of a record that held no plugin options reads its option (D-PG10-23)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".claude-plugin/plugin.json" with this text:
      """
      {
        "name": "demo",
        "version": "1.0.0",
        "userConfig": {
          "tool": { "type": "string", "title": "Tool", "description": "The tool.", "default": "reverse" }
        }
      }
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the stub mcp server "picker" whose tool name argument is "${user_config.tool}"
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given the installation record of the plugin "demo@fixtures" in the user scope holds no plugin options, as an earlier release wrote it
    Given the mcp.json file of the user scope holds the servers of the plugin "demo@fixtures" as release 0.19.2 wrote them, beside the user's own server "mine"
    Given pi runs with the scripted model and the mcp implementation
    Given the user has started a new pi session
    Given the mcp implementation has listed the tools of the stub mcp server "picker" of the plugin "demo"
    When the user lists the mcp tools pi offers
    Then pi offers these plugin mcp tools:
      | tool                             | active |
      | mcp__plugin_demo_picker__reverse | no     |

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
            "requestTimeoutMs": 1800000,
            "lifecycle": "lazy-keep-alive",
            "_piClaudeMarketplace": {
              "plugin": "demo",
              "marketplace": "fixtures",
              "defaultFields": {
                "requestTimeoutMs": 1800000,
                "lifecycle": "lazy-keep-alive"
              }
            }
          }
        }
      }

      """

  @mcp
  Scenario: An install removes the plugin's marked mcp.json entry and the disable stub under its old name, keeps the user's own server, and says so (AMIG-02)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" declares the mcp server "srv"
    Given the marketplace "fixtures" is added to the project scope
    Given the mcp.json file of the project scope holds this text, as release 0.19.2 wrote it:
      """
      {"mcpServers": {"srv": {"command": "pi-features-absent-mcp-server", "args": [], "_piClaudeMarketplace": {"plugin": "demo", "marketplace": "fixtures"}}}}
      """
    Given the user has written these fields on the mcp server "srv" in the mcp-adapter.json file of the project scope:
      """
      {"disabled": true}
      """
    Given the user has written these fields on the mcp server "other" in the mcp-adapter.json file of the project scope:
      """
      {"command": "pi-features-users-own-mcp-server"}
      """
    When the user runs "/claude:plugin install demo@fixtures --scope project"
    Then the command reports these results:
      | kind               | severity | needs reload | notices                                                                                                  |
      | cascade            | info     | true         |                                                                                                          |
      | mcp-config-notices | warning  | false        | [{"kind":"leftover-removed","scope":"project","file":"mcp-adapter.json","plugin":"demo","server":"srv"}] |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | installed |         | project | 1.0.0   |
    Then the mcp configuration file "mcp-adapter.json" of the project scope holds this text:
      """
      {
        "mcpServers": {
          "other": {
            "command": "pi-features-users-own-mcp-server"
          },
          "plugin_demo_srv_": {
            "command": "pi-features-absent-mcp-server",
            "args": [],
            "env": {
              "CLAUDE_PLUGIN_ROOT": "{home}/marketplaces/fixtures/plugins/demo",
              "CLAUDE_PLUGIN_DATA": "{project dir}/.pi/pi-claude-marketplace/data/fixtures/demo"
            },
            "directTools": "search",
            "toolPrefix": "mcp",
            "requestTimeoutMs": 1800000,
            "lifecycle": "lazy-keep-alive",
            "_piClaudeMarketplace": {
              "plugin": "demo",
              "marketplace": "fixtures",
              "defaultFields": {
                "requestTimeoutMs": 1800000,
                "lifecycle": "lazy-keep-alive"
              }
            }
          }
        }
      }

      """
    Then the mcp configuration file "mcp.json" of the project scope holds this text:
      """
      {
        "mcpServers": {}
      }

      """

  @mcp
  Scenario: An install removes a direct-tools copy under the server's old name and keeps a stub of the user's that names no plugin server (AMIG-02)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" declares the mcp server "srv"
    Given the marketplace "fixtures" is added to the project scope
    Given the mcp.json file of the project scope holds this text, as release 0.19.2 wrote it:
      """
      {"mcpServers": {"srv": {"command": "pi-features-absent-mcp-server", "args": [], "_piClaudeMarketplace": {"plugin": "demo", "marketplace": "fixtures"}}}}
      """
    Given the user has written these fields on the mcp server "srv" in the mcp-adapter.json file of the project scope:
      """
      {"command": "pi-features-absent-mcp-server", "args": ["server.js"], "directTools": true}
      """
    Given the user has written these fields on the mcp server "keep" in the mcp-adapter.json file of the project scope:
      """
      {"disabled": true}
      """
    When the user runs "/claude:plugin install demo@fixtures --scope project"
    Then the command reports these results:
      | kind               | severity | needs reload | notices                                                                                                  |
      | cascade            | info     | true         |                                                                                                          |
      | mcp-config-notices | warning  | false        | [{"kind":"leftover-removed","scope":"project","file":"mcp-adapter.json","plugin":"demo","server":"srv"}] |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | installed |         | project | 1.0.0   |
    Then the mcp configuration file "mcp-adapter.json" of the project scope holds this text:
      """
      {
        "mcpServers": {
          "keep": {
            "disabled": true
          },
          "plugin_demo_srv_": {
            "command": "pi-features-absent-mcp-server",
            "args": [],
            "env": {
              "CLAUDE_PLUGIN_ROOT": "{home}/marketplaces/fixtures/plugins/demo",
              "CLAUDE_PLUGIN_DATA": "{project dir}/.pi/pi-claude-marketplace/data/fixtures/demo"
            },
            "directTools": "search",
            "toolPrefix": "mcp",
            "requestTimeoutMs": 1800000,
            "lifecycle": "lazy-keep-alive",
            "_piClaudeMarketplace": {
              "plugin": "demo",
              "marketplace": "fixtures",
              "defaultFields": {
                "requestTimeoutMs": 1800000,
                "lifecycle": "lazy-keep-alive"
              }
            }
          }
        }
      }

      """
    Then the mcp configuration file "mcp.json" of the project scope holds this text:
      """
      {
        "mcpServers": {}
      }

      """

  @mcp
  Scenario: An install keeps the user's own full server under the old name and reports nothing about it (AMIG-02)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" declares the mcp server "srv"
    Given the marketplace "fixtures" is added to the project scope
    Given the mcp.json file of the project scope holds this text, as release 0.19.2 wrote it:
      """
      {"mcpServers": {"srv": {"command": "pi-features-absent-mcp-server", "args": [], "_piClaudeMarketplace": {"plugin": "demo", "marketplace": "fixtures"}}}}
      """
    Given the user has written these fields on the mcp server "srv" in the mcp-adapter.json file of the project scope:
      """
      {"command": "pi-features-users-own-mcp-server", "args": ["mine.js"]}
      """
    When the user runs "/claude:plugin install demo@fixtures --scope project"
    Then the command reports these results:
      | kind    | severity | needs reload |
      | cascade | info     | true         |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | installed |         | project | 1.0.0   |
    Then the mcp configuration file "mcp-adapter.json" of the project scope holds this text:
      """
      {
        "mcpServers": {
          "srv": {
            "command": "pi-features-users-own-mcp-server",
            "args": [
              "mine.js"
            ]
          },
          "plugin_demo_srv_": {
            "command": "pi-features-absent-mcp-server",
            "args": [],
            "env": {
              "CLAUDE_PLUGIN_ROOT": "{home}/marketplaces/fixtures/plugins/demo",
              "CLAUDE_PLUGIN_DATA": "{project dir}/.pi/pi-claude-marketplace/data/fixtures/demo"
            },
            "directTools": "search",
            "toolPrefix": "mcp",
            "requestTimeoutMs": 1800000,
            "lifecycle": "lazy-keep-alive",
            "_piClaudeMarketplace": {
              "plugin": "demo",
              "marketplace": "fixtures",
              "defaultFields": {
                "requestTimeoutMs": 1800000,
                "lifecycle": "lazy-keep-alive"
              }
            }
          }
        }
      }

      """
    Then the mcp configuration file "mcp.json" of the project scope holds this text:
      """
      {
        "mcpServers": {}
      }

      """

  @mcp
  Scenario: A user-scope install that finishes the move leaves the project scope's files alone (AMIG-02)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" declares the mcp server "srv"
    Given the marketplace "fixtures" is added to the user scope
    Given the mcp.json file of the user scope holds this text, as release 0.19.2 wrote it:
      """
      {"mcpServers": {"srv": {"command": "pi-features-absent-mcp-server", "args": [], "_piClaudeMarketplace": {"plugin": "demo", "marketplace": "fixtures"}}}}
      """
    Given the user has written these fields on the mcp server "srv" in the mcp-adapter.json file of the project scope:
      """
      {"disabled": true}
      """
    Given the files of the project scope are remembered
    When the user runs "/claude:plugin install demo@fixtures --scope user"
    Then the files of the project scope are unchanged
    Then the command reports these results:
      | kind    | severity | needs reload |
      | cascade | info     | true         |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope | version |
      | fixtures         | user              | demo@fixtures | demo | installed |         | user  | 1.0.0   |
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
            "requestTimeoutMs": 1800000,
            "lifecycle": "lazy-keep-alive",
            "_piClaudeMarketplace": {
              "plugin": "demo",
              "marketplace": "fixtures",
              "defaultFields": {
                "requestTimeoutMs": 1800000,
                "lifecycle": "lazy-keep-alive"
              }
            }
          }
        }
      }

      """
    Then the mcp configuration file "mcp.json" of the user scope holds this text:
      """
      {
        "mcpServers": {}
      }

      """

  @mcp
  Scenario: One load notice reports the move in both scopes, with the project rows first (AMIG-03)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" declares the mcp server "srv"
    Given the marketplace "fixtures" is added to the user scope
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given the user has run "/claude:plugin install demo@fixtures --scope project", which did not fail
    Given the mcp.json file of the user scope holds the servers of the plugin "demo@fixtures" as release 0.19.2 wrote them, beside the user's own server "mine"
    Given the mcp.json file of the project scope holds the servers of the plugin "demo@fixtures" as release 0.19.2 wrote them, beside the user's own server "mine"
    When the user starts a new pi session
    Then the session reports these results:
      | kind          | severity | needs reload | notices | rows                                                                                                                                                                                                                             |
      | mcp-migration | info     | true         |         | [{"kind":"moved","scope":"project","plugin":"demo","marketplace":"fixtures","from":"srv","to":"plugin_demo_srv_"},{"kind":"moved","scope":"user","plugin":"demo","marketplace":"fixtures","from":"srv","to":"plugin_demo_srv_"}] |

  @mcp
  Scenario: A moved server that declares tool permission rules is written without them, and the move notice warns that they are not enforced (ANAME-07, AMIG-03)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers": {"srv": {"type": "http", "url": "https://127.0.0.1:9/mcp", "tools": [{"name": "rule-tool-a7", "permission_policy": "always_deny"}], "toolPermissions": {"rule-tool-b7": "blocked"}}}}
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project", which did not fail
    Given the mcp.json file of the project scope holds the servers of the plugin "demo@fixtures" as release 0.19.2 wrote them, beside the user's own server "mine"
    When the user starts a new pi session
    Then the session reports these results:
      | kind          | severity | needs reload | notices                                                                                                                                                                             | rows                                                                                                               |
      | mcp-migration | warning  | true         | [{"kind":"tool-rules-unenforced","scope":"project","file":"mcp-adapter.json","plugin":"demo","server":"plugin_demo_srv_","fields":["tools[].permission_policy","toolPermissions"]}] | [{"kind":"moved","scope":"project","plugin":"demo","marketplace":"fixtures","from":"srv","to":"plugin_demo_srv_"}] |
    Then the mcp configuration file "mcp-adapter.json" of the project scope holds this text:
      """
      {
        "mcpServers": {
          "plugin_demo_srv_": {
            "url": "https://127.0.0.1:9/mcp",
            "directTools": "search",
            "toolPrefix": "mcp",
            "requestTimeoutMs": 300000,
            "_piClaudeMarketplace": {
              "plugin": "demo",
              "marketplace": "fixtures",
              "defaultFields": {
                "requestTimeoutMs": 300000
              }
            }
          }
        }
      }

      """

  @mcp
  Scenario: A load leaves an mcp.json entry that no installed plugin owns and warns about it (AMIG-04)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" declares the mcp server "srv"
    Given the marketplace "fixtures" is added to the project scope
    Given the mcp.json file of the project scope holds this text, as release 0.19.2 wrote it:
      """
      {"mcpServers": {"srv": {"command": "pi-features-absent-mcp-server", "args": [], "_piClaudeMarketplace": {"plugin": "demo", "marketplace": "fixtures"}}}}
      """
    Given the files of the project scope are remembered
    When the user starts a new pi session
    Then the files of the project scope are unchanged
    Then the session reports these results:
      | kind          | severity | needs reload | notices | rows                                                                                              |
      | mcp-migration | warning  | false        |         | [{"kind":"unowned","scope":"project","plugin":"demo","marketplace":"fixtures","servers":["srv"]}] |
      | mcp-migration | warning  | false        |         | [{"kind":"unowned","scope":"project","plugin":"demo","marketplace":"fixtures","servers":["srv"]}] |

  @mcp
  Scenario: A user-scope install does not own the project's mcp.json entry, which the load leaves and warns about (AMIG-04)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" declares the mcp server "srv"
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given the mcp.json file of the project scope holds this text, as release 0.19.2 wrote it:
      """
      {"mcpServers": {"srv": {"command": "pi-features-absent-mcp-server", "args": [], "_piClaudeMarketplace": {"plugin": "demo", "marketplace": "fixtures"}}}}
      """
    Given the files of the project scope are remembered
    When the user starts a new pi session
    Then the files of the project scope are unchanged
    Then the session reports these results:
      | kind          | severity | needs reload | notices | rows                                                                                              |
      | mcp-migration | warning  | false        |         | [{"kind":"unowned","scope":"project","plugin":"demo","marketplace":"fixtures","servers":["srv"]}] |
      | mcp-migration | warning  | false        |         | [{"kind":"unowned","scope":"project","plugin":"demo","marketplace":"fixtures","servers":["srv"]}] |

  @mcp
  Scenario: An apply that installs a declared plugin removes its old mcp.json entry with no unowned warning (AMIG-04)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" declares the mcp server "srv"
    Given the marketplace "fixtures" is added to the project scope
    Given a config in scope project and layer base, with these plugins:
      | marketplace | plugin | enabled |
      | fixtures    | demo   | true    |
    Given the mcp.json file of the project scope holds this text, as release 0.19.2 wrote it:
      """
      {"mcpServers": {"srv": {"command": "pi-features-absent-mcp-server", "args": [], "_piClaudeMarketplace": {"plugin": "demo", "marketplace": "fixtures"}}}}
      """
    When the user runs "/claude:plugin apply --scope project"
    Then the command reports these results:
      | kind                      | severity | needs reload | tally label | tally failures | tally warnings | tally success count |
      | reconcile-applied-cascade | info     | true         | Reconcile   | 0              | 0              | 1                   |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | installed |         | project | 1.0.0   |
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
            "requestTimeoutMs": 1800000,
            "lifecycle": "lazy-keep-alive",
            "_piClaudeMarketplace": {
              "plugin": "demo",
              "marketplace": "fixtures",
              "defaultFields": {
                "requestTimeoutMs": 1800000,
                "lifecycle": "lazy-keep-alive"
              }
            }
          }
        }
      }

      """
    Then the mcp configuration file "mcp.json" of the project scope holds this text:
      """
      {
        "mcpServers": {}
      }

      """

  @mcp
  Scenario: The reinstall that the move notice names moves a git plugin's entries out of mcp.json (AMIG-02)
    Given the git repository "ghp" holds these plugins:
      | name | version | path |
      | ghp  | 1.0.0   |      |
    Given the git repository "ghp" adds this .mcp.json to the plugin "ghp":
      """
      {"mcpServers": {"srv": {"command": "pi-features-absent-mcp-server", "args": []}}}
      """
    Given the marketplace "gits" is published as a dir source
    Given the marketplace "gits" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | ghp  | github      | ghp        | false  |
    Given the marketplace "gits" is added to the project scope
    Given the user has run "/claude:plugin install ghp@gits --scope project", which did not fail
    Given the mcp.json file of the project scope holds the servers of the plugin "ghp@gits" as release 0.19.2 wrote them, beside the user's own server "mine"
    Given the cached clones of git plugins in the project scope are deleted
    When the user runs "/claude:plugin reinstall ghp@gits --scope project"
    Then the command reports these results:
      | kind    | severity | needs reload |
      | cascade | info     | true         |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id       | name | status      | reasons | scope   | version |
      | gits             | project           | ghp@gits | ghp  | reinstalled |         | project | 1.0.0   |
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

  @mcp
  Scenario: A load removes the entry of a server the plugin no longer declares and of one it cannot run, and moves the rest (AMIG-01, MREC-02)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" declares the mcp server "srv"
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project", which did not fail
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers": {"srv": {"command": "pi-features-absent-mcp-server", "args": []}, "live": {"type": "ws", "url": "wss://127.0.0.1:9/ws"}, "gone": {"command": "pi-features-absent-mcp-server", "args": ["gone"]}}}
      """
    Given the mcp.json file of the project scope holds the servers of the plugin "demo@fixtures" as release 0.19.2 wrote them, beside the user's own server "mine"
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers": {"srv": {"command": "pi-features-absent-mcp-server", "args": []}, "live": {"type": "ws", "url": "wss://127.0.0.1:9/ws"}}}
      """
    Given the installation record of the plugin "demo@fixtures" in the project scope has no recorded mcp servers, as an earlier release wrote it
    When the user starts a new pi session
    Then the session reports these results:
      | kind          | severity | needs reload | notices | rows                                                                                                                                                                                                                                                                                                                                                                               |
      | mcp-migration | warning  | true         |         | [{"kind":"moved","scope":"project","plugin":"demo","marketplace":"fixtures","from":"srv","to":"plugin_demo_srv_"},{"kind":"removed","scope":"project","plugin":"demo","marketplace":"fixtures","server":"gone","cause":"not-declared"},{"kind":"removed","scope":"project","plugin":"demo","marketplace":"fixtures","server":"live","cause":"unsupported-feature","feature":"ws"}] |
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
            "requestTimeoutMs": 1800000,
            "lifecycle": "lazy-keep-alive",
            "_piClaudeMarketplace": {
              "plugin": "demo",
              "marketplace": "fixtures",
              "defaultFields": {
                "requestTimeoutMs": 1800000,
                "lifecycle": "lazy-keep-alive"
              }
            }
          }
        }
      }

      """
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

  @mcp
  Scenario: A load removes every old entry of a plugin whose MCP config is malformed and writes none (AMIG-01, D-CF6-02)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers": {"srv": {"command": "pi-features-absent-mcp-server", "args": []}, "old": {"command": "pi-features-absent-mcp-server", "args": ["old"]}}}
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project", which did not fail
    Given the mcp.json file of the project scope holds the servers of the plugin "demo@fixtures" as release 0.19.2 wrote them, beside the user's own server "mine"
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".claude-plugin/plugin.json" with this text:
      """
      {"name": "demo", "version": "1.0.0", "mcpServers": {"srv": {"command": "pi-features-absent-mcp-server", "args": [], "timeout": "soon"}}}
      """
    When the user starts a new pi session
    Then the session reports these results:
      | kind          | severity | needs reload | notices | rows                                                                                                                                                                                                                                |
      | mcp-migration | warning  | true         |         | [{"kind":"removed","scope":"project","plugin":"demo","marketplace":"fixtures","server":"old","cause":"malformed"},{"kind":"removed","scope":"project","plugin":"demo","marketplace":"fixtures","server":"srv","cause":"malformed"}] |
    Then the mcp configuration file "mcp-adapter.json" of the project scope holds this text:
      """
      {
        "mcpServers": {}
      }

      """
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

  # MCPMIG-01 (.planning/BACKLOG.md): its fix changes the "not-declared" cause of the removed row.
  @mcp
  Scenario: A load skips a malformed server, moves its valid sibling, and removes the skipped server's old entry (AMIG-01, D-CF6-02)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers": {"srv": {"command": "pi-features-absent-mcp-server", "args": []}, "broken": {"type": "bogus"}}}
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project", which did not fail
    Given the mcp.json file of the project scope holds the servers of the plugin "demo@fixtures" as release 0.19.2 wrote them, beside the user's own server "mine"
    When the user starts a new pi session
    Then the session reports these results:
      | kind          | severity | needs reload | notices | rows                                                                                                                                                                                                                                      |
      | mcp-migration | info     | true         |         | [{"kind":"moved","scope":"project","plugin":"demo","marketplace":"fixtures","from":"srv","to":"plugin_demo_srv_"},{"kind":"removed","scope":"project","plugin":"demo","marketplace":"fixtures","server":"broken","cause":"not-declared"}] |
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
            "requestTimeoutMs": 1800000,
            "lifecycle": "lazy-keep-alive",
            "_piClaudeMarketplace": {
              "plugin": "demo",
              "marketplace": "fixtures",
              "defaultFields": {
                "requestTimeoutMs": 1800000,
                "lifecycle": "lazy-keep-alive"
              }
            }
          }
        }
      }

      """
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

  @mcp
  Scenario: A move that removes a disable stub under the server's old name lists it and warns (AMIG-03)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" declares the mcp server "srv"
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project", which did not fail
    Given the mcp.json file of the project scope holds the servers of the plugin "demo@fixtures" as release 0.19.2 wrote them, beside the user's own server "mine"
    Given the user has written these fields on the mcp server "srv" in the mcp-adapter.json file of the project scope:
      """
      {"disabled": true}
      """
    When the user starts a new pi session
    Then the session reports these results:
      | kind          | severity | needs reload | notices                                                                                                  | rows                                                                                                               |
      | mcp-migration | warning  | true         | [{"kind":"leftover-removed","scope":"project","file":"mcp-adapter.json","plugin":"demo","server":"srv"}] | [{"kind":"moved","scope":"project","plugin":"demo","marketplace":"fixtures","from":"srv","to":"plugin_demo_srv_"}] |
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
            "requestTimeoutMs": 1800000,
            "lifecycle": "lazy-keep-alive",
            "_piClaudeMarketplace": {
              "plugin": "demo",
              "marketplace": "fixtures",
              "defaultFields": {
                "requestTimeoutMs": 1800000,
                "lifecycle": "lazy-keep-alive"
              }
            }
          }
        }
      }

      """

  @mcp
  Scenario: The move of a user-scope plugin removes its disable stub under the old name from the project mcp-adapter.json (AMIG-01)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" declares the mcp server "srv"
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given the mcp.json file of the user scope holds the servers of the plugin "demo@fixtures" as release 0.19.2 wrote them, beside the user's own server "mine"
    Given the user has written these fields on the mcp server "srv" in the mcp-adapter.json file of the project scope:
      """
      {"disabled": true}
      """
    Given the user has written these fields on the mcp server "other" in the mcp-adapter.json file of the project scope:
      """
      {"disabled": true}
      """
    When the user starts a new pi session
    Then the session reports these results:
      | kind          | severity | needs reload | notices                                                                                                  | rows                                                                                                            |
      | mcp-migration | warning  | true         | [{"kind":"leftover-removed","scope":"project","file":"mcp-adapter.json","plugin":"demo","server":"srv"}] | [{"kind":"moved","scope":"user","plugin":"demo","marketplace":"fixtures","from":"srv","to":"plugin_demo_srv_"}] |
    Then the mcp configuration file "mcp-adapter.json" of the project scope holds this text:
      """
      {
        "mcpServers": {
          "other": {
            "disabled": true
          }
        }
      }

      """

  @mcp
  Scenario: A load leaves a git plugin's entries in mcp.json while its clone is not cached and names the reinstall that moves them (AMIG-01)
    Given the git repository "ghp" holds these plugins:
      | name | version | path |
      | ghp  | 1.0.0   |      |
    Given the git repository "ghp" adds this .mcp.json to the plugin "ghp":
      """
      {"mcpServers": {"srv": {"command": "pi-features-absent-mcp-server", "args": []}}}
      """
    Given the marketplace "gits" is published as a dir source
    Given the marketplace "gits" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | ghp  | github      | ghp        | false  |
    Given the marketplace "gits" is added to the project scope
    Given the user has run "/claude:plugin install ghp@gits --scope project", which did not fail
    Given the mcp.json file of the project scope holds the servers of the plugin "ghp@gits" as release 0.19.2 wrote them, beside the user's own server "mine"
    Given the cached clones of git plugins in the project scope are deleted
    Given the files of the project scope are remembered
    When the user starts a new pi session
    Then the session reports these results:
      | kind          | severity | needs reload | notices | rows                                                                                                             |
      | mcp-migration | warning  | false        |         | [{"kind":"source-unreadable","scope":"project","plugin":"ghp","marketplace":"gits","servers":["srv"]}] |
      | mcp-migration | warning  | false        |         | [{"kind":"source-unreadable","scope":"project","plugin":"ghp","marketplace":"gits","servers":["srv"]}] |
    Then the files of the project scope are unchanged
