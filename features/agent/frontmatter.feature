Feature: Agent frontmatter

  A bridged agent's frontmatter converts to the fields pi-subagents reads, as
  Claude Code reads it. pi-subagents' own list and get results show them; a
  scripted model and a local marketplace stand in for real ones.

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
      | call | role        | text                                                                                                                                                                                                                                                                                                                         |
      | 1    | user        | Show the agents.                                                                                                                                                                                                                                                                                                             |
      | 2    | user        | Show the agents.                                                                                                                                                                                                                                                                                                             |
      | 2    | assistant   | tool call subagent {"action":"get","agent":"demo:plain"}                                                                                                                                                                                                                                                                     |
      | 2    | tool result | subagent returned: agent demo:plain\npath {agent dir}/agents/pi-claude-marketplace-demo-plain.md\ndescription Runs when it is asked.\naliases pi-claude-marketplace-demo-plain\nsystem prompt mode replace\ninherit project context true\ninherit skills true\nasync false\nsystem prompt:\nAnswer the task.                 |
      | 3    | user        | Show the agents.                                                                                                                                                                                                                                                                                                             |
      | 3    | assistant   | tool call subagent {"action":"get","agent":"demo:plain"}                                                                                                                                                                                                                                                                     |
      | 3    | tool result | subagent returned: agent demo:plain\npath {agent dir}/agents/pi-claude-marketplace-demo-plain.md\ndescription Runs when it is asked.\naliases pi-claude-marketplace-demo-plain\nsystem prompt mode replace\ninherit project context true\ninherit skills true\nasync false\nsystem prompt:\nAnswer the task.                 |
      | 3    | assistant   | tool call subagent {"action":"get","agent":"demo:background"}                                                                                                                                                                                                                                                                |
      | 3    | tool result | subagent returned: agent demo:background\npath {agent dir}/agents/pi-claude-marketplace-demo-background.md\ndescription Runs in the background.\naliases pi-claude-marketplace-demo-background\nsystem prompt mode replace\ninherit project context true\ninherit skills true\nasync true\nsystem prompt:\nWork in the back. |
      | 4    | user        | Show the agents.                                                                                                                                                                                                                                                                                                             |
      | 4    | assistant   | tool call subagent {"action":"get","agent":"demo:plain"}                                                                                                                                                                                                                                                                     |
      | 4    | tool result | subagent returned: agent demo:plain\npath {agent dir}/agents/pi-claude-marketplace-demo-plain.md\ndescription Runs when it is asked.\naliases pi-claude-marketplace-demo-plain\nsystem prompt mode replace\ninherit project context true\ninherit skills true\nasync false\nsystem prompt:\nAnswer the task.                 |
      | 4    | assistant   | tool call subagent {"action":"get","agent":"demo:background"}                                                                                                                                                                                                                                                                |
      | 4    | tool result | subagent returned: agent demo:background\npath {agent dir}/agents/pi-claude-marketplace-demo-background.md\ndescription Runs in the background.\naliases pi-claude-marketplace-demo-background\nsystem prompt mode replace\ninherit project context true\ninherit skills true\nasync true\nsystem prompt:\nWork in the back. |
      | 4    | assistant   | tool call subagent {"action":"get","agent":"demo:quoted"}                                                                                                                                                                                                                                                                    |
      | 4    | tool result | subagent returned: agent demo:quoted\npath {agent dir}/agents/pi-claude-marketplace-demo-quoted.md\ndescription Runs behind quoted words.\naliases pi-claude-marketplace-demo-quoted\nsystem prompt mode replace\ninherit project context true\ninherit skills true\nasync true\nsystem prompt:\nWork behind quote.          |

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
      | call | role        | text                                                                     |
      | 1    | user        | Ask the reviewer to check the README.                                    |
      | 2    | user        | task Review the README.                                                  |
      | 3    | user        | Ask the reviewer to check the README.                                    |
      | 3    | assistant   | tool call subagent {"agent":"demo:reviewer","task":"Review the README."} |
      | 3    | tool result | subagent returned: The README has no problems.                           |

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
      | call | role        | text                                                                                                                                                                                                                                                                                                                                                                                 |
      | 1    | user        | List the agents.                                                                                                                                                                                                                                                                                                                                                                     |
      | 2    | user        | List the agents.                                                                                                                                                                                                                                                                                                                                                                     |
      | 2    | assistant   | tool call subagent {"action":"list","capabilities":true}                                                                                                                                                                                                                                                                                                                             |
      | 2    | tool result | subagent returned: agent demo:loud, aliases pi-claude-marketplace-demo-loud: Thinks at HIGH.; thinking high\nagent demo:maximal, aliases pi-claude-marketplace-demo-maximal: Thinks at max.; thinking max\nagent demo:mid, aliases pi-claude-marketplace-demo-mid: Thinks at med.; thinking medium\nagent demo:numeric, aliases pi-claude-marketplace-demo-numeric: Thinks at 32000. |

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
      | call | role        | text                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
      | 1    | user        | List the agents.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
      | 2    | user        | List the agents.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
      | 2    | assistant   | tool call subagent {"action":"list","capabilities":true}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
      | 2    | tool result | subagent returned: agent demo:best, aliases pi-claude-marketplace-demo-best: Runs on best.; model anthropic/claude-fable-5-1\nagent demo:fable, aliases pi-claude-marketplace-demo-fable: Runs on fable.; model anthropic/claude-fable-5-1\nagent demo:full-id, aliases pi-claude-marketplace-demo-full-id: Runs on claude-opus-4-7.; model anthropic/claude-opus-4-7\nagent demo:haiku, aliases pi-claude-marketplace-demo-haiku: Runs on haiku.; model anthropic/claude-haiku-5-5\nagent demo:inherit, aliases pi-claude-marketplace-demo-inherit: Runs on inherit.\nagent demo:opus, aliases pi-claude-marketplace-demo-opus: Runs on opus.; model anthropic/claude-opus-5-5\nagent demo:opusplan, aliases pi-claude-marketplace-demo-opusplan: Runs on opusplan.; model anthropic/claude-sonnet-5-5\nagent demo:sonnet, aliases pi-claude-marketplace-demo-sonnet: Runs on sonnet.; model anthropic/claude-sonnet-5-5\nagent demo:sonnet-1m, aliases pi-claude-marketplace-demo-sonnet-1m: Runs on sonnet[1m].; model anthropic/claude-sonnet-5-5\nagent demo:unknown, aliases pi-claude-marketplace-demo-unknown: Runs on gpt-5. |

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
      | call | role        | text                                                                                                                                                                                                                                                  |
      | 1    | user        | List the agents.                                                                                                                                                                                                                                      |
      | 2    | user        | List the agents.                                                                                                                                                                                                                                      |
      | 2    | assistant   | tool call subagent {"action":"list","capabilities":true}                                                                                                                                                                                              |
      | 2    | tool result | subagent returned: agent demo:fable, aliases pi-claude-marketplace-demo-fable: Runs on fable.\nagent demo:opus, aliases pi-claude-marketplace-demo-opus: Runs on opus.\nagent demo:sonnet, aliases pi-claude-marketplace-demo-sonnet: Runs on sonnet. |

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
      | call | role        | text                                                                                   |
      | 1    | user        | Ask the reviewer to check the README.                                                  |
      | 2    | user        | Ask the reviewer to check the README.                                                  |
      | 2    | assistant   | tool call subagent {"agent":"demo:reviewer","task":"Review the README.","async":false} |
      | 2    | tool result | subagent failed: error naming anthropic/claude-sonnet-5-5                              |

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
      | call | role        | text                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
      | 1    | user        | List the agents.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
      | 2    | user        | List the agents.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
      | 2    | assistant   | tool call subagent {"action":"list","capabilities":true}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
      | 2    | tool result | subagent returned: agent demo:excluded, aliases pi-claude-marketplace-demo-excluded: Uses the excluded tools.; excluded tools bash, edit\nagent demo:narrowed, aliases pi-claude-marketplace-demo-narrowed: Uses the narrowed tools.; tools read, grep\nagent demo:patterned, aliases pi-claude-marketplace-demo-patterned: Uses the patterned tools.; tools bash, read\nagent demo:spaced, aliases pi-claude-marketplace-demo-spaced: Uses the spaced tools.; tools read, grep\nagent demo:starred, aliases pi-claude-marketplace-demo-starred: Uses the starred tools. |

  Scenario: A Skill entry with a pattern grants or disallows the skills as the Skill tool does
    Given pi runs with the scripted model and these companions:
      | companion    |
      | pi-subagents |
    Given pi-subagents hides its builtin agents
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these agents:
      | file       | name    | description             | tools               | disallowedTools | body             |
      | granted.md | granted | Uses the granted skill. | Read, Skill(helper) |                 | Answer the task. |
      | denied.md  | denied  | Has no skills.          |                     | Skill(helper)   | Answer the task. |
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply                 | tool     | arguments                               |
      |                       | subagent | {"action":"get","agent":"demo:granted"} |
      |                       | subagent | {"action":"get","agent":"demo:denied"}  |
      | The agents are shown. |          |                                         |
    When the user prompts "Show the agents."
    Then the model receives these calls:
      | call | role        | text                                                                                                                                                                                                                                                                                                                            |
      | 1    | user        | Show the agents.                                                                                                                                                                                                                                                                                                                |
      | 2    | user        | Show the agents.                                                                                                                                                                                                                                                                                                                |
      | 2    | assistant   | tool call subagent {"action":"get","agent":"demo:granted"}                                                                                                                                                                                                                                                                      |
      | 2    | tool result | subagent returned: agent demo:granted\npath {agent dir}/agents/pi-claude-marketplace-demo-granted.md\ndescription Uses the granted skill.\naliases pi-claude-marketplace-demo-granted\ntools read\nsystem prompt mode replace\ninherit project context true\ninherit skills true\nasync false\nsystem prompt:\nAnswer the task. |
      | 3    | user        | Show the agents.                                                                                                                                                                                                                                                                                                                |
      | 3    | assistant   | tool call subagent {"action":"get","agent":"demo:granted"}                                                                                                                                                                                                                                                                      |
      | 3    | tool result | subagent returned: agent demo:granted\npath {agent dir}/agents/pi-claude-marketplace-demo-granted.md\ndescription Uses the granted skill.\naliases pi-claude-marketplace-demo-granted\ntools read\nsystem prompt mode replace\ninherit project context true\ninherit skills true\nasync false\nsystem prompt:\nAnswer the task. |
      | 3    | assistant   | tool call subagent {"action":"get","agent":"demo:denied"}                                                                                                                                                                                                                                                                       |
      | 3    | tool result | subagent returned: agent demo:denied\npath {agent dir}/agents/pi-claude-marketplace-demo-denied.md\ndescription Has no skills.\naliases pi-claude-marketplace-demo-denied\nsystem prompt mode replace\ninherit project context true\ninherit skills false\nasync false\nsystem prompt:\nAnswer the task.                        |

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
