Feature: MCP server verdict install

  An install asks for --partial only for a server the MCP implementation pi runs cannot run
  (MREC-06, D-P3-11), and enabling a kept plugin never asks again after a switch (D-P3-13,
  D-P3-19, D-MB-06). A local marketplace stands in for a published one; sse servers use a dead port.

  @builtin-only
  Scenario: Installing a plugin with an sse server asks for --partial, under Pi's built-in MCP (MREC-06)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with this text:
      """
      {"mcpServers": {"events": {"type": "sse", "url": "http://127.0.0.1:9/sse"}}}
      """
    Given the marketplace "fixtures" is added to the project scope
    When the user runs "/claude:plugin install demo@fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status              | reasons         | hint            |
      | fixtures         | project           | demo@fixtures | demo | partially-available | unsupported mcp | partial-install |
    Then the project scope has no installed plugins

  @adapter-only
  Scenario: Installing a plugin with an sse server needs no --partial, under pi-mcp-adapter (MREC-06)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with this text:
      """
      {"mcpServers": {"events": {"type": "sse", "url": "http://127.0.0.1:9/sse"}}}
      """
    Given the marketplace "fixtures" is added to the project scope
    When the user runs "/claude:plugin install demo@fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | installed |         | project | 1.0.0   |

  @adapter-only
  Scenario: Installing a plugin whose server needs an elicitation handler asks for --partial, under pi-mcp-adapter (MREC-06)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with this text:
      """
      {"mcpServers": {"asker": {"command": "node", "bareElicitationCapability": true}}}
      """
    Given the marketplace "fixtures" is added to the project scope
    When the user runs "/claude:plugin install demo@fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status              | reasons         | hint            |
      | fixtures         | project           | demo@fixtures | demo | partially-available | unsupported mcp | partial-install |
    Then the project scope has no installed plugins

  @builtin-only
  Scenario: Installing a plugin whose server needs an elicitation handler needs no --partial, under Pi's built-in MCP (MREC-06)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with this text:
      """
      {"mcpServers": {"asker": {"command": "node", "bareElicitationCapability": true}}}
      """
    Given the marketplace "fixtures" is added to the project scope
    When the user runs "/claude:plugin install demo@fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | installed |         | project | 1.0.0   |

  @builtin-only
  Scenario: Installing a plugin with an sse server with --partial reports it partially installed, under Pi's built-in MCP (MREC-03)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with this text:
      """
      {"mcpServers": {"events": {"type": "sse", "url": "http://127.0.0.1:9/sse"}}}
      """
    Given the marketplace "fixtures" is added to the project scope
    When the user runs "/claude:plugin install demo@fixtures --scope project --partial"
    Then the result has these fields:
      | kind         | cascade                             |
      | severity     | warning                             |
      | needs reload | true                                |
      | summary      | A plugin operation needs attention. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status              | reasons                                  | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | partially-installed | unsupported mcp, requires pi-mcp-adapter | project | 1.0.0   |

  @own-implementation
  Scenario: Enabling a plugin installed under pi-mcp-adapter needs no --partial when pi runs its built-in MCP instead (MREC-06, D-MB-06)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with this text:
      """
      {"mcpServers": {"events": {"type": "sse", "url": "http://127.0.0.1:9/sse"}}}
      """
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given the user has run "/claude:plugin disable demo@fixtures --scope user", which did not fail
    Given pi runs with the scripted model
    When the user runs "/claude:plugin enable demo@fixtures --scope user"
    Then the result has these fields:
      | kind         | cascade                             |
      | severity     | warning                             |
      | needs reload | true                                |
      | summary      | A plugin operation needs attention. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status              | reasons                                  | scope | version |
      | fixtures         | user              | demo@fixtures | demo | partially-installed | unsupported mcp, requires pi-mcp-adapter | user  | 1.0.0   |
