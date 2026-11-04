@builtin-only
Feature: MCP server builtin values

  Pi's built-in MCP holds, for each plugin server, the values Claude Code reads from its config
  (BLT-02, D-MB-02, D-MB-11, CC-1). Those values never reach a server process, so a probe of Pi's
  MCP registry stands in for what no stub can log, beside a stdio stub server and a local marketplace.

  Scenario: A stdio server's timeout reaches Pi in seconds and its tools stay deferred (BLT-02, D-MB-02, P2-DC-05)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the stub mcp server "stub" with these fields:
      """
      {"timeout": 2500}
      """
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given pi runs with the scripted model and a probe of the mcp servers registered with pi's built-in mcp
    Given the mcp implementation has listed the tools of the stub mcp server "stub" of the plugin "demo"
    When the user lists the mcp tools pi offers
    Then pi holds these mcp server configs, apart from each stdio server's command and arguments:
      | name             | config                                                                                                                                                                                     |
      | plugin_demo_stub | {"env":{"CLAUDE_PLUGIN_ROOT":"{home}/marketplaces/fixtures/plugins/demo","CLAUDE_PLUGIN_DATA":"{agent dir}/pi-claude-marketplace/data/fixtures/demo"},"timeout":2.5,"exposure":"deferred"} |
