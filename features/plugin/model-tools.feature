Feature: Plugin model tools

  A model asks the extension's two tools which marketplaces and plugins exist and reads what they return,
  and neither tool changes anything. A scripted model stands in for the model and calls the tools, and
  local marketplaces and a loopback git host stand in for published ones.

  Background:
    Given pi runs with the scripted model
    Given the git repository "ghp" holds these plugins:
      | name | version | path |
      | ghp  | 1.0.0   |      |
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins:
      | name  | version |
      | alpha | 1.0.0   |
      | beta  | 1.0.0   |
      | delta | 1.0.0   |
      | eps   | 1.0.0   |
      | gamma | 1.0.0   |
    Given the published plugin "delta" of the marketplace "tools" has an output style
    Given the published plugin "gamma" of the marketplace "tools" has an output style
    Given the marketplace "extras" is published as a dir source
    Given the marketplace "extras" offers these plugins:
      | name | version |
      | kilo | 1.0.0   |
      | lima | 1.0.0   |
    Given the marketplace "tools" is added to the project scope
    Given the marketplace "extras" is added to the user scope
    Given the user has run "/claude:plugin install alpha@tools --scope project"
    Given the user has run "/claude:plugin install delta@tools --scope project --partial"
    Given the user has run "/claude:plugin install eps@tools --scope project"
    Given the user has run "/claude:plugin disable eps@tools --scope project"
    Given the user has run "/claude:plugin install kilo@extras --scope user"
    Given the marketplace "tools" offers these plugins:
      | name  | version |
      | alpha | 2.0.0   |
    Given the marketplace "tools" publishes this manifest:
      """
      {
        "name": "tools",
        "owner": { "name": "features" },
        "plugins": [
          { "name": "alpha", "source": "./plugins/alpha", "version": "2.0.0" },
          { "name": "beta", "source": "./plugins/beta", "version": "1.0.0" },
          { "name": "delta", "source": "./plugins/delta", "version": "1.0.0" },
          { "name": "eps", "source": "./plugins/eps", "version": "1.0.0" },
          { "name": "gamma", "source": "./plugins/gamma", "version": "1.0.0" },
          { "name": "npmp", "source": { "source": "npm", "package": "npmp" }, "version": "1.0.0" }
        ]
      }
      """
    Given the marketplace "tools" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | ghp  | github      | ghp        | false  |
    Given the user has started a new pi session

  Scenario: The model reads the marketplaces the list tool returns
    Given the scripted model plays these steps:
      | reply                        | tool                       | arguments |
      |                              | pi_claude_marketplace_list | {}        |
      | Two marketplaces are set up. |                            |           |
    When the user prompts "Which marketplaces are set up?"
    Then the model receives these calls:
      | call | role        | text                                                                                                                                                         |
      | 1    | user        | Which marketplaces are set up?                                                                                                                               |
      | 2    | user        | Which marketplaces are set up?                                                                                                                               |
      | 2    | assistant   | tool call pi_claude_marketplace_list {}                                                                                                                      |
      | 2    | tool result | pi_claude_marketplace_list returned: [project] tools -- 3 plugin(s) -- {home}/marketplaces/tools\n[user] extras -- 1 plugin(s) -- {home}/marketplaces/extras |

  Scenario: A list call with a scope returns only the marketplaces of that scope
    Given the scripted model plays these steps:
      | reply                           | tool                       | arguments           |
      |                                 | pi_claude_marketplace_list | {"scope":"user"}    |
      |                                 | pi_claude_marketplace_list | {"scope":"project"} |
      | Each scope has one marketplace. |                            |                     |
    When the user prompts "Which marketplaces does each scope have?"
    Then the model receives these calls:
      | call | role        | text                                                                                             |
      | 1    | user        | Which marketplaces does each scope have?                                                         |
      | 2    | user        | Which marketplaces does each scope have?                                                         |
      | 2    | assistant   | tool call pi_claude_marketplace_list {"scope":"user"}                                            |
      | 2    | tool result | pi_claude_marketplace_list returned: [user] extras -- 1 plugin(s) -- {home}/marketplaces/extras  |
      | 3    | user        | Which marketplaces does each scope have?                                                         |
      | 3    | assistant   | tool call pi_claude_marketplace_list {"scope":"user"}                                            |
      | 3    | tool result | pi_claude_marketplace_list returned: [user] extras -- 1 plugin(s) -- {home}/marketplaces/extras  |
      | 3    | assistant   | tool call pi_claude_marketplace_list {"scope":"project"}                                         |
      | 3    | tool result | pi_claude_marketplace_list returned: [project] tools -- 3 plugin(s) -- {home}/marketplaces/tools |

  Scenario: A list call with a scope the tool does not accept reaches the model as invalid arguments
    Given the scripted model plays these steps:
      | reply                  | tool                       | arguments              |
      |                        | pi_claude_marketplace_list | {"scope":"everywhere"} |
      | The scope was refused. |                            |                        |
    When the user prompts "Which marketplaces are set up everywhere?"
    Then the model receives these calls:
      | call | role        | text                                                        |
      | 1    | user        | Which marketplaces are set up everywhere?                   |
      | 2    | user        | Which marketplaces are set up everywhere?                   |
      | 2    | assistant   | tool call pi_claude_marketplace_list {"scope":"everywhere"} |
      | 2    | tool result | pi_claude_marketplace_list failed: invalid arguments: scope |

  Scenario: A plugin list call with a scope the tool does not accept reaches the model as invalid arguments
    Given the scripted model plays these steps:
      | reply                  | tool                              | arguments              |
      |                        | pi_claude_marketplace_plugin_list | {"scope":"everywhere"} |
      | The scope was refused. |                                   |                        |
    When the user prompts "Which plugins are there everywhere?"
    Then the model receives these calls:
      | call | role        | text                                                               |
      | 1    | user        | Which plugins are there everywhere?                                |
      | 2    | user        | Which plugins are there everywhere?                                |
      | 2    | assistant   | tool call pi_claude_marketplace_plugin_list {"scope":"everywhere"} |
      | 2    | tool result | pi_claude_marketplace_plugin_list failed: invalid arguments: scope |
