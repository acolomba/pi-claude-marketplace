Feature: MCP server implementation switch

  An installed plugin's servers run through whichever MCP implementation Pi loads after a restart,
  with no plugin command (MSEL-02, MSEL-03, MSEL-04), and a record an earlier release wrote needs
  no reinstall (MREC-02); the user, never the extension, turns Pi's built-in MCP on (D-MB-01).
  A stdio stub server, a scripted model, and a local marketplace stand in for real ones.

  @mcp
  Scenario: A plugin an earlier release installed reaches its server with no reinstall (MREC-02)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the stub mcp server "stub"
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given the installation record of the plugin "demo@fixtures" in the user scope has no recorded mcp servers, as an earlier release wrote it
    Given pi runs with the scripted model and the mcp implementation
    Given the mcp implementation has listed the tools of the stub mcp server "stub" of the plugin "demo"
    When the user lists the mcp tools pi offers
    Then pi offers these plugin mcp tools:
      | tool                        | active |
      | mcp__plugin_demo_stub__echo | no     |
