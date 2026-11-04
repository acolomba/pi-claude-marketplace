Feature: MCP server verdict apply

  Apply and pending follow the MCP implementation pi runs, and a switch of
  implementation alone never asks for consent (MREC-06, D-P3-13) or shows a
  new row (D-P3-14, D-P3-15, D-P3-19). Pending previews a declared plugin that
  the active implementation runs only in part as a partial install, but apply
  installs a declared plugin without --partial and refuses it. A local
  marketplace stands in for a published one, and each sse server points at a
  loopback port that nothing listens on.

  @own-implementation
  Scenario: Apply under Pi's built-in MCP moves a plugin with an sse server, installed without --partial, to its new version partially, without asking (MREC-06)
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
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.1.0   |
    Given pi runs with the scripted model
    When the user runs "/claude:plugin apply --scope user"
    Then the result has these fields:
      | kind                | reconcile-applied-cascade |
      | severity            | info                      |
      | needs reload        | true                      |
      | tally label         | Reconcile                 |
      | tally failures      | 0                         |
      | tally warnings      | 0                         |
      | tally success count | 1                         |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status              | reasons                                  | scope | from  | version |
      | fixtures         | user              | demo@fixtures | demo | partially-installed | unsupported mcp, requires pi-mcp-adapter | user  | 1.0.0 | 1.1.0   |
    Then the installation record of the user scope holds these plugins:
      | id            | version | enabled |
      | demo@fixtures | 1.1.0   | true    |

  @own-implementation
  Scenario: A second apply under Pi's built-in MCP of a plugin with an sse server, installed without --partial, has nothing to change (MREC-06)
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
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.1.0   |
    Given pi runs with the scripted model
    Given the user has run "/claude:plugin apply --scope user", which did not fail
    When the user runs "/claude:plugin apply --scope user"
    Then the result has these fields:
      | kind         | reconcile-pending-empty |
      | severity     | info                    |
      | needs reload | false                   |

  @own-implementation
  Scenario: Pi restarting with its built-in MCP shows no new load row for a plugin with an sse server, and pending lists nothing to apply (D-P3-14, D-P3-15)
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
    Given the user's pi settings turn off pi's built-in mcp
    Given pi runs with the scripted model
    When the user restarts pi with pi's built-in mcp turned on
    Then the session reports no results
    When the user runs "/claude:plugin pending --scope user"
    Then the result has these fields:
      | kind         | reconcile-pending-empty |
      | severity     | info                    |
      | needs reload | false                   |

  @builtin-only
  Scenario: Pending previews a declared plugin with an sse server as will partially install, under Pi's built-in MCP (D-P3-15)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with this text:
      """
      {"mcpServers": {"events": {"type": "sse", "url": "http://127.0.0.1:9/sse"}}}
      """
    Given the marketplace "fixtures" is added to the user scope
    Given a config in scope user and layer base, with these plugins:
      | marketplace | plugin | enabled |
      | fixtures    | demo   |         |
    When the user runs "/claude:plugin pending --scope user"
    Then the result has these fields:
      | kind                | cascade           |
      | severity            | info              |
      | needs reload        | false             |
      | needs apply         | true              |
      | tally label         | Reconcile pending |
      | tally failures      | 0                 |
      | tally warnings      | 0                 |
      | tally success count | 1                 |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status       | reasons | scope | partial |
      | fixtures         | user              | demo@fixtures | demo | will install |         | user  | true    |

  @adapter-only
  Scenario: Pending previews a declared plugin with an sse server as will install, under pi-mcp-adapter (D-P3-15)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with this text:
      """
      {"mcpServers": {"events": {"type": "sse", "url": "http://127.0.0.1:9/sse"}}}
      """
    Given the marketplace "fixtures" is added to the user scope
    Given a config in scope user and layer base, with these plugins:
      | marketplace | plugin | enabled |
      | fixtures    | demo   |         |
    When the user runs "/claude:plugin pending --scope user"
    Then the result has these fields:
      | kind                | cascade           |
      | severity            | info              |
      | needs reload        | false             |
      | needs apply         | true              |
      | tally label         | Reconcile pending |
      | tally failures      | 0                 |
      | tally warnings      | 0                 |
      | tally success count | 1                 |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status       | reasons | scope |
      | fixtures         | user              | demo@fixtures | demo | will install |         | user  |

  @builtin-only
  Scenario: Apply does not install a declared plugin with an sse server without --partial, under Pi's built-in MCP (MREC-06)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with this text:
      """
      {"mcpServers": {"events": {"type": "sse", "url": "http://127.0.0.1:9/sse"}}}
      """
    Given the marketplace "fixtures" is added to the user scope
    Given a config in scope user and layer base, with these plugins:
      | marketplace | plugin | enabled |
      | fixtures    | demo   |         |
    When the user runs "/claude:plugin apply --scope user"
    Then the result has these fields:
      | kind           | reconcile-applied-cascade      |
      | severity       | error                          |
      | needs reload   | false                          |
      | summary        | A plugin operation has failed. |
      | tally label    | Reconcile                      |
      | tally failures | 1                              |
      | tally warnings | 0                              |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status | reasons         | scope | leaks | rollback partial |
      | fixtures         | user              | demo@fixtures | demo | failed | unsupported mcp | user  |       |                  |
    Then the user scope has no installed plugins
