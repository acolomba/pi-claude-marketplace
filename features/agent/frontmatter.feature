Feature: Agent frontmatter

  A bridged agent's frontmatter converts to the fields pi-subagents reads, as
  Claude Code reads a plugin agent's frontmatter. pi-subagents' own list and
  get results show the converted fields; a scripted model and a local
  marketplace stand in for a real model and a published marketplace.

  Scenario: An agent runs in the foreground unless its source asks for the background
    Given pi runs with the scripted model and these companions:
      | companion    |
      | pi-subagents |
    Given pi-subagents hides its builtin agents
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these agents:
      | file          | name       | description               | background | body               |
      | plain.md      | plain      | Runs when it is asked.    |            | Answer the task.   |
      | background.md | background | Runs in the background.   | true       | Work in the back.  |
      | quoted.md     | quoted     | Runs behind quoted words. | "true"     | Work behind quote. |
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply                 | tool     | arguments                                  |
      |                       | subagent | {"action":"get","agent":"demo:plain"}      |
      |                       | subagent | {"action":"get","agent":"demo:background"} |
      |                       | subagent | {"action":"get","agent":"demo:quoted"}     |
      | The agents are shown. |          |                                            |
    When the user prompts "Show the agents."
    Then the model receives these calls:
      | call | role        | text                                                                                                                                                                                                                                                                                                                                                                         |
      | 1    | user        | Show the agents.                                                                                                                                                                                                                                                                                                                                                             |
      | 2    | user        | Show the agents.                                                                                                                                                                                                                                                                                                                                                             |
      | 2    | assistant   | tool call subagent {"action":"get","agent":"demo:plain"}                                                                                                                                                                                                                                                                                                                     |
      | 2    | tool result | subagent returned: Agent: demo:plain (user)\nPath: {agent dir}/agents/pi-claude-marketplace-demo-plain.md\nDescription: Runs when it is asked.\nAliases: pi-claude-marketplace-demo-plain\nSystem prompt mode: replace\nInherit project context: true\nInherit global context: false\nInherit skills: true\nAsync: false\n\nSystem Prompt:\nAnswer the task.                 |
      | 3    | user        | Show the agents.                                                                                                                                                                                                                                                                                                                                                             |
      | 3    | assistant   | tool call subagent {"action":"get","agent":"demo:plain"}                                                                                                                                                                                                                                                                                                                     |
      | 3    | tool result | subagent returned: Agent: demo:plain (user)\nPath: {agent dir}/agents/pi-claude-marketplace-demo-plain.md\nDescription: Runs when it is asked.\nAliases: pi-claude-marketplace-demo-plain\nSystem prompt mode: replace\nInherit project context: true\nInherit global context: false\nInherit skills: true\nAsync: false\n\nSystem Prompt:\nAnswer the task.                 |
      | 3    | assistant   | tool call subagent {"action":"get","agent":"demo:background"}                                                                                                                                                                                                                                                                                                                |
      | 3    | tool result | subagent returned: Agent: demo:background (user)\nPath: {agent dir}/agents/pi-claude-marketplace-demo-background.md\nDescription: Runs in the background.\nAliases: pi-claude-marketplace-demo-background\nSystem prompt mode: replace\nInherit project context: true\nInherit global context: false\nInherit skills: true\nAsync: true\n\nSystem Prompt:\nWork in the back. |
      | 4    | user        | Show the agents.                                                                                                                                                                                                                                                                                                                                                             |
      | 4    | assistant   | tool call subagent {"action":"get","agent":"demo:plain"}                                                                                                                                                                                                                                                                                                                     |
      | 4    | tool result | subagent returned: Agent: demo:plain (user)\nPath: {agent dir}/agents/pi-claude-marketplace-demo-plain.md\nDescription: Runs when it is asked.\nAliases: pi-claude-marketplace-demo-plain\nSystem prompt mode: replace\nInherit project context: true\nInherit global context: false\nInherit skills: true\nAsync: false\n\nSystem Prompt:\nAnswer the task.                 |
      | 4    | assistant   | tool call subagent {"action":"get","agent":"demo:background"}                                                                                                                                                                                                                                                                                                                |
      | 4    | tool result | subagent returned: Agent: demo:background (user)\nPath: {agent dir}/agents/pi-claude-marketplace-demo-background.md\nDescription: Runs in the background.\nAliases: pi-claude-marketplace-demo-background\nSystem prompt mode: replace\nInherit project context: true\nInherit global context: false\nInherit skills: true\nAsync: true\n\nSystem Prompt:\nWork in the back. |
      | 4    | assistant   | tool call subagent {"action":"get","agent":"demo:quoted"}                                                                                                                                                                                                                                                                                                                    |
      | 4    | tool result | subagent returned: Agent: demo:quoted (user)\nPath: {agent dir}/agents/pi-claude-marketplace-demo-quoted.md\nDescription: Runs behind quoted words.\nAliases: pi-claude-marketplace-demo-quoted\nSystem prompt mode: replace\nInherit project context: true\nInherit global context: false\nInherit skills: true\nAsync: true\n\nSystem Prompt:\nWork behind quote.          |

  Scenario: A call that leaves the launch mode open runs a bridged agent in the foreground
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
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply                           | tool     | arguments                                             |
      |                                 | subagent | {"agent":"demo:reviewer","task":"Review the README."} |
      | The README has no problems.     |          |                                                       |
      | The reviewer found no problems. |          |                                                       |
    When the user prompts "Ask the reviewer to check the README."
    Then the model receives these calls:
      | call | role        | text                                                                                                              |
      | 1    | user        | Ask the reviewer to check the README.                                                                             |
      | 2    | user        | Task: Review the README.                                                                                          |
      | 3    | user        | Ask the reviewer to check the README.                                                                             |
      | 3    | assistant   | tool call subagent {"agent":"demo:reviewer","task":"Review the README."}                                          |
      | 3    | tool result | subagent returned: Run fan-out: 1/64 used, 63 remaining\nThe README has no problems.\nMission: {uuid} (completed) |
