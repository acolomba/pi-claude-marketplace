Feature: Slash command model runs

  Protects how the model runs a bridged command on its own, as Claude Code's model does through its
  Skill tool: a tool lists the described commands and returns a command's filled body, with its
  context commands not run. A local marketplace and a scripted model stand in for published and
  real ones.

  Background:
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the slash command "deploy" with this command file:
      """
      ---
      description: Deploys the branch.
      ---

      Deploy $ARGUMENTS now. Status: !`printf ran`
      """

  Scenario: The model is offered a tool that lists the described commands
    Given the published plugin "demo" of the marketplace "fixtures" has the slash command "advise" with this command file:
      """
      ---
      when_to_use: Use when the user asks for advice.
      ---

      Give advice.
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the slash command "plain" with this command file:
      """
      Plain body.
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the slash command "manual" with this command file:
      """
      ---
      description: Runs by hand only.
      disable-model-invocation: true
      ---

      Manual body.
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply  |
      | Hello. |
    When the user prompts "hello"
    Then the model receives these calls:
      | call | role | text  |
      | 1    | user | hello |
    Then the model call 1 is offered the tool "run_plugin_command" with this description:
      """
      Run a slash command of an installed Claude Code plugin when the user's request matches it. The result is the command's instructions with the arguments filled in. Follow them as if the user had typed the command. Its !`command` lines are not run.

      The following commands are available:
      - demo:advise: Give advice. - Use when the user asks for advice.
      - demo:deploy: Deploys the branch.
      """

  Scenario: The model runs a command through the tool and gets its filled body with its context command not run
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply     | tool               | arguments                                     |
      |           | run_plugin_command | {"command":"demo:deploy","args":"production"} |
      | Deployed. |                    |                                               |
    When the user prompts "Deploy to production."
    Then the model receives these calls:
      | call | role        | text                                                                       |
      | 1    | user        | Deploy to production.                                                      |
      | 2    | user        | Deploy to production.                                                      |
      | 2    | assistant   | tool call run_plugin_command {"command":"demo:deploy","args":"production"} |
      | 2    | tool result | run_plugin_command returned: Deploy production now. Status: !`printf ran`  |

  Scenario: The tool refuses a command that only the user may run
    Given the published plugin "demo" of the marketplace "fixtures" has the slash command "manual" with this command file:
      """
      ---
      description: Runs by hand only.
      disable-model-invocation: true
      ---

      Manual body.
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply    | tool               | arguments                 |
      |          | run_plugin_command | {"command":"demo:manual"} |
      | Refused. |                    |                           |
    When the user prompts "Run the manual command."
    Then the model receives these calls:
      | call | role        | text                                                                                                                                                                                                                                                                                                                   |
      | 1    | user        | Run the manual command.                                                                                                                                                                                                                                                                                                |
      | 2    | user        | Run the manual command.                                                                                                                                                                                                                                                                                                |
      | 2    | assistant   | tool call run_plugin_command {"command":"demo:manual"}                                                                                                                                                                                                                                                                 |
      | 2    | tool result | run_plugin_command failed: Command demo:manual cannot be used with run_plugin_command due to disable-model-invocation. Ask the user to run /demo:manual themselves; it cannot be invoked via run_plugin_command. Do not replicate this command's workflow by other means; it is reserved for explicit user invocation. |

  Scenario: The model is offered no command tool when the user's pi directory records no install of the project's commands
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user's pi directory records no plugin install for the project
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply  |
      | Hello. |
    When the user prompts "hello"
    Then the model receives these calls:
      | call | role | text  |
      | 1    | user | hello |
    Then the model calls are offered these tools:
      | call | tools                                                                                  |
      | 1    | read, bash, edit, write, pi_claude_marketplace_list, pi_claude_marketplace_plugin_list |
