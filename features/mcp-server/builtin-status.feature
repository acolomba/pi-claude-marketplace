@builtin-only
Feature: MCP server builtin status

  Plugin info shows each server's state as far as Pi's built-in MCP exposes it (BLT-05, BLT-04, D-MB-09), against a stub server, a scripted model, and a local marketplace.
  Each scenario compares the full info fields (P2-DC-16), which are re-verified after the read-time verdicts merge.

  Scenario: Plugin info shows a connected built-in server as connected (BLT-05)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the stub mcp server "stub"
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given pi runs with the scripted model
    Given the mcp implementation has listed the tools of the stub mcp server "stub" of the plugin "demo"
    When the user runs "/claude:plugin info demo@fixtures --scope user"
    Then the result has these fields:
      | kind                           | plugin-info                                        |
      | marketplace details autoupdate | false                                              |
      | marketplace name               | fixtures                                           |
      | marketplace scope              | user                                               |
      | needs reload                   | false                                              |
      | plugin components mcp          | [{"name":"plugin:demo:stub","status":"connected"}] |
      | plugin components resolved     | true                                               |
      | plugin components skills       | demo-skill                                         |
      | plugin id                      | demo@fixtures                                      |
      | plugin name                    | demo                                               |
      | plugin reasons                 |                                                    |
      | plugin requires                | [{"companion":"pi-mcp-adapter","missing":true}]    |
      | plugin scope                   | user                                               |
      | plugin status                  | installed                                          |
      | plugin version                 | 1.0.0                                              |
      | severity                       | info                                               |

  Scenario: Plugin info shows a registered server that has not connected as not connected (BLT-05, P2-DC-10)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with this text:
      """
      {"mcpServers": {"stub": {"command": "pi-cm-no-such-program"}}}
      """
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given pi runs with the scripted model
    When the user runs "/claude:plugin info demo@fixtures --scope user"
    Then the result has these fields:
      | kind                           | plugin-info                                            |
      | marketplace details autoupdate | false                                                  |
      | marketplace name               | fixtures                                               |
      | marketplace scope              | user                                                   |
      | needs reload                   | false                                                  |
      | plugin components mcp          | [{"name":"plugin:demo:stub","status":"not connected"}] |
      | plugin components resolved     | true                                                   |
      | plugin components skills       | demo-skill                                             |
      | plugin id                      | demo@fixtures                                          |
      | plugin name                    | demo                                                   |
      | plugin reasons                 |                                                        |
      | plugin requires                | [{"companion":"pi-mcp-adapter","missing":true}]        |
      | plugin scope                   | user                                                   |
      | plugin status                  | installed                                              |
      | plugin version                 | 1.0.0                                                  |
      | severity                       | info                                                   |

  Scenario: Plugin info shows a server Pi refused to register as not loaded (BLT-04, P2-DC-08)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with this text:
      """
      {"mcpServers": {"remote": {"type": "http", "url": "http://127.0.0.1:${PI_CM_UNSET_PORT}/mcp"}}}
      """
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given pi runs with the scripted model
    When the user runs "/claude:plugin info demo@fixtures --scope user"
    Then the result has these fields:
      | kind                           | plugin-info                                                                                 |
      | marketplace details autoupdate | false                                                                                       |
      | marketplace name               | fixtures                                                                                    |
      | marketplace scope              | user                                                                                        |
      | needs reload                   | false                                                                                       |
      | plugin components mcp          | [{"name":"plugin:demo:remote","unsetVariables":["PI_CM_UNSET_PORT"],"status":"not loaded"}] |
      | plugin components resolved     | true                                                                                        |
      | plugin components skills       | demo-skill                                                                                  |
      | plugin id                      | demo@fixtures                                                                               |
      | plugin name                    | demo                                                                                        |
      | plugin reasons                 |                                                                                             |
      | plugin requires                | [{"companion":"pi-mcp-adapter","missing":true}]                                             |
      | plugin scope                   | user                                                                                        |
      | plugin status                  | installed                                                                                   |
      | plugin version                 | 1.0.0                                                                                       |
      | severity                       | info                                                                                        |

  Scenario: Plugin info shows a plugin server that the user's mcp.json overrides as overridden by mcp.json (BLT-04, BLT-05)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the stub mcp server "stub"
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given the user's pi mcp.json configures the stub mcp server "stub" of the plugin "demo" under the name "plugin_demo_stub"
    Given pi runs with the scripted model
    Given the mcp implementation has listed the tools of the stub mcp server "stub" of the plugin "demo"
    When the user runs "/claude:plugin info demo@fixtures --scope user"
    Then the result has these fields:
      | kind                           | plugin-info                                                     |
      | marketplace details autoupdate | false                                                           |
      | marketplace name               | fixtures                                                        |
      | marketplace scope              | user                                                            |
      | needs reload                   | false                                                           |
      | plugin components mcp          | [{"name":"plugin:demo:stub","status":"overridden by mcp.json"}] |
      | plugin components resolved     | true                                                            |
      | plugin components skills       | demo-skill                                                      |
      | plugin id                      | demo@fixtures                                                   |
      | plugin name                    | demo                                                            |
      | plugin reasons                 |                                                                 |
      | plugin requires                | [{"companion":"pi-mcp-adapter","missing":true}]                 |
      | plugin scope                   | user                                                            |
      | plugin status                  | installed                                                       |
      | plugin version                 | 1.0.0                                                           |
      | severity                       | info                                                            |

  Scenario: Plugin info shows a project-scope server as project not trusted while Pi does not trust the project (BLT-05, D-MB-09)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the stub mcp server "stub"
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project", which did not fail
    Given the project holds a pi settings file
    Given pi runs with the scripted model in an untrusted project
    When the user runs "/claude:plugin info demo@fixtures --scope project"
    Then the result has these fields:
      | kind                           | plugin-info                                                  |
      | marketplace details autoupdate | false                                                        |
      | marketplace name               | fixtures                                                     |
      | marketplace scope              | project                                                      |
      | needs reload                   | false                                                        |
      | plugin components mcp          | [{"name":"plugin:demo:stub","status":"project not trusted"}] |
      | plugin components resolved     | true                                                         |
      | plugin components skills       | demo-skill                                                   |
      | plugin id                      | demo@fixtures                                                |
      | plugin name                    | demo                                                         |
      | plugin reasons                 |                                                              |
      | plugin requires                | [{"companion":"pi-mcp-adapter","missing":true}]              |
      | plugin scope                   | project                                                      |
      | plugin status                  | installed                                                    |
      | plugin version                 | 1.0.0                                                        |
      | severity                       | info                                                         |

  Scenario: Plugin info shows a user-scope server that the trusted project's record replaces as overridden by project scope (BLT-05, ASTAT-01)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the stub mcp server "stub"
    Given the marketplace "fixtures" is added to the user scope
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given the user has run "/claude:plugin install demo@fixtures --scope project", which did not fail
    Given pi runs with the scripted model
    When the user runs "/claude:plugin info demo@fixtures --scope user"
    Then the result has these fields:
      | kind                           | plugin-info                                                          |
      | marketplace details autoupdate | false                                                                |
      | marketplace name               | fixtures                                                             |
      | marketplace scope              | user                                                                 |
      | needs reload                   | false                                                                |
      | plugin components mcp          | [{"name":"plugin:demo:stub","status":"overridden by project scope"}] |
      | plugin components resolved     | true                                                                 |
      | plugin components skills       | demo-skill                                                           |
      | plugin id                      | demo@fixtures                                                        |
      | plugin name                    | demo                                                                 |
      | plugin reasons                 |                                                                      |
      | plugin requires                | [{"companion":"pi-mcp-adapter","missing":true}]                      |
      | plugin scope                   | user                                                                 |
      | plugin status                  | installed                                                            |
      | plugin version                 | 1.0.0                                                                |
      | severity                       | info                                                                 |
