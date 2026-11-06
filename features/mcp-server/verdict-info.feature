Feature: MCP server verdict info

  Plugin info shows each MCP server's verdict for the MCP implementation pi
  runs when info is read: a server it runs is written, and a server it blocks
  is left out with the feature that blocks it (MREC-04). The plugin's state
  follows the same implementation (D-P3-05). A local marketplace stands in for
  a published one, a stdio stub for a real server, and the sse server points
  at a loopback port that nothing listens on.

  @builtin-only
  Scenario: Plugin info shows an sse server as left out, under Pi's built-in MCP (MREC-04)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers": {"tools": {"stub": {}}, "events": {"type": "sse", "url": "http://127.0.0.1:9/sse"}}}
      """
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user --partial", which did not fail
    When the user runs "/claude:plugin info demo@fixtures --scope user"
    Then the result has these fields:
      | kind                           | plugin-info                                                                                                   |
      | marketplace details autoupdate | false                                                                                                         |
      | marketplace name               | fixtures                                                                                                      |
      | marketplace scope              | user                                                                                                          |
      | needs reload                   | false                                                                                                         |
      | plugin components mcp          | [{"name":"plugin:demo:events","unsupportedFeature":"sse"},{"name":"plugin:demo:tools","status":"not loaded"}] |
      | plugin components resolved     | true                                                                                                          |
      | plugin components skills       | demo-skill                                                                                                    |
      | plugin id                      | demo@fixtures                                                                                                 |
      | plugin name                    | demo                                                                                                          |
      | plugin reasons                 | unsupported mcp                                                                                               |
      | plugin requires                | [{"companion":"pi-mcp-adapter","missing":true}]                                                               |
      | plugin scope                   | user                                                                                                          |
      | plugin status                  | partially-installed                                                                                           |
      | plugin version                 | 1.0.0                                                                                                         |
      | severity                       | info                                                                                                          |

  @adapter-only
  Scenario: Plugin info shows an sse server as written, under pi-mcp-adapter (MREC-04)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers": {"tools": {"stub": {}}, "events": {"type": "sse", "url": "http://127.0.0.1:9/sse"}}}
      """
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    When the user runs "/claude:plugin info demo@fixtures --scope user"
    Then the result has these fields:
      | kind                           | plugin-info                                                                                                      |
      | marketplace details autoupdate | false                                                                                                            |
      | marketplace name               | fixtures                                                                                                         |
      | marketplace scope              | user                                                                                                             |
      | needs reload                   | false                                                                                                            |
      | plugin components mcp          | [{"name":"plugin:demo:events","status":"status unknown"},{"name":"plugin:demo:tools","status":"status unknown"}] |
      | plugin components resolved     | true                                                                                                             |
      | plugin components skills       | demo-skill                                                                                                       |
      | plugin id                      | demo@fixtures                                                                                                    |
      | plugin name                    | demo                                                                                                             |
      | plugin reasons                 |                                                                                                                  |
      | plugin requires                | [{"companion":"pi-mcp-adapter","missing":false}]                                                                 |
      | plugin scope                   | user                                                                                                             |
      | plugin status                  | installed                                                                                                        |
      | plugin version                 | 1.0.0                                                                                                            |
      | severity                       | info                                                                                                             |

  @builtin-only
  Scenario: Plugin info shows a plugin with an sse server as partially available, under Pi's built-in MCP (MREC-04)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers": {"tools": {"stub": {}}, "events": {"type": "sse", "url": "http://127.0.0.1:9/sse"}}}
      """
    Given the marketplace "fixtures" is added to the user scope
    When the user runs "/claude:plugin info demo@fixtures --scope user"
    Then the result has these fields:
      | kind                           | plugin-info                                                                             |
      | marketplace details autoupdate | false                                                                                   |
      | marketplace name               | fixtures                                                                                |
      | marketplace scope              | user                                                                                    |
      | needs reload                   | false                                                                                   |
      | plugin components mcp          | [{"name":"plugin:demo:events","unsupportedFeature":"sse"},{"name":"plugin:demo:tools"}] |
      | plugin components resolved     | true                                                                                    |
      | plugin components skills       | demo-skill                                                                              |
      | plugin id                      | demo@fixtures                                                                           |
      | plugin name                    | demo                                                                                    |
      | plugin reasons                 | unsupported mcp                                                                         |
      | plugin requires                | [{"companion":"pi-mcp-adapter","missing":true}]                                         |
      | plugin status                  | partially-available                                                                     |
      | plugin version                 | 1.0.0                                                                                   |
      | severity                       | info                                                                                    |

  @adapter-only
  Scenario: Plugin info shows a plugin with an sse server as available, under pi-mcp-adapter (MREC-04)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers": {"tools": {"stub": {}}, "events": {"type": "sse", "url": "http://127.0.0.1:9/sse"}}}
      """
    Given the marketplace "fixtures" is added to the user scope
    When the user runs "/claude:plugin info demo@fixtures --scope user"
    Then the result has these fields:
      | kind                           | plugin-info                                                  |
      | marketplace details autoupdate | false                                                        |
      | marketplace name               | fixtures                                                     |
      | marketplace scope              | user                                                         |
      | needs reload                   | false                                                        |
      | plugin components mcp          | [{"name":"plugin:demo:events"},{"name":"plugin:demo:tools"}] |
      | plugin components resolved     | true                                                         |
      | plugin components skills       | demo-skill                                                   |
      | plugin id                      | demo@fixtures                                                |
      | plugin name                    | demo                                                         |
      | plugin reasons                 |                                                              |
      | plugin requires                | [{"companion":"pi-mcp-adapter","missing":false}]             |
      | plugin status                  | available                                                    |
      | plugin version                 | 1.0.0                                                        |
      | severity                       | info                                                         |

  @mcp
  Scenario: Plugin info names mcp for a plugin whose stdio server either implementation runs (D-P3-08)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the stub mcp server "stub"
    Given the marketplace "fixtures" is added to the user scope
    When the user runs "/claude:plugin info demo@fixtures --scope user"
    Then the result has these fields:
      | kind                           | plugin-info                           |
      | marketplace details autoupdate | false                                 |
      | marketplace name               | fixtures                              |
      | marketplace scope              | user                                  |
      | needs reload                   | false                                 |
      | plugin components mcp          | [{"name":"plugin:demo:stub"}]         |
      | plugin components resolved     | true                                  |
      | plugin components skills       | demo-skill                            |
      | plugin id                      | demo@fixtures                         |
      | plugin name                    | demo                                  |
      | plugin reasons                 |                                       |
      | plugin requires                | [{"companion":"mcp","missing":false}] |
      | plugin status                  | available                             |
      | plugin version                 | 1.0.0                                 |
      | severity                       | info                                  |

  @adapter-only
  Scenario: Plugin info names Pi's built-in MCP as missing for a server only it runs, under pi-mcp-adapter (D-P3-08, MREC-07)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with this text:
      """
      {"mcpServers": {"asker": {"command": "node", "bareElicitationCapability": true}}}
      """
    Given the marketplace "fixtures" is added to the user scope
    When the user runs "/claude:plugin info demo@fixtures --scope user"
    Then the result has these fields:
      | kind                           | plugin-info                                                                     |
      | marketplace details autoupdate | false                                                                           |
      | marketplace name               | fixtures                                                                        |
      | marketplace scope              | user                                                                            |
      | needs reload                   | false                                                                           |
      | plugin components mcp          | [{"name":"plugin:demo:asker","unsupportedFeature":"bareElicitationCapability"}] |
      | plugin components resolved     | true                                                                            |
      | plugin components skills       | demo-skill                                                                      |
      | plugin id                      | demo@fixtures                                                                   |
      | plugin name                    | demo                                                                            |
      | plugin reasons                 | unsupported mcp                                                                 |
      | plugin requires                | [{"companion":"builtin mcp","missing":true}]                                    |
      | plugin status                  | partially-available                                                             |
      | plugin version                 | 1.0.0                                                                           |
      | severity                       | info                                                                            |

  @builtin-only
  Scenario: Plugin info names Pi's built-in MCP for a server only it runs, under Pi's built-in MCP (D-P3-08)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with this text:
      """
      {"mcpServers": {"asker": {"command": "node", "bareElicitationCapability": true}}}
      """
    Given the marketplace "fixtures" is added to the user scope
    When the user runs "/claude:plugin info demo@fixtures --scope user"
    Then the result has these fields:
      | kind                           | plugin-info                                   |
      | marketplace details autoupdate | false                                         |
      | marketplace name               | fixtures                                      |
      | marketplace scope              | user                                          |
      | needs reload                   | false                                         |
      | plugin components mcp          | [{"name":"plugin:demo:asker"}]                |
      | plugin components resolved     | true                                          |
      | plugin components skills       | demo-skill                                    |
      | plugin id                      | demo@fixtures                                 |
      | plugin name                    | demo                                          |
      | plugin reasons                 |                                               |
      | plugin requires                | [{"companion":"builtin mcp","missing":false}] |
      | plugin status                  | available                                     |
      | plugin version                 | 1.0.0                                         |
      | severity                       | info                                          |
