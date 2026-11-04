Feature: MCP server verdict update

  An update asks for --partial only when the MCP implementation pi runs now
  drops a server of the new version that the installed version did not need
  (MREC-06, D-P3-11, D-P3-12, D-P3-19). A local marketplace stands in for a
  published one, a stdio stub for a real server, and the sse server points at a
  loopback port that nothing listens on.

  Background:
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers": {"tools": {"stub": {}}}}
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project", which did not fail
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.1.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers": {"tools": {"stub": {}}, "events": {"type": "sse", "url": "http://127.0.0.1:9/sse"}}}
      """

  @builtin-only
  Scenario: Updating to a version that adds an sse server asks for --partial, under Pi's built-in MCP (MREC-06)
    When the user runs "/claude:plugin update demo@fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade                             |
      | severity     | warning                             |
      | needs reload | false                               |
      | summary      | A plugin operation needs attention. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status               | reasons         | hint           | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | partially-upgradable | unsupported mcp | partial-update | project | 1.0.0   |
    Then the installation record of the project scope holds these plugins:
      | id            | version | enabled |
      | demo@fixtures | 1.0.0   | true    |

  @adapter-only
  Scenario: Updating to a version that adds an sse server needs no --partial, under pi-mcp-adapter (MREC-06)
    When the user runs "/claude:plugin update demo@fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status  | reasons | scope   | from  | to    |
      | fixtures         | project           | demo@fixtures | demo | updated |         | project | 1.0.0 | 1.1.0 |
    Then the installation record of the project scope holds these plugins:
      | id            | version | enabled |
      | demo@fixtures | 1.1.0   | true    |

  @builtin-only
  Scenario: Updating with --partial to a version that adds an sse server reports it partially installed, under Pi's built-in MCP (MREC-03)
    When the user runs "/claude:plugin update demo@fixtures --scope project --partial"
    Then the result has these fields:
      | kind         | cascade                             |
      | severity     | warning                             |
      | needs reload | true                                |
      | summary      | A plugin operation needs attention. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status              | reasons                                  | scope   | from  | version |
      | fixtures         | project           | demo@fixtures | demo | partially-installed | unsupported mcp, requires pi-mcp-adapter | project | 1.0.0 | 1.1.0   |
    Then the installation record of the project scope holds these plugins:
      | id            | version | enabled |
      | demo@fixtures | 1.1.0   | true    |
