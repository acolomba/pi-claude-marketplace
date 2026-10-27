Feature: Plugin install rollback

  An install that fails partway removes what it already wrote, so a retry
  starts clean. A directory in place of a file the install writes stops it,
  and a local marketplace stands in for a published one. A read-only skill
  directory stops the undo of the skills phase for a user other than root.

  Scenario: An install that fails in its mcp phase leaves no installed plugin
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" is added to the project scope
    Given a directory blocks the mcp-adapter.json file of the project scope
    When the user runs "/claude:plugin install demo@fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status | reasons | scope   | version | cause chain                   | cause truncated | leaks | rollback partial |
      | fixtures         | project           | demo@fixtures | demo | failed |         | project | 1.0.0   | {mcp-adapter.json read error} | false           |       |                  |
    Then the "claude-plugins.json" file of the project scope declares no plugins
    Then the project scope has no installed plugins

  Scenario: A new session after a failed install offers no skills of the plugin
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" is added to the project scope
    Given a directory blocks the mcp-adapter.json file of the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project", which failed
    When the user starts a new pi session
    Then the session offers no skills

  Scenario: An install that failed while a directory blocked the mcp-adapter.json file succeeds once the directory is removed
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" is added to the project scope
    Given a directory blocks the mcp-adapter.json file of the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project", which failed
    Given the directory that blocks the mcp-adapter.json file of the project scope is removed
    When the user runs "/claude:plugin install demo@fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | installed |         | project | 1.0.0   |
    When the user starts a new pi session
    Then the session offers these skills:
      | command           | description            |
      | /skill:demo-skill | A skill of demo 1.0.0. |

  Scenario: An install whose skills rollback cannot finish names the skills phase
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has a read-only skill directory
    Given the marketplace "fixtures" is added to the project scope
    Given a directory blocks the mcp-adapter.json file of the project scope
    When the user runs "/claude:plugin install demo@fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status | reasons          | scope   | version | cause chain                                                  | cause truncated | leaks                                                               | rollback partial                                                                                            |
      | fixtures         | project           | demo@fixtures | demo | failed | rollback partial | project | 1.0.0   | {mcp-adapter.json read error}, {mcp-adapter.json read error} | false           | {project dir}/.pi/pi-claude-marketplace/resources/skills/demo-skill | [{"phase":"skills","cause":{"causeChain":["{read-only skill directory removal error}"],"truncated":false}}] |
    Then the installation record of the project scope holds no plugins
    Then the project scope stages these skills and prompts:
      | kind  | name       |
      | skill | demo-skill |
