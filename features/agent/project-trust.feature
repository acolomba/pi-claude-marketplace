Feature: Agent project trust

  pi-subagents runs a project's agents only when Pi trusts the project. Every
  scenario holds a pi settings file, so the profile's trust entry decides. Claude
  Code runs plugin agents in an untrusted folder; refusing one is a Pi gap.

  Scenario: A trusted project runs its plugin agent
    Given the project holds a pi settings file
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
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply                           | tool     | arguments                                                                                  |
      |                                 | subagent | {"agent":"demo:reviewer","agentScope":"project","task":"Review the README.","async":false} |
      | The README has no problems.     |          |                                                                                            |
      | The reviewer found no problems. |          |                                                                                            |
    When the user prompts "Ask the reviewer to check the README."
    Then the model receives these calls:
      | call | role        | text                                                                                                          |
      | 1    | user        | Ask the reviewer to check the README.                                                                         |
      | 2    | user        | task Review the README.                                                                                       |
      | 3    | user        | Ask the reviewer to check the README.                                                                         |
      | 3    | assistant   | tool call subagent {"agent":"demo:reviewer","agentScope":"project","task":"Review the README.","async":false} |
      | 3    | tool result | subagent returned: The README has no problems.                                                                |

  Scenario: An untrusted project does not run its plugin agent
    Given the project holds a pi settings file
    Given pi runs with the scripted model and these companions in an untrusted project:
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
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply                                 | tool     | arguments                                                                                  |
      |                                       | subagent | {"agent":"demo:reviewer","agentScope":"project","task":"Review the README.","async":false} |
      | The reviewer needs a trusted project. |          |                                                                                            |
    When the user prompts "Ask the reviewer to check the README."
    Then the model receives these calls:
      | call | role        | text                                                                                                          |
      | 1    | user        | Ask the reviewer to check the README.                                                                         |
      | 2    | user        | Ask the reviewer to check the README.                                                                         |
      | 2    | assistant   | tool call subagent {"agent":"demo:reviewer","agentScope":"project","task":"Review the README.","async":false} |
      | 2    | tool result | subagent failed: error                                                                                        |

  Scenario: A trusted project runs its plugin agent with the default agent scope
    Given the project holds a pi settings file
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
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply                           | tool     | arguments                                                           |
      |                                 | subagent | {"agent":"demo:reviewer","task":"Review the README.","async":false} |
      | The README has no problems.     |          |                                                                     |
      | The reviewer found no problems. |          |                                                                     |
    When the user prompts "Ask the reviewer to check the README."
    Then the model receives these calls:
      | call | role        | text                                                                                   |
      | 1    | user        | Ask the reviewer to check the README.                                                  |
      | 2    | user        | task Review the README.                                                                |
      | 3    | user        | Ask the reviewer to check the README.                                                  |
      | 3    | assistant   | tool call subagent {"agent":"demo:reviewer","task":"Review the README.","async":false} |
      | 3    | tool result | subagent returned: The README has no problems.                                         |

  Scenario: An untrusted project still runs a user-scope plugin agent
    Given the project holds a pi settings file
    Given pi runs with the scripted model and these companions in an untrusted project:
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
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply                           | tool     | arguments                                                           |
      |                                 | subagent | {"agent":"demo:reviewer","task":"Review the README.","async":false} |
      | The README has no problems.     |          |                                                                     |
      | The reviewer found no problems. |          |                                                                     |
    When the user prompts "Ask the reviewer to check the README."
    Then the model receives these calls:
      | call | role        | text                                                                                   |
      | 1    | user        | Ask the reviewer to check the README.                                                  |
      | 2    | user        | task Review the README.                                                                |
      | 3    | user        | Ask the reviewer to check the README.                                                  |
      | 3    | assistant   | tool call subagent {"agent":"demo:reviewer","task":"Review the README.","async":false} |
      | 3    | tool result | subagent returned: The README has no problems.                                         |
