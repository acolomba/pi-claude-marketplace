Feature: Plugin install rollback

  An install that fails partway removes what it already wrote, so a retry
  starts clean. A directory in place of a file the install writes stops it,
  even for root, and a local marketplace stands in for a published one.

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
