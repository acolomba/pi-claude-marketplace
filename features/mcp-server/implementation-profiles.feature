Feature: MCP server implementation profiles

  MCP servers run through pi-mcp-adapter, Pi's built-in MCP, or neither (MSEL-01,
  DUAL-01); the harness checks each Pi against the implementation its launch implies
  (DUAL-02). A local marketplace and the scripted model stand in for real ones.

  @own-implementation
  Scenario: Restarting pi without pi-mcp-adapter keeps the installed plugins and reports nothing
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given pi runs with the scripted model and these companions:
      | companion      |
      | pi-mcp-adapter |
    When the user restarts pi without pi-mcp-adapter
    Then the session offers these skills:
      | command           | description            |
      | /skill:demo-skill | A skill of demo 1.0.0. |
    Then the session reports no results
