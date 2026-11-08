Feature: Plugin subagent child

  A load in a pi-subagents background child changes nothing installed, yet loads the installed
  components (D-MB-12). Stand-ins: a profile Pi with the runner's marker for the child, a one-shot
  json-mode Pi for the next parent load, a scripted model, recording hooks, and a local marketplace.

  Scenario: A background child's load with autoapply on leaves a pending install, uninstall, and update for the next parent load
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
      | old  | 1.0.0   |
      | upd  | 1.0.0   |
    Given a config in scope project and layer base, with this text:
      """
      { "autoapply": true }
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install old@fixtures --scope project"
    Given the user has run "/claude:plugin install upd@fixtures --scope project"
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
      | old  | 1.0.0   |
      | upd  | 1.1.0   |
    Given a config in scope project and layer base, with these plugins:
      | marketplace | plugin | enabled |
      | fixtures    | demo   |         |
      | fixtures    | upd    |         |
    Given pi runs with the scripted model as a pi-subagents background child
    When the user starts a new pi session
    Then the session reports these results:
      | kind    | severity | needs reload | needs apply | tally label       | tally failures | tally warnings | tally success count |
      | cascade | info     | false        | true        | Reconcile pending | 0              | 0              | 3                   |
      | cascade | info     | false        | true        | Reconcile pending | 0              | 0              | 3                   |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status         | reasons | scope   | version | from  | to    |
      | fixtures         | project           | demo@fixtures | demo | will install   |         | project |         |       |       |
      | fixtures         | project           | old@fixtures  | old  | will uninstall |         | project | 1.0.0   |       |       |
      | fixtures         | project           | upd@fixtures  | upd  | will update    |         | project |         | 1.0.0 | 1.1.0 |
      | fixtures         | project           | demo@fixtures | demo | will install   |         | project |         |       |       |
      | fixtures         | project           | old@fixtures  | old  | will uninstall |         | project | 1.0.0   |       |       |
      | fixtures         | project           | upd@fixtures  | upd  | will update    |         | project |         | 1.0.0 | 1.1.0 |
    Then the installation record of the project scope holds these plugins:
      | id           | version | enabled |
      | old@fixtures | 1.0.0   | true    |
      | upd@fixtures | 1.0.0   | true    |
    When the user runs "/claude:plugin list" in pi's json mode
    Then the command reports these results:
      | kind    | severity | needs reload | tally label | tally failures | tally warnings | tally success count |
      | cascade | info     | false        | Plugin list | 0              | 0              | 3                   |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | installed |         | project | 1.0.0   |
      | fixtures         | project           | old@fixtures  | old  | available |         |         | 1.0.0   |
      | fixtures         | project           | upd@fixtures  | upd  | installed |         | project | 1.1.0   |
    Then the installation record of the project scope holds these plugins:
      | id            | version | enabled |
      | demo@fixtures | 1.0.0   | true    |
      | upd@fixtures  | 1.1.0   | true    |

  @own-implementation
  Scenario: A background child's load leaves a release 0.19.2 mcp.json for the next parent load to move
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" declares the mcp server "srv"
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given the mcp.json file of the user scope holds the servers of the plugin "demo@fixtures" as release 0.19.2 wrote them, beside the user's own server "mine"
    Given pi runs with the scripted model as a pi-subagents background child
    When the user starts a new pi session
    Then the session reports no results
    Then the mcp configuration file "mcp.json" of the user scope holds this text:
      """
      {
        "mcpServers": {
          "mine": {
            "command": "pi-features-users-own-mcp-server"
          },
          "srv": {
            "command": "pi-features-absent-mcp-server",
            "args": [],
            "env": {
              "CLAUDE_PLUGIN_ROOT": "{home}/marketplaces/fixtures/plugins/demo",
              "CLAUDE_PLUGIN_DATA": "{agent dir}/pi-claude-marketplace/data/fixtures/demo"
            },
            "_piClaudeMarketplace": {
              "plugin": "demo",
              "marketplace": "fixtures"
            }
          }
        }
      }

      """
    Then the mcp configuration file "mcp-adapter.json" of the user scope holds this text:
      """
      {
        "mcpServers": {}
      }

      """
    When the user runs "/claude:plugin list" in pi's json mode
    Then the command reports these results:
      | kind    | severity | needs reload | tally label | tally failures | tally warnings | tally success count |
      | cascade | info     | false        | Plugin list | 0              | 0              | 1                   |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope | version |
      | fixtures         | user              | demo@fixtures | demo | installed |         | user  | 1.0.0   |
    Then the mcp configuration file "mcp.json" of the user scope holds this text:
      """
      {
        "mcpServers": {
          "mine": {
            "command": "pi-features-users-own-mcp-server"
          }
        }
      }

      """
    Then the mcp configuration file "mcp-adapter.json" of the user scope holds this text:
      """
      {
        "mcpServers": {
          "plugin_demo_srv_": {
            "command": "pi-features-absent-mcp-server",
            "args": [],
            "env": {
              "CLAUDE_PLUGIN_ROOT": "{home}/marketplaces/fixtures/plugins/demo",
              "CLAUDE_PLUGIN_DATA": "{agent dir}/pi-claude-marketplace/data/fixtures/demo"
            },
            "directTools": "search",
            "toolPrefix": "mcp",
            "_piClaudeMarketplace": {
              "plugin": "demo",
              "marketplace": "fixtures"
            }
          }
        }
      }

      """

  Scenario: A background child offers the skill and the slash command of an installed plugin
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the slash command "greet" described as "Greets a person by name." with this body:
      """
      Greet the person named in the arguments.
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given pi runs with the scripted model as a pi-subagents background child
    When the user starts a new pi session
    Then the session reports no results
    Then the session offers these skills:
      | command           | description            |
      | /skill:demo-skill | A skill of demo 1.0.0. |
    When the user lists the slash commands pi offers
    Then pi offers these slash commands from prompt templates:
      | command     | description              |
      | /demo:greet | Greets a person by name. |

  Scenario: A background child runs an installed plugin's PreToolUse hook on a tool call its model makes
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name       | event      | matcher |
      | bash-guard | PreToolUse | Bash    |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given pi runs with the scripted model as a pi-subagents background child
    Given the scripted model plays these steps:
      | reply | tool | arguments                      |
      |       | bash | {"command": "echo from-model"} |
      | Done. |      |                                |
    When the user prompts "run the echo"
    Then the hooks record these runs:
      | event      | session | tool name | tool input                    | cwd           | transcript path | arguments  | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                         | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PreToolUse | first   | Bash      | {"command":"echo from-model"} | {project dir} |                 | bash-guard | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first                  | first             | 1          |
    Then the model receives these calls:
      | call | role        | text                                         |
      | 1    | user        | run the echo                                 |
      | 2    | user        | run the echo                                 |
      | 2    | assistant   | tool call bash {"command":"echo from-model"} |
      | 2    | tool result | bash returned: from-model\n                  |
