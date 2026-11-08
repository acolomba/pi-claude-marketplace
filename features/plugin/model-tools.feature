Feature: Plugin model tools

  A model asks the extension's two tools which marketplaces and plugins exist, and reads what they return.
  A scripted model stands in for the model and calls the tools, and a local marketplace stands in for a
  published one.

  Scenario: The model reads the marketplaces the list tool returns
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply                      | tool                       | arguments |
      |                            | pi_claude_marketplace_list | {}        |
      | One marketplace is set up. |                            |           |
    When the user prompts "Which marketplaces are set up?"
    Then the model receives these calls:
      | call | role        | text                                                                                                |
      | 1    | user        | Which marketplaces are set up?                                                                      |
      | 2    | user        | Which marketplaces are set up?                                                                      |
      | 2    | assistant   | tool call pi_claude_marketplace_list {}                                                             |
      | 2    | tool result | pi_claude_marketplace_list returned: [user] fixtures -- 1 plugin(s) -- {home}/marketplaces/fixtures |

  Scenario: A plugin list call with a scope the tool does not accept reaches the model as invalid arguments
    Given pi runs with the scripted model
    Given the user has started a new pi session
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
