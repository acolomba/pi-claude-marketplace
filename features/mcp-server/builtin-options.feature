@builtin-only
Feature: MCP server builtin options

  Pi's built-in MCP receives a plugin's options for each plugin server, and a server that names an
  option with no value is not registered (PG-CORE-03, D-PG10-12, D-PG10-21). Those configs never
  reach a server process, so a probe of Pi's MCP registry stands in for what no stub can log.

  Background:
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |

  Scenario: Pi's built-in MCP does not register a server that names a plugin option with no value (PG-CORE-03, D-PG10-21)
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".claude-plugin/plugin.json" with this text:
      """
      {
        "name": "demo",
        "version": "1.0.0",
        "userConfig": {
          "token": { "type": "string", "title": "Token", "description": "The token.", "required": true }
        }
      }
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers": {"keyed": {"command": "pi-features-absent-mcp-server", "env": {"TOKEN": "${user_config.token}"}}, "plain": {"command": "pi-features-absent-mcp-server"}}}
      """
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user --partial", which did not fail
    Given pi runs with the scripted model and a probe of the mcp servers registered with pi's built-in mcp
    When the user asks pi for the configs of the mcp servers registered with it
    Then pi holds these mcp server configs, apart from each stdio server's command and arguments:
      | name              | config                                                                                                                                                                       |
      | plugin_demo_plain | {"env":{"CLAUDE_PLUGIN_ROOT":"{home}/marketplaces/fixtures/plugins/demo","CLAUDE_PLUGIN_DATA":"{agent dir}/pi-claude-marketplace/data/fixtures/demo"},"timeout":1800,"exposure":"deferred"} |
