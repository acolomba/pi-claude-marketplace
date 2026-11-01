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

  Scenario: Effort levels are listed as the thinking levels pi-subagents runs
    Given pi runs with the scripted model and these companions:
      | companion    |
      | pi-subagents |
    Given pi-subagents hides its builtin agents
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these agents:
      | file       | name    | description      | effort | body             |
      | maximal.md | maximal | Thinks at max.   | max    | Answer the task. |
      | mid.md     | mid     | Thinks at med.   | med    | Answer the task. |
      | loud.md    | loud    | Thinks at HIGH.  | HIGH   | Answer the task. |
      | numeric.md | numeric | Thinks at 32000. | 32000  | Answer the task. |
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply                  | tool     | arguments                             |
      |                        | subagent | {"action":"list","capabilities":true} |
      | The agents are listed. |          |                                       |
    When the user prompts "List the agents."
    Then the model receives these calls:
      | call | role        | text                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
      | 1    | user        | List the agents.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
      | 2    | user        | List the agents.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
      | 2    | assistant   | tool call subagent {"action":"list","capabilities":true}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
      | 2    | tool result | subagent returned: Executable agents (capabilities):\nUser agents\n- demo:loud (user, aliases: pi-claude-marketplace-demo-loud): Description: Thinks at HIGH.; Tools: default/ambient; Model: inherits current session; Thinking: high\n- demo:maximal (user, aliases: pi-claude-marketplace-demo-maximal): Description: Thinks at max.; Tools: default/ambient; Model: inherits current session; Thinking: max\n- demo:mid (user, aliases: pi-claude-marketplace-demo-mid): Description: Thinks at med.; Tools: default/ambient; Model: inherits current session; Thinking: medium\n- demo:numeric (user, aliases: pi-claude-marketplace-demo-numeric): Description: Thinks at 32000.; Tools: default/ambient; Model: inherits current session; Thinking: default |

  Scenario: With --map-model Claude Code's model names are listed as the models they select
    Given pi runs with the scripted model and these companions:
      | companion    |
      | pi-subagents |
    Given pi-subagents hides its builtin agents
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these agents:
      | file         | name      | description              | model           | body             |
      | sonnet.md    | sonnet    | Runs on sonnet.          | sonnet          | Answer the task. |
      | opus.md      | opus      | Runs on opus.            | opus            | Answer the task. |
      | opusplan.md  | opusplan  | Runs on opusplan.        | opusplan        | Answer the task. |
      | haiku.md     | haiku     | Runs on haiku.           | haiku           | Answer the task. |
      | fable.md     | fable     | Runs on fable.           | fable           | Answer the task. |
      | best.md      | best      | Runs on best.            | best            | Answer the task. |
      | sonnet-1m.md | sonnet-1m | Runs on sonnet[1m].      | sonnet[1m]      | Answer the task. |
      | full-id.md   | full-id   | Runs on claude-opus-4-7. | claude-opus-4-7 | Answer the task. |
      | inherit.md   | inherit   | Runs on inherit.         | inherit         | Answer the task. |
      | unknown.md   | unknown   | Runs on gpt-5.           | gpt-5           | Answer the task. |
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user --map-model"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply                  | tool     | arguments                             |
      |                        | subagent | {"action":"list","capabilities":true} |
      | The agents are listed. |          |                                       |
    When the user prompts "List the agents."
    Then the model receives these calls:
      | call | role        | text                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
      | 1    | user        | List the agents.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
      | 2    | user        | List the agents.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
      | 2    | assistant   | tool call subagent {"action":"list","capabilities":true}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
      | 2    | tool result | subagent returned: Executable agents (capabilities):\nUser agents\n- demo:best (user, aliases: pi-claude-marketplace-demo-best): Description: Runs on best.; Tools: default/ambient; Model: anthropic/claude-fable-5-1; Thinking: default\n- demo:fable (user, aliases: pi-claude-marketplace-demo-fable): Description: Runs on fable.; Tools: default/ambient; Model: anthropic/claude-fable-5-1; Thinking: default\n- demo:full-id (user, aliases: pi-claude-marketplace-demo-full-id): Description: Runs on claude-opus-4-7.; Tools: default/ambient; Model: anthropic/claude-opus-4-7; Thinking: default\n- demo:haiku (user, aliases: pi-claude-marketplace-demo-haiku): Description: Runs on haiku.; Tools: default/ambient; Model: anthropic/claude-haiku-5-5; Thinking: default\n- demo:inherit (user, aliases: pi-claude-marketplace-demo-inherit): Description: Runs on inherit.; Tools: default/ambient; Model: inherits current session; Thinking: default\n- demo:opus (user, aliases: pi-claude-marketplace-demo-opus): Description: Runs on opus.; Tools: default/ambient; Model: anthropic/claude-opus-5-5; Thinking: default\n- demo:opusplan (user, aliases: pi-claude-marketplace-demo-opusplan): Description: Runs on opusplan.; Tools: default/ambient; Model: anthropic/claude-sonnet-5-5; Thinking: default\n- demo:sonnet (user, aliases: pi-claude-marketplace-demo-sonnet): Description: Runs on sonnet.; Tools: default/ambient; Model: anthropic/claude-sonnet-5-5; Thinking: default\n- demo:sonnet-1m (user, aliases: pi-claude-marketplace-demo-sonnet-1m): Description: Runs on sonnet[1m].; Tools: default/ambient; Model: anthropic/claude-sonnet-5-5; Thinking: default\n- demo:unknown (user, aliases: pi-claude-marketplace-demo-unknown): Description: Runs on gpt-5.; Tools: default/ambient; Model: inherits current session; Thinking: default |

  Scenario: Without --map-model every agent inherits the session's model
    Given pi runs with the scripted model and these companions:
      | companion    |
      | pi-subagents |
    Given pi-subagents hides its builtin agents
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these agents:
      | file      | name   | description     | model  | body             |
      | sonnet.md | sonnet | Runs on sonnet. | sonnet | Answer the task. |
      | opus.md   | opus   | Runs on opus.   | opus   | Answer the task. |
      | fable.md  | fable  | Runs on fable.  | fable  | Answer the task. |
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply                  | tool     | arguments                             |
      |                        | subagent | {"action":"list","capabilities":true} |
      | The agents are listed. |          |                                       |
    When the user prompts "List the agents."
    Then the model receives these calls:
      | call | role        | text                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
      | 1    | user        | List the agents.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
      | 2    | user        | List the agents.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
      | 2    | assistant   | tool call subagent {"action":"list","capabilities":true}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
      | 2    | tool result | subagent returned: Executable agents (capabilities):\nUser agents\n- demo:fable (user, aliases: pi-claude-marketplace-demo-fable): Description: Runs on fable.; Tools: default/ambient; Model: inherits current session; Thinking: default\n- demo:opus (user, aliases: pi-claude-marketplace-demo-opus): Description: Runs on opus.; Tools: default/ambient; Model: inherits current session; Thinking: default\n- demo:sonnet (user, aliases: pi-claude-marketplace-demo-sonnet): Description: Runs on sonnet.; Tools: default/ambient; Model: inherits current session; Thinking: default |

  Scenario: A run of an agent whose model --map-model mapped reports the model pi does not know
    Given pi runs with the scripted model and these companions:
      | companion    |
      | pi-subagents |
    Given pi-subagents hides its builtin agents
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these agents:
      | file        | name     | description                    | model  | body                                |
      | reviewer.md | reviewer | Reviews the files it is given. | sonnet | Review the files named in the task. |
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user --map-model"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply                       | tool     | arguments                                                           |
      |                             | subagent | {"agent":"demo:reviewer","task":"Review the README.","async":false} |
      | The reviewer did not start. |          |                                                                     |
    When the user prompts "Ask the reviewer to check the README."
    Then the model receives these calls:
      | call | role        | text                                                                                                   |
      | 1    | user        | Ask the reviewer to check the README.                                                                  |
      | 2    | user        | Ask the reviewer to check the README.                                                                  |
      | 2    | assistant   | tool call subagent {"agent":"demo:reviewer","task":"Review the README.","async":false}                 |
      | 2    | tool result | subagent failed: Unknown subagent model 'anthropic/claude-sonnet-5-5' in the active Pi model registry. |

  Scenario: Tool lists split on commas and spaces as Claude Code splits them
    Given pi runs with the scripted model and these companions:
      | companion    |
      | pi-subagents |
    Given pi-subagents hides its builtin agents
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these agents:
      | file         | name      | description               | tools                 | disallowedTools | body             |
      | spaced.md    | spaced    | Uses the spaced tools.    | Read Grep             |                 | Answer the task. |
      | patterned.md | patterned | Uses the patterned tools. | Bash(git log *), Read |                 | Answer the task. |
      | starred.md   | starred   | Uses the starred tools.   | *                     |                 | Answer the task. |
      | narrowed.md  | narrowed  | Uses the narrowed tools.  | Read Grep Edit        | Edit Write      | Answer the task. |
      | excluded.md  | excluded  | Uses the excluded tools.  |                       | Bash Edit       | Answer the task. |
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply                  | tool     | arguments                             |
      |                        | subagent | {"action":"list","capabilities":true} |
      | The agents are listed. |          |                                       |
    When the user prompts "List the agents."
    Then the model receives these calls:
      | call | role        | text                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
      | 1    | user        | List the agents.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
      | 2    | user        | List the agents.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
      | 2    | assistant   | tool call subagent {"action":"list","capabilities":true}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
      | 2    | tool result | subagent returned: Executable agents (capabilities):\nUser agents\n- demo:excluded (user, aliases: pi-claude-marketplace-demo-excluded): Description: Uses the excluded tools.; Tools: default/ambient; excludes: bash, edit; Model: inherits current session; Thinking: default\n- demo:narrowed (user, aliases: pi-claude-marketplace-demo-narrowed): Description: Uses the narrowed tools.; Tools: read, grep; Model: inherits current session; Thinking: default\n- demo:patterned (user, aliases: pi-claude-marketplace-demo-patterned): Description: Uses the patterned tools.; Tools: bash, read; Model: inherits current session; Thinking: default\n- demo:spaced (user, aliases: pi-claude-marketplace-demo-spaced): Description: Uses the spaced tools.; Tools: read, grep; Model: inherits current session; Thinking: default\n- demo:starred (user, aliases: pi-claude-marketplace-demo-starred): Description: Uses the starred tools.; Tools: default/ambient; Model: inherits current session; Thinking: default |

  Scenario: Apply reports each plugin agent field Claude Code also ignores
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the agent "helper" described as "Helps with the task." with this body:
      """
      Help with the task.
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project", which warned
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.1.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these agents:
      | file      | name   | description          | initialPrompt | observer | observerMessage | observeSubagents | memory | maxTurns | body                |
      | helper.md | helper | Helps with the task. | Start here.   | true     | Watch the run.  | true             | user   | 5        | Help with the task. |
    When the user runs "/claude:plugin apply --scope project"
    Then the command reports these results:
      | kind                      | severity | needs reload | tally label | tally failures | tally warnings | tally success count | header                                               | lines                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
      | reconcile-applied-cascade | info     | true         | Reconcile   | 0              | 0              | 1                   |                                                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
      | diagnostic                | warning  | false        |             |                |                |                     | Plugin "demo" [project] updated; 5 staging warnings. | [helper] agent-level `initialPrompt` is not converted -- dropped (Claude Code ignores it for plugin agents too)., [helper] agent-level `observer` is not converted -- dropped (Claude Code ignores it for plugin agents too)., [helper] agent-level `observerMessage` is not converted -- dropped (Claude Code ignores it for plugin agents too)., [helper] agent-level `observeSubagents` is not converted -- dropped (Claude Code ignores it for plugin agents too)., [helper] dropped fields: memory, maxTurns |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status  | reasons               | scope   | from  | to    |
      | fixtures         | project           | demo@fixtures | demo | updated | requires pi-subagents | project | 1.0.0 | 1.1.0 |
