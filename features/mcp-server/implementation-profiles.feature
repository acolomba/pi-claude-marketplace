Feature: MCP server implementation profiles

  MCP servers run through pi-mcp-adapter, Pi's built-in MCP, or neither (MSEL-01,
  DUAL-01); the harness checks each Pi against the implementation its launch implies
  (DUAL-02). A local marketplace and the scripted model stand in for real ones.
  Under the builtin profile, a stand-in registers a stub server with Pi's built-in
  MCP for the built-in agent and hook scenarios (MGRT-01, MHK-01) until the extension
  registers servers itself; under the adapter profile pi-mcp-adapter serves the same
  stub, and the stand-in step has no effect (DUAL-01).

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

  @own-implementation
  Scenario: Restarting pi with pi's built-in mcp turned on keeps the installed plugins and reports nothing
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user's pi settings turn off pi's built-in mcp
    Given pi runs with the scripted model
    When the user restarts pi with pi's built-in mcp turned on
    Then the session offers these skills:
      | command           | description            |
      | /skill:demo-skill | A skill of demo 1.0.0. |
    Then the session reports no results

  @own-implementation
  Scenario: Restarting pi with no mcp keeps the installed plugins and reports nothing
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given pi runs with the scripted model
    When the user restarts pi with no mcp
    Then the session offers these skills:
      | command           | description            |
      | /skill:demo-skill | A skill of demo 1.0.0. |
    Then the session reports no results

  @own-implementation
  Scenario: Restarting pi with pi-mcp-adapter keeps the installed plugins and reports nothing
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given pi runs with the scripted model
    When the user restarts pi with pi-mcp-adapter
    Then the session offers these skills:
      | command           | description            |
      | /skill:demo-skill | A skill of demo 1.0.0. |
    Then the session reports no results

  @builtin-only
  Scenario: A stand-in registers the stub mcp server with pi's built-in mcp
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the stub mcp server "stub"
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given a stand-in registers the stub mcp server "stub" of the plugin "demo" with pi's built-in mcp
    Given pi runs with the scripted model and the mcp implementation
    Given the mcp implementation has listed the tools of the stub mcp server "stub" of the plugin "demo"
    When the user lists the mcp tools pi offers
    Then pi lists these registered mcp servers:
      | name             |
      | plugin_demo_stub |
    Then pi offers these plugin mcp tools:
      | tool                        | active |
      | mcp__plugin_demo_stub__echo | no     |

  @adapter-only
  Scenario: Pi-mcp-adapter serves the stub mcp server under the adapter profile
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the stub mcp server "stub"
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given a stand-in registers the stub mcp server "stub" of the plugin "demo" with pi's built-in mcp
    Given pi runs with the scripted model and the mcp implementation
    Given the mcp implementation has listed the tools of the stub mcp server "stub" of the plugin "demo"
    When the user lists the mcp tools pi offers
    Then pi lists these registered mcp servers:
      | name |
    Then pi offers these plugin mcp tools:
      | tool                        | active |
      | mcp__plugin_demo_stub__echo | no     |
