Feature: MCP server verdict list

  A plugin's list row follows the MCP implementation pi runs when the list is
  read, not the one it ran at install (MREC-03, D-P3-05), so a switch needs no
  reinstall, and its marker names the implementation that runs a server the
  active one cannot (D-MB-07). Argument completion offers the plugins the list
  shows for the same implementation, also when Pi runs none (D-P6-22). A
  plugin whose installation record names a plugin root outside its
  marketplace, or whose marketplace record names another scope, lists with the
  verdict its install recorded (UF-1). A local marketplace stands in for a
  published one, and each sse server points at a loopback port that nothing
  listens on.

  @adapter-only
  Scenario: An installed plugin with an sse server lists as installed, under pi-mcp-adapter (MREC-03)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with this text:
      """
      {"mcpServers": {"events": {"type": "sse", "url": "http://127.0.0.1:9/sse"}}}
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project", which did not fail
    When the user runs "/claude:plugin list"
    Then the result has these fields:
      | kind                | cascade     |
      | severity            | info        |
      | needs reload        | false       |
      | tally label         | Plugin list |
      | tally failures      | 0           |
      | tally warnings      | 0           |
      | tally success count | 1           |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | installed |         | project | 1.0.0   |

  @builtin-only
  Scenario: An installed plugin with an sse server lists as partially installed, under Pi's built-in MCP (MREC-03)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with this text:
      """
      {"mcpServers": {"events": {"type": "sse", "url": "http://127.0.0.1:9/sse"}}}
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project --partial", which did not fail
    When the user runs "/claude:plugin list"
    Then the result has these fields:
      | kind                | cascade     |
      | severity            | info        |
      | needs reload        | false       |
      | tally label         | Plugin list |
      | tally failures      | 0           |
      | tally warnings      | 0           |
      | tally success count | 1           |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status              | reasons                                  | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | partially-installed | unsupported mcp, requires pi-mcp-adapter | project | 1.0.0   |

  @own-implementation
  Scenario: A plugin with an sse server, installed without --partial, lists as partially installed under Pi's built-in MCP, with no reinstall (MREC-03)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with this text:
      """
      {"mcpServers": {"events": {"type": "sse", "url": "http://127.0.0.1:9/sse"}}}
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project", which did not fail
    Given pi runs with the scripted model
    When the user runs "/claude:plugin list"
    Then the result has these fields:
      | kind                | cascade     |
      | severity            | info        |
      | needs reload        | false       |
      | tally label         | Plugin list |
      | tally failures      | 0           |
      | tally warnings      | 0           |
      | tally success count | 1           |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status              | reasons                                  | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | partially-installed | unsupported mcp, requires pi-mcp-adapter | project | 1.0.0   |

  @adapter-only
  Scenario: A plugin with an sse server is available to install, under pi-mcp-adapter (MREC-03)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with this text:
      """
      {"mcpServers": {"events": {"type": "sse", "url": "http://127.0.0.1:9/sse"}}}
      """
    Given the marketplace "fixtures" is added to the project scope
    When the user runs "/claude:plugin list"
    Then the result has these fields:
      | kind                | cascade     |
      | severity            | info        |
      | needs reload        | false       |
      | tally label         | Plugin list |
      | tally failures      | 0           |
      | tally warnings      | 0           |
      | tally success count | 1           |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | version |
      | fixtures         | project           | demo@fixtures | demo | available |         | 1.0.0   |

  @builtin-only
  Scenario: A plugin with an sse server is partially available, under Pi's built-in MCP (MREC-03)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with this text:
      """
      {"mcpServers": {"events": {"type": "sse", "url": "http://127.0.0.1:9/sse"}}}
      """
    Given the marketplace "fixtures" is added to the project scope
    When the user runs "/claude:plugin list"
    Then the result has these fields:
      | kind                | cascade     |
      | severity            | info        |
      | needs reload        | false       |
      | tally label         | Plugin list |
      | tally failures      | 0           |
      | tally warnings      | 0           |
      | tally success count | 1           |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status              | reasons         | version |
      | fixtures         | project           | demo@fixtures | demo | partially-available | unsupported mcp | 1.0.0   |

  @adapter-only
  Scenario: Install completion offers a plugin with an sse server, under pi-mcp-adapter (MREC-03)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name  | version |
      | demo  | 1.0.0   |
      | plain | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with this text:
      """
      {"mcpServers": {"events": {"type": "sse", "url": "http://127.0.0.1:9/sse"}}}
      """
    Given the marketplace "fixtures" is added to the project scope
    When the user requests plugin completions for "install --scope project "
    Then the plugin completion set for "install --scope project " contains these suggestions:
      | label          | value                                     | description |
      | demo@fixtures  | "install --scope project demo@fixtures "  |             |
      | plain@fixtures | "install --scope project plain@fixtures " |             |

  @builtin-only
  Scenario: Install completion leaves out a plugin with an sse server, which Pi's built-in MCP can only partially install (MREC-03)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name  | version |
      | demo  | 1.0.0   |
      | plain | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with this text:
      """
      {"mcpServers": {"events": {"type": "sse", "url": "http://127.0.0.1:9/sse"}}}
      """
    Given the marketplace "fixtures" is added to the project scope
    When the user requests plugin completions for "install --scope project "
    Then the plugin completion set for "install --scope project " contains these suggestions:
      | label          | value                                     | description |
      | plain@fixtures | "install --scope project plain@fixtures " |             |

  @adapter-only
  Scenario: Partial update completion offers an installed plugin with an sse server whose new version is unavailable, under pi-mcp-adapter (MREC-03)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name  | version |
      | demo  | 1.0.0   |
      | plain | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with this text:
      """
      {"mcpServers": {"events": {"type": "sse", "url": "http://127.0.0.1:9/sse"}}}
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project --partial", which did not fail
    Given the user has run "/claude:plugin install plain@fixtures --scope project", which did not fail
    Given the marketplace "fixtures" offers these plugins:
      | name  | version |
      | demo  | 1.1.0   |
      | plain | 1.1.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file "hooks/hooks.json" with this text:
      """
      this is not JSON
      """
    When the user requests plugin completions for "update --partial --scope project "
    Then the plugin completion set for "update --partial --scope project " contains these suggestions:
      | label          | value                                              | description |
      | demo@fixtures  | "update --partial --scope project demo@fixtures "  |             |
      | plain@fixtures | "update --partial --scope project plain@fixtures " |             |

  @builtin-only
  Scenario: Partial update completion leaves out an installed plugin with an sse server whose new version is unavailable, under Pi's built-in MCP (MREC-03)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name  | version |
      | demo  | 1.0.0   |
      | plain | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with this text:
      """
      {"mcpServers": {"events": {"type": "sse", "url": "http://127.0.0.1:9/sse"}}}
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project --partial", which did not fail
    Given the user has run "/claude:plugin install plain@fixtures --scope project", which did not fail
    Given the marketplace "fixtures" offers these plugins:
      | name  | version |
      | demo  | 1.1.0   |
      | plain | 1.1.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file "hooks/hooks.json" with this text:
      """
      this is not JSON
      """
    When the user requests plugin completions for "update --partial --scope project "
    Then the plugin completion set for "update --partial --scope project " contains these suggestions:
      | label          | value                                              | description |
      | plain@fixtures | "update --partial --scope project plain@fixtures " |             |

  @mcp
  Scenario: A plugin whose installation record names a plugin root outside its marketplace lists with the verdict its install recorded (UF-1, NFR-10)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with this text:
      """
      {"mcpServers": {"asker": {"command": "node", "bareElicitationCapability": true}}}
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project --partial", which did not fail
    Given the installation record of the plugin "demo@fixtures" in the project scope names a plugin root outside its marketplace
    When the user runs "/claude:plugin list"
    Then the result has these fields:
      | kind                | cascade     |
      | severity            | info        |
      | needs reload        | false       |
      | tally label         | Plugin list |
      | tally failures      | 0           |
      | tally warnings      | 0           |
      | tally success count | 1           |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | installed |         | project | 1.0.0   |

  @mcp
  Scenario: A plugin whose marketplace record names another scope lists with the verdict its install recorded (UF-1, NFR-10)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with this text:
      """
      {"mcpServers": {"asker": {"command": "node", "bareElicitationCapability": true}}}
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project --partial", which did not fail
    Given the project scope's record of the marketplace "fixtures" names the user scope
    When the user runs "/claude:plugin list"
    Then the result has these fields:
      | kind                | cascade     |
      | severity            | info        |
      | needs reload        | false       |
      | tally label         | Plugin list |
      | tally failures      | 0           |
      | tally warnings      | 0           |
      | tally success count | 1           |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | installed |         | project | 1.0.0   |

  @own-implementation
  Scenario: Install completion offers a plugin whose servers each implementation runs only some of, with no MCP implementation (D-P6-22, D-MB-05)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name  | version |
      | demo  | 1.0.0   |
      | plain | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with this text:
      """
      {"mcpServers": {"events": {"type": "sse", "url": "http://127.0.0.1:9/sse"}, "asker": {"command": "node", "bareElicitationCapability": true}}}
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user's pi settings turn off pi's built-in mcp
    Given pi runs with the scripted model
    When the user requests plugin completions for "install --scope project "
    Then the plugin completion set for "install --scope project " contains these suggestions:
      | label          | value                                     | description |
      | demo@fixtures  | "install --scope project demo@fixtures "  |             |
      | plain@fixtures | "install --scope project plain@fixtures " |             |
