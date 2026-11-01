Feature: Agent lifecycle

  Each plugin verb changes what pi-subagents lists for a bridged agent, seen in a
  new session as Pi's /reload gives it. A scripted model asks pi-subagents for its
  list, and a local marketplace stands in for a published one.

  Background:
    Given pi runs with the scripted model and these companions:
      | companion    |
      | pi-subagents |
    Given pi-subagents hides its builtin agents
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the agent "reviewer" described as "Reviews the files it is given." with this body:
      """
      Review the files named in the task and report every problem you find.
      """
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"

  Scenario: Disabling a plugin removes its agent from pi-subagents' list
    Given the user has run "/claude:plugin disable demo@fixtures --scope user"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply               | tool     | arguments         |
      |                     | subagent | {"action":"list"} |
      | No agent is listed. |          |                   |
    When the user prompts "List the agents."
    Then the model receives these calls:
      | call | role        | text                                            |
      | 1    | user        | List the agents.                                |
      | 2    | user        | List the agents.                                |
      | 2    | assistant   | tool call subagent {"action":"list"}            |
      | 2    | tool result | subagent returned: Executable agents:\n- (none) |

  Scenario: Enabling a disabled plugin lists its agent again
    Given the user has run "/claude:plugin disable demo@fixtures --scope user"
    Given the user has run "/claude:plugin enable demo@fixtures --scope user"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply                | tool     | arguments         |
      |                      | subagent | {"action":"list"} |
      | One agent is listed. |          |                   |
    When the user prompts "List the agents."
    Then the model receives these calls:
      | call | role        | text                                                                                                                                                     |
      | 1    | user        | List the agents.                                                                                                                                         |
      | 2    | user        | List the agents.                                                                                                                                         |
      | 2    | assistant   | tool call subagent {"action":"list"}                                                                                                                     |
      | 2    | tool result | subagent returned: Executable agents:\nUser agents\n- demo:reviewer (user, aliases: pi-claude-marketplace-demo-reviewer): Reviews the files it is given. |
