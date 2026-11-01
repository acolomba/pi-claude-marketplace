Feature: Agent companion missing

  An install made while pi-subagents is missing names the missing companion
  and still installs the agent. Once pi-subagents runs, it lists the agent
  with no reinstall. A scripted model and a local marketplace stand in.

  Scenario: Installing a plugin with agents without pi-subagents names the missing companion
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the agent "reviewer" described as "Reviews the files it is given." with this body:
      """
      Review the files named in the task and report every problem you find.
      """
    Given the marketplace "fixtures" is added to the user scope
    When the user runs "/claude:plugin install demo@fixtures --scope user"
    Then the result has these fields:
      | kind         | cascade                             |
      | severity     | warning                             |
      | needs reload | true                                |
      | summary      | A plugin operation needs attention. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons               | scope | version |
      | fixtures         | user              | demo@fixtures | demo | installed | requires pi-subagents | user  | 1.0.0   |

  Scenario: Installing a plugin with agents while pi-subagents runs names no missing companion
    Given pi runs with the scripted model and these companions:
      | companion    |
      | pi-subagents |
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the agent "reviewer" described as "Reviews the files it is given." with this body:
      """
      Review the files named in the task and report every problem you find.
      """
    Given the marketplace "fixtures" is added to the user scope
    When the user runs "/claude:plugin install demo@fixtures --scope user"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope | version |
      | fixtures         | user              | demo@fixtures | demo | installed |         | user  | 1.0.0   |

  Scenario: Starting pi with pi-subagents after the install lists the agents with no reinstall
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the agent "reviewer" described as "Reviews the files it is given." with this body:
      """
      Review the files named in the task and report every problem you find.
      """
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which warned
    # Pi cannot add an extension to a running process, so a new pi that
    # loads pi-subagents stands in for loading it and running /reload.
    Given pi runs with the scripted model and these companions:
      | companion    |
      | pi-subagents |
    Given pi-subagents hides its builtin agents
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
