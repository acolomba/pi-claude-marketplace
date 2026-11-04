@builtin-only
Feature: MCP server builtin status

  Plugin info shows each plugin server's state as far as Pi's built-in MCP exposes it (BLT-05),
  and reports an mcp.json override or a refused registration there (BLT-04), for a trusted
  project only where Pi reads it (D-MB-09). A stdio stub server stands in for a real one, a
  scripted model for a real model, and a local marketplace for a published one. Each scenario
  compares the full info fields (P2-DC-16); they are re-verified after the read-time verdicts merge.

  Scenario: Plugin info shows a connected built-in server as connected (BLT-05)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the stub mcp server "stub"
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given pi runs with the scripted model
    Given the mcp implementation has listed the tools of the stub mcp server "stub" of the plugin "demo"
    When the user runs "/claude:plugin info demo@fixtures --scope user"
    Then the result has these fields:
      | kind                           | plugin-info                                        |
      | marketplace details autoupdate | false                                              |
      | marketplace name               | fixtures                                           |
      | marketplace scope              | user                                               |
      | needs reload                   | false                                              |
      | plugin components mcp          | [{"name":"plugin:demo:stub","status":"connected"}] |
      | plugin components resolved     | true                                               |
      | plugin components skills       | demo-skill                                         |
      | plugin id                      | demo@fixtures                                      |
      | plugin name                    | demo                                               |
      | plugin reasons                 |                                                    |
      | plugin requires                | [{"companion":"pi-mcp-adapter","missing":true}]    |
      | plugin scope                   | user                                               |
      | plugin status                  | installed                                          |
      | plugin version                 | 1.0.0                                              |
      | severity                       | info                                               |
