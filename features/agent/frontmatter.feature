Feature: Agent frontmatter

  A bridged agent's frontmatter converts to the fields pi-subagents reads, as
  Claude Code reads it. pi-subagents' own list and get results show them; a
  scripted model and a local marketplace stand in for real ones.

  Scenario: An ordinary bridged agent leaves its launch mode to pi-subagents
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
      | 2    | tool result | subagent returned: agent demo:plain\npath {agent dir}/agents/pi-claude-marketplace-demo-plain.md\ndescription Runs when it is asked.\naliases pi-claude-marketplace-demo-plain\nsystem prompt mode replace\ninherit project context true\ninherit skills true\nsystem prompt:\nAnswer the task.                              |
      | 3    | user        | Show the agents.                                                                                                                                                                                                                                                                                                             |
      | 3    | assistant   | tool call subagent {"action":"get","agent":"demo:plain"}                                                                                                                                                                                                                                                                     |
      | 3    | tool result | subagent returned: agent demo:plain\npath {agent dir}/agents/pi-claude-marketplace-demo-plain.md\ndescription Runs when it is asked.\naliases pi-claude-marketplace-demo-plain\nsystem prompt mode replace\ninherit project context true\ninherit skills true\nsystem prompt:\nAnswer the task.                              |
      | 3    | assistant   | tool call subagent {"action":"get","agent":"demo:background"}                                                                                                                                                                                                                                                                |
      | 3    | tool result | subagent returned: agent demo:background\npath {agent dir}/agents/pi-claude-marketplace-demo-background.md\ndescription Runs in the background.\naliases pi-claude-marketplace-demo-background\nsystem prompt mode replace\ninherit project context true\ninherit skills true\nasync true\nsystem prompt:\nWork in the back. |
      | 4    | user        | Show the agents.                                                                                                                                                                                                                                                                                                             |
      | 4    | assistant   | tool call subagent {"action":"get","agent":"demo:plain"}                                                                                                                                                                                                                                                                     |
      | 4    | tool result | subagent returned: agent demo:plain\npath {agent dir}/agents/pi-claude-marketplace-demo-plain.md\ndescription Runs when it is asked.\naliases pi-claude-marketplace-demo-plain\nsystem prompt mode replace\ninherit project context true\ninherit skills true\nsystem prompt:\nAnswer the task.                              |
      | 4    | assistant   | tool call subagent {"action":"get","agent":"demo:background"}                                                                                                                                                                                                                                                                |
      | 4    | tool result | subagent returned: agent demo:background\npath {agent dir}/agents/pi-claude-marketplace-demo-background.md\ndescription Runs in the background.\naliases pi-claude-marketplace-demo-background\nsystem prompt mode replace\ninherit project context true\ninherit skills true\nasync true\nsystem prompt:\nWork in the back. |
      | 4    | assistant   | tool call subagent {"action":"get","agent":"demo:quoted"}                                                                                                                                                                                                                                                                    |
      | 4    | tool result | subagent returned: agent demo:quoted\npath {agent dir}/agents/pi-claude-marketplace-demo-quoted.md\ndescription Runs behind quoted words.\naliases pi-claude-marketplace-demo-quoted\nsystem prompt mode replace\ninherit project context true\ninherit skills true\nasync true\nsystem prompt:\nWork behind quote.          |
    Then the agents folder of the user scope holds the file "pi-claude-marketplace-demo-plain.md" with this text:
      """
      ---
      name: demo:plain
      description: Runs when it is asked.
      aliases: pi-claude-marketplace-demo-plain
      allowNestedSubagents: true
      systemPromptMode: replace
      inheritProjectContext: true
      inheritSkills: true
      advertise: true
      provenance:
        generatedBy: pi-claude-marketplace
        sourcePlugin: demo
        sourceAgent: plain
        sourcePath: {home}/marketplaces/fixtures/plugins/demo/agents/plain.md
        droppedFields: []
        droppedTools: []
        warnings: []
      ---

      Answer the task.
      """

  Scenario: An installed ordinary agent adopts the delegated preference on update
    Given pi runs with the scripted model and these companions:
      | companion    |
      | pi-subagents |
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these agents:
      | file     | name  | description            | background | body             |
      | plain.md | plain | Runs when it is asked. |            | Answer the task. |
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the agents folder of the user scope holds the file "pi-claude-marketplace-demo-plain.md" as an earlier release wrote it, with this text:
      """
      ---
      name: demo:plain
      description: Runs when it is asked.
      aliases: pi-claude-marketplace-demo-plain
      systemPromptMode: replace
      inheritProjectContext: true
      inheritSkills: true
      advertise: true
      async: false
      provenance:
        generatedBy: pi-claude-marketplace
        sourcePlugin: demo
        sourceAgent: plain
        sourcePath: {home}/marketplaces/fixtures/plugins/demo/agents/plain.md
        droppedFields: []
        droppedTools: []
        warnings: []
      ---

      Answer the task.
      """
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.1.0   |
    When the user starts a new pi session
    Then the session reports these results:
      | kind    | severity | needs reload | needs apply | tally label       | tally failures | tally warnings | tally success count |
      | cascade | info     | false        | true        | Reconcile pending | 0              | 0              | 1                   |
      | cascade | info     | false        | true        | Reconcile pending | 0              | 0              | 1                   |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status      | reasons | scope | from  | to    |
      | fixtures         | user              | demo@fixtures | demo | will update |         | user  | 1.0.0 | 1.1.0 |
      | fixtures         | user              | demo@fixtures | demo | will update |         | user  | 1.0.0 | 1.1.0 |
    Then the agents folder of the user scope holds the file "pi-claude-marketplace-demo-plain.md" with this text:
      """
      ---
      name: demo:plain
      description: Runs when it is asked.
      aliases: pi-claude-marketplace-demo-plain
      systemPromptMode: replace
      inheritProjectContext: true
      inheritSkills: true
      advertise: true
      async: false
      provenance:
        generatedBy: pi-claude-marketplace
        sourcePlugin: demo
        sourceAgent: plain
        sourcePath: {home}/marketplaces/fixtures/plugins/demo/agents/plain.md
        droppedFields: []
        droppedTools: []
        warnings: []
      ---

      Answer the task.
      """
    When the user runs "/claude:plugin update demo@fixtures --scope user"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status  | reasons | scope | from  | to    |
      | fixtures         | user              | demo@fixtures | demo | updated |         | user  | 1.0.0 | 1.1.0 |
    Then the agents folder of the user scope holds the file "pi-claude-marketplace-demo-plain.md" with this text:
      """
      ---
      name: demo:plain
      description: Runs when it is asked.
      aliases: pi-claude-marketplace-demo-plain
      allowNestedSubagents: true
      systemPromptMode: replace
      inheritProjectContext: true
      inheritSkills: true
      advertise: true
      provenance:
        generatedBy: pi-claude-marketplace
        sourcePlugin: demo
        sourceAgent: plain
        sourcePath: {home}/marketplaces/fixtures/plugins/demo/agents/plain.md
        droppedFields: []
        droppedTools: []
        warnings: []
      ---

      Answer the task.
      """
    Then the agents index of the user scope holds these rows:
      | generated name                   | target file                         |
      | pi-claude-marketplace-demo-plain | pi-claude-marketplace-demo-plain.md |
    When the user runs "/claude:plugin update demo@fixtures --scope user"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status  | reasons    | scope |
      | fixtures         | user              | demo@fixtures | demo | skipped | up-to-date | user  |
    Then the agents folder of the user scope holds the file "pi-claude-marketplace-demo-plain.md" with this text:
      """
      ---
      name: demo:plain
      description: Runs when it is asked.
      aliases: pi-claude-marketplace-demo-plain
      allowNestedSubagents: true
      systemPromptMode: replace
      inheritProjectContext: true
      inheritSkills: true
      advertise: true
      provenance:
        generatedBy: pi-claude-marketplace
        sourcePlugin: demo
        sourceAgent: plain
        sourcePath: {home}/marketplaces/fixtures/plugins/demo/agents/plain.md
        droppedFields: []
        droppedTools: []
        warnings: []
      ---

      Answer the task.
      """

  Scenario: An installed ordinary agent adopts the delegated preference on reinstall
    Given pi runs with the scripted model and these companions:
      | companion    |
      | pi-subagents |
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these agents:
      | file     | name  | description            | background | body             |
      | plain.md | plain | Runs when it is asked. |            | Answer the task. |
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the agents folder of the user scope holds the file "pi-claude-marketplace-demo-plain.md" as an earlier release wrote it, with this text:
      """
      ---
      name: demo:plain
      description: Runs when it is asked.
      aliases: pi-claude-marketplace-demo-plain
      systemPromptMode: replace
      inheritProjectContext: true
      inheritSkills: true
      advertise: true
      async: false
      provenance:
        generatedBy: pi-claude-marketplace
        sourcePlugin: demo
        sourceAgent: plain
        sourcePath: {home}/marketplaces/fixtures/plugins/demo/agents/plain.md
        droppedFields: []
        droppedTools: []
        warnings: []
      ---

      Answer the task.
      """
    When the user starts a new pi session
    Then the session reports no results
    Then the agents folder of the user scope holds the file "pi-claude-marketplace-demo-plain.md" with this text:
      """
      ---
      name: demo:plain
      description: Runs when it is asked.
      aliases: pi-claude-marketplace-demo-plain
      systemPromptMode: replace
      inheritProjectContext: true
      inheritSkills: true
      advertise: true
      async: false
      provenance:
        generatedBy: pi-claude-marketplace
        sourcePlugin: demo
        sourceAgent: plain
        sourcePath: {home}/marketplaces/fixtures/plugins/demo/agents/plain.md
        droppedFields: []
        droppedTools: []
        warnings: []
      ---

      Answer the task.
      """
    When the user runs "/claude:plugin reinstall demo@fixtures --scope user"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status      | reasons | scope | version |
      | fixtures         | user              | demo@fixtures | demo | reinstalled |         | user  | 1.0.0   |
    Then the agents folder of the user scope holds the file "pi-claude-marketplace-demo-plain.md" with this text:
      """
      ---
      name: demo:plain
      description: Runs when it is asked.
      aliases: pi-claude-marketplace-demo-plain
      allowNestedSubagents: true
      systemPromptMode: replace
      inheritProjectContext: true
      inheritSkills: true
      advertise: true
      provenance:
        generatedBy: pi-claude-marketplace
        sourcePlugin: demo
        sourceAgent: plain
        sourcePath: {home}/marketplaces/fixtures/plugins/demo/agents/plain.md
        droppedFields: []
        droppedTools: []
        warnings: []
      ---

      Answer the task.
      """
    Then the agents index of the user scope holds these rows:
      | generated name                   | target file                         |
      | pi-claude-marketplace-demo-plain | pi-claude-marketplace-demo-plain.md |
    When the user runs "/claude:plugin reinstall demo@fixtures --scope user"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status      | reasons | scope | version |
      | fixtures         | user              | demo@fixtures | demo | reinstalled |         | user  | 1.0.0   |
    Then the agents folder of the user scope holds the file "pi-claude-marketplace-demo-plain.md" with this text:
      """
      ---
      name: demo:plain
      description: Runs when it is asked.
      aliases: pi-claude-marketplace-demo-plain
      allowNestedSubagents: true
      systemPromptMode: replace
      inheritProjectContext: true
      inheritSkills: true
      advertise: true
      provenance:
        generatedBy: pi-claude-marketplace
        sourcePlugin: demo
        sourceAgent: plain
        sourcePath: {home}/marketplaces/fixtures/plugins/demo/agents/plain.md
        droppedFields: []
        droppedTools: []
        warnings: []
      ---

      Answer the task.
      """

  @mcp
  Scenario: A call with no launch override runs the ordinary agent in the companion's default mode
    When pi-subagents, with its async-by-default setting unset, launches from a main pi session a real child of each of these agents of a plugin with a stub mcp server, whose hooks record every event and whose stop hook would send a main session back:
      | name  | background | tools | tool calls |
      | plain |            | Bash  | bash       |
    Then pi-subagents ran the real children like this:
      | agent      | mode       | state    | runner process | session |
      | demo:plain | background | complete | recorded       | first   |
    Then the real children's hooks record these runs in any order, and no main-session run names a child:
      | session | event       | tool name | agent type | agent id |
      | first   | PreToolUse  | Bash      | demo:plain | first    |
      | first   | PostToolUse | Bash      | demo:plain | first    |

  @mcp
  Scenario: Explicit background and MCP grants keep a child in the background
    When pi-subagents, with its async-by-default setting false, launches from a main pi session a real child of each of these agents of a plugin with a stub mcp server, whose hooks record every event and whose stop hook would send a main session back:
      | name          | background | tools                       | tool calls         |
      | runner        | true       | Bash, Read                  | bash, failing read |
      | granted       |            | mcp__plugin_demo_stub__echo | stub mcp tool      |
      | granted-false | false      | mcp__plugin_demo_stub__echo | stub mcp tool      |
      | plain         |            | Bash                        | bash               |
    Then pi-subagents ran the real children like this:
      | agent              | mode       | state    | runner process | session |
      | demo:runner        | background | complete | recorded       | first   |
      | demo:granted       | background | complete | recorded       | second  |
      | demo:granted-false | background | complete | recorded       | third   |
      | demo:plain         | foreground |          | none           |         |
    Then the real children's hooks record these runs in any order, and no main-session run names a child:
      | session | event              | tool name                   | agent type         | agent id |
      | first   | PreToolUse         | Bash                        | demo:runner        | first    |
      | first   | PostToolUse        | Bash                        | demo:runner        | first    |
      | first   | PreToolUse         | Read                        | demo:runner        | first    |
      | first   | PostToolUseFailure | Read                        | demo:runner        | first    |
      | second  | PreToolUse         | mcp__plugin_demo_stub__echo | demo:granted       | second   |
      | second  | PostToolUse        | mcp__plugin_demo_stub__echo | demo:granted       | second   |
      | third   | PreToolUse         | mcp__plugin_demo_stub__echo | demo:granted-false | third    |
      | third   | PostToolUse        | mcp__plugin_demo_stub__echo | demo:granted-false | third    |

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
      | call | role        | text                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
      | 1    | user        | List the agents.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
      | 2    | user        | List the agents.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
      | 2    | assistant   | tool call subagent {"action":"list","capabilities":true}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
      | 2    | tool result | subagent returned: agent demo:best, aliases pi-claude-marketplace-demo-best: Runs on best.; model claude-fable-5-1\nagent demo:fable, aliases pi-claude-marketplace-demo-fable: Runs on fable.; model claude-fable-5-1\nagent demo:full-id, aliases pi-claude-marketplace-demo-full-id: Runs on claude-opus-4-7.; model claude-opus-4-7\nagent demo:haiku, aliases pi-claude-marketplace-demo-haiku: Runs on haiku.; model claude-haiku-5-5\nagent demo:inherit, aliases pi-claude-marketplace-demo-inherit: Runs on inherit.\nagent demo:opus, aliases pi-claude-marketplace-demo-opus: Runs on opus.; model claude-opus-5-5\nagent demo:opusplan, aliases pi-claude-marketplace-demo-opusplan: Runs on opusplan.; model claude-sonnet-5-5\nagent demo:sonnet, aliases pi-claude-marketplace-demo-sonnet: Runs on sonnet.; model claude-sonnet-5-5\nagent demo:sonnet-1m, aliases pi-claude-marketplace-demo-sonnet-1m: Runs on sonnet[1m].; model claude-sonnet-5-5\nagent demo:unknown, aliases pi-claude-marketplace-demo-unknown: Runs on gpt-5. |

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
      | 2    | tool result | subagent failed: error naming claude-sonnet-5-5                              |

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
      | call | role        | text                                                                                                                                                                                                                                                                                                               |
      | 1    | user        | Show the agents.                                                                                                                                                                                                                                                                                                   |
      | 2    | user        | Show the agents.                                                                                                                                                                                                                                                                                                   |
      | 2    | assistant   | tool call subagent {"action":"get","agent":"demo:granted"}                                                                                                                                                                                                                                                         |
      | 2    | tool result | subagent returned: agent demo:granted\npath {agent dir}/agents/pi-claude-marketplace-demo-granted.md\ndescription Uses the granted skill.\naliases pi-claude-marketplace-demo-granted\ntools read\nsystem prompt mode replace\ninherit project context true\ninherit skills true\nsystem prompt:\nAnswer the task. |
      | 3    | user        | Show the agents.                                                                                                                                                                                                                                                                                                   |
      | 3    | assistant   | tool call subagent {"action":"get","agent":"demo:granted"}                                                                                                                                                                                                                                                         |
      | 3    | tool result | subagent returned: agent demo:granted\npath {agent dir}/agents/pi-claude-marketplace-demo-granted.md\ndescription Uses the granted skill.\naliases pi-claude-marketplace-demo-granted\ntools read\nsystem prompt mode replace\ninherit project context true\ninherit skills true\nsystem prompt:\nAnswer the task. |
      | 3    | assistant   | tool call subagent {"action":"get","agent":"demo:denied"}                                                                                                                                                                                                                                                          |
      | 3    | tool result | subagent returned: agent demo:denied\npath {agent dir}/agents/pi-claude-marketplace-demo-denied.md\ndescription Has no skills.\naliases pi-claude-marketplace-demo-denied\nsystem prompt mode replace\ninherit project context true\ninherit skills false\nsystem prompt:\nAnswer the task.                        |

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

  Scenario: Apply reports no staging warning for an agent that disallows a tool without a tools list
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
      | file      | name   | description          | disallowedTools | body                |
      | helper.md | helper | Helps with the task. | Bash            | Help with the task. |
    When the user runs "/claude:plugin apply --scope project"
    Then the command reports these results:
      | kind                      | severity | needs reload | tally label | tally failures | tally warnings | tally success count |
      | reconcile-applied-cascade | info     | true         | Reconcile   | 0              | 0              | 1                   |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status  | reasons               | scope   | from  | to    |
      | fixtures         | project           | demo@fixtures | demo | updated | requires pi-subagents | project | 1.0.0 | 1.1.0 |

  Scenario: Quoted frontmatter values are listed without their quote marks
    Given pi runs with the scripted model and these companions:
      | companion    |
      | pi-subagents |
    Given pi-subagents hides its builtin agents
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these agents:
      | file     | name  | description             | model    | body             |
      | colon.md | colon | "Reviews: code."        |          | Answer the task. |
      | named.md | "x"   | Names itself in quotes. |          | Answer the task. |
      | mixed.md | mixed | Reviews: code and tests | "sonnet" | Answer the task. |
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user --map-model"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply                  | tool     | arguments                             |
      |                        | subagent | {"action":"list","capabilities":true} |
      | The agents are listed. |          |                                       |
    When the user prompts "List the agents."
    Then the model receives these calls:
      | call | role        | text                                                                                                                                                                                                                                                                                     |
      | 1    | user        | List the agents.                                                                                                                                                                                                                                                                         |
      | 2    | user        | List the agents.                                                                                                                                                                                                                                                                         |
      | 2    | assistant   | tool call subagent {"action":"list","capabilities":true}                                                                                                                                                                                                                                 |
      | 2    | tool result | subagent returned: agent demo:colon, aliases pi-claude-marketplace-demo-colon: Reviews: code.\nagent demo:mixed, aliases pi-claude-marketplace-demo-mixed: Reviews: code and tests; model claude-sonnet-5-5\nagent demo:x, aliases pi-claude-marketplace-demo-x: Names itself in quotes. |

  Scenario: A comment after a frontmatter value is not part of the value
    Given pi runs with the scripted model and these companions:
      | companion    |
      | pi-subagents |
    Given pi-subagents hides its builtin agents
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these agents:
      | file      | name   | description                | tools       | body             |
      | noted.md  | noted  | Notes its tool list.       | Read # note | Answer the task. |
      | hidden.md | hidden | Hides a tool in a comment. | Read # Bash | Answer the task. |
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply                  | tool     | arguments                             |
      |                        | subagent | {"action":"list","capabilities":true} |
      | The agents are listed. |          |                                       |
    When the user prompts "List the agents."
    Then the model receives these calls:
      | call | role        | text                                                                                                                                                                                                                  |
      | 1    | user        | List the agents.                                                                                                                                                                                                      |
      | 2    | user        | List the agents.                                                                                                                                                                                                      |
      | 2    | assistant   | tool call subagent {"action":"list","capabilities":true}                                                                                                                                                              |
      | 2    | tool result | subagent returned: agent demo:hidden, aliases pi-claude-marketplace-demo-hidden: Hides a tool in a comment.; tools read\nagent demo:noted, aliases pi-claude-marketplace-demo-noted: Notes its tool list.; tools read |
    Then the agents folder of the user scope holds the file "pi-claude-marketplace-demo-noted.md" with this text:
      """
      ---
      name: demo:noted
      description: Notes its tool list.
      aliases: pi-claude-marketplace-demo-noted
      tools: read
      systemPromptMode: replace
      inheritProjectContext: true
      inheritSkills: false
      advertise: true
      provenance:
        generatedBy: pi-claude-marketplace
        sourcePlugin: demo
        sourceAgent: noted
        sourcePath: {home}/marketplaces/fixtures/plugins/demo/agents/noted.md
        droppedFields: []
        droppedTools: []
        warnings: []
      ---

      Answer the task.
      """

  Scenario: A key written twice keeps its last value, as Claude Code keeps it
    Given pi runs with the scripted model and these companions:
      | companion    |
      | pi-subagents |
    Given pi-subagents hides its builtin agents
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file "agents/twice.md" with this text:
      """
      ---
      name: twice
      description: Lists its tools twice.
      tools: Read
      tools: Read, Grep
      ---

      Answer the task.
      """
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply                  | tool     | arguments                             |
      |                        | subagent | {"action":"list","capabilities":true} |
      | The agents are listed. |          |                                       |
    When the user prompts "List the agents."
    Then the model receives these calls:
      | call | role        | text                                                                                                                    |
      | 1    | user        | List the agents.                                                                                                        |
      | 2    | user        | List the agents.                                                                                                        |
      | 2    | assistant   | tool call subagent {"action":"list","capabilities":true}                                                                |
      | 2    | tool result | subagent returned: agent demo:twice, aliases pi-claude-marketplace-demo-twice: Lists its tools twice.; tools read, grep |

  Scenario: Installing an agent whose frontmatter cannot be parsed reports the agent
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file "agents/broken.md" with this text:
      """
      ---
      name: fixer
      description: "Fixes the code
      tools: Read
      ---

      Answer the task.
      """
    Given the marketplace "fixtures" is added to the user scope
    When the user runs "/claude:plugin install demo@fixtures --scope user"
    Then the command reports these results:
      | kind       | severity | needs reload | summary                             | header                                                           | lines                                                                                                                                                                                                                         |
      | cascade    | warning  | true         | A plugin operation needs attention. |                                                                  |                                                                                                                                                                                                                               |
      | diagnostic | warning  | false        |                                     | Plugin "demo" [user] installed; 1 declared component has a note. | agent "demo:broken": its source frontmatter could not be parsed (Missing closing "quote at line 3, column 12); the agent is loaded with no frontmatter fields, so its tools, model, and description settings are not applied. |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons               | scope | version |
      | fixtures         | user              | demo@fixtures | demo | installed | requires pi-subagents | user  | 1.0.0   |

  Scenario: Installing an agent whose frontmatter holds no keys reports the agent
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file "agents/keyless.md" with this text:
      """
      ---
      tools Read
      ---

      Answer the task.
      """
    Given the marketplace "fixtures" is added to the user scope
    When the user runs "/claude:plugin install demo@fixtures --scope user"
    Then the command reports these results:
      | kind       | severity | needs reload | summary                             | header                                                           | lines                                                                                                                                                                                                                       |
      | cascade    | warning  | true         | A plugin operation needs attention. |                                                                  |                                                                                                                                                                                                                             |
      | diagnostic | warning  | false        |                                     | Plugin "demo" [user] installed; 1 declared component has a note. | agent "demo:keyless": its source frontmatter could not be parsed (the frontmatter is not a mapping of keys); the agent is loaded with no frontmatter fields, so its tools, model, and description settings are not applied. |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons               | scope | version |
      | fixtures         | user              | demo@fixtures | demo | installed | requires pi-subagents | user  | 1.0.0   |

  Scenario: An agent whose frontmatter cannot be parsed is listed under its file name with Claude Code's fallback description
    Given pi runs with the scripted model and these companions:
      | companion    |
      | pi-subagents |
    Given pi-subagents hides its builtin agents
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file "agents/broken.md" with this text:
      """
      ---
      name: fixer
      description: "Fixes the code
      tools: Read
      ---

      Answer the task.
      """
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply                  | tool     | arguments                             |
      |                        | subagent | {"action":"list","capabilities":true} |
      | The agents are listed. |          |                                       |
    When the user prompts "List the agents."
    Then the model receives these calls:
      | call | role        | text                                                                                                    |
      | 1    | user        | List the agents.                                                                                        |
      | 2    | user        | List the agents.                                                                                        |
      | 2    | assistant   | tool call subagent {"action":"list","capabilities":true}                                                |
      | 2    | tool result | subagent returned: agent demo:broken, aliases pi-claude-marketplace-demo-broken: Agent from demo plugin |
    Then the agents folder of the user scope holds the file "pi-claude-marketplace-demo-broken.md" with this text:
      """
      ---
      name: demo:broken
      description: Agent from demo plugin
      aliases: pi-claude-marketplace-demo-broken
      allowNestedSubagents: true
      systemPromptMode: replace
      inheritProjectContext: true
      inheritSkills: true
      advertise: true
      provenance:
        generatedBy: pi-claude-marketplace
        sourcePlugin: demo
        sourceAgent: broken
        sourcePath: {home}/marketplaces/fixtures/plugins/demo/agents/broken.md
        droppedFields: []
        droppedTools: []
        warnings:
          - source description was missing or empty -- using fallback
      ---

      Answer the task.
      """

  Scenario: A description block keeps its lines
    Given pi runs with the scripted model and these companions:
      | companion    |
      | pi-subagents |
    Given pi-subagents hides its builtin agents
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file "agents/block.md" with this text:
      """
      ---
      name: block
      description: |
        Reviews the change.
        Then it reports each finding.
      tools: Read
      ---

      Answer the task.
      """
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply               | tool     | arguments                             |
      |                     | subagent | {"action":"get","agent":"demo:block"} |
      | The agent is shown. |          |                                       |
    When the user prompts "Show the agent."
    Then the model receives these calls:
      | call | role        | text                                                                                                                                                                                                                                                                                                                                     |
      | 1    | user        | Show the agent.                                                                                                                                                                                                                                                                                                                          |
      | 2    | user        | Show the agent.                                                                                                                                                                                                                                                                                                                          |
      | 2    | assistant   | tool call subagent {"action":"get","agent":"demo:block"}                                                                                                                                                                                                                                                                                 |
      | 2    | tool result | subagent returned: agent demo:block\npath {agent dir}/agents/pi-claude-marketplace-demo-block.md\ndescription Reviews the change.\nThen it reports each finding.\naliases pi-claude-marketplace-demo-block\ntools read\nsystem prompt mode replace\ninherit project context true\ninherit skills false\nsystem prompt:\nAnswer the task. |
    Then the agents folder of the user scope holds the file "pi-claude-marketplace-demo-block.md" with this text:
      """
      ---
      name: demo:block
      description: |-
        Reviews the change.
        Then it reports each finding.
      aliases: pi-claude-marketplace-demo-block
      tools: read
      systemPromptMode: replace
      inheritProjectContext: true
      inheritSkills: false
      advertise: true
      provenance:
        generatedBy: pi-claude-marketplace
        sourcePlugin: demo
        sourceAgent: block
        sourcePath: {home}/marketplaces/fixtures/plugins/demo/agents/block.md
        droppedFields: []
        droppedTools: []
        warnings: []
      ---

      Answer the task.
      """

  Scenario: An update renames an agent that was installed under a name with quote marks
    Given pi runs with the scripted model and these companions:
      | companion    |
      | pi-subagents |
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these agents:
      | file     | name  | description             | body             |
      | named.md | '"x"' | Names itself in quotes. | Answer the task. |
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the agents folder of the user scope holds the file "pi-claude-marketplace-demo-\"x\".md" as an earlier release wrote it, with this text:
      """
      ---
      name: demo:"x"
      description: Names itself in quotes.
      aliases: pi-claude-marketplace-demo-"x"
      systemPromptMode: replace
      inheritProjectContext: true
      inheritSkills: true
      advertise: true
      async: false
      provenance:
        generatedBy: pi-claude-marketplace
        sourcePlugin: demo
        sourceAgent: "x"
        sourcePath: {home}/marketplaces/fixtures/plugins/demo/agents/named.md
        droppedFields: []
        droppedTools: []
        warnings: []
      ---

      Answer the task.
      """
    Given the published plugin "demo" of the marketplace "fixtures" has these agents:
      | file     | name | description             | body             |
      | named.md | "x"  | Names itself in quotes. | Answer the task. |
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.1.0   |
    When the user starts a new pi session
    Then the session reports these results:
      | kind    | severity | needs reload | needs apply | tally label       | tally failures | tally warnings | tally success count |
      | cascade | info     | false        | true        | Reconcile pending | 0              | 0              | 1                   |
      | cascade | info     | false        | true        | Reconcile pending | 0              | 0              | 1                   |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status      | reasons | scope | from  | to    |
      | fixtures         | user              | demo@fixtures | demo | will update |         | user  | 1.0.0 | 1.1.0 |
      | fixtures         | user              | demo@fixtures | demo | will update |         | user  | 1.0.0 | 1.1.0 |
    Then the agents directory of the user scope holds these file names:
      | file                              |
      | pi-claude-marketplace-demo-"x".md |
    Then the agents folder of the user scope holds the file "pi-claude-marketplace-demo-\"x\".md" with this text:
      """
      ---
      name: demo:"x"
      description: Names itself in quotes.
      aliases: pi-claude-marketplace-demo-"x"
      systemPromptMode: replace
      inheritProjectContext: true
      inheritSkills: true
      advertise: true
      async: false
      provenance:
        generatedBy: pi-claude-marketplace
        sourcePlugin: demo
        sourceAgent: "x"
        sourcePath: {home}/marketplaces/fixtures/plugins/demo/agents/named.md
        droppedFields: []
        droppedTools: []
        warnings: []
      ---

      Answer the task.
      """
    Then the agents index of the user scope holds these rows:
      | generated name                 | target file                       |
      | pi-claude-marketplace-demo-"x" | pi-claude-marketplace-demo-"x".md |
    When the user runs "/claude:plugin update demo@fixtures --scope user"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status  | reasons | scope | from  | to    |
      | fixtures         | user              | demo@fixtures | demo | updated |         | user  | 1.0.0 | 1.1.0 |
    Then the agents directory of the user scope holds these file names:
      | file                            |
      | pi-claude-marketplace-demo-x.md |
    Then the agents folder of the user scope holds the file "pi-claude-marketplace-demo-x.md" with this text:
      """
      ---
      name: demo:x
      description: Names itself in quotes.
      aliases: pi-claude-marketplace-demo-x
      allowNestedSubagents: true
      systemPromptMode: replace
      inheritProjectContext: true
      inheritSkills: true
      advertise: true
      provenance:
        generatedBy: pi-claude-marketplace
        sourcePlugin: demo
        sourceAgent: x
        sourcePath: {home}/marketplaces/fixtures/plugins/demo/agents/named.md
        droppedFields: []
        droppedTools: []
        warnings: []
      ---

      Answer the task.
      """
    Then the agents index of the user scope holds these rows:
      | generated name               | target file                     |
      | pi-claude-marketplace-demo-x | pi-claude-marketplace-demo-x.md |
    Then the installation record of the user scope holds these agents of "demo@fixtures":
      | agent                        |
      | pi-claude-marketplace-demo-x |

  Scenario: A reinstall renames an agent that was installed under a name with quote marks
    Given pi runs with the scripted model and these companions:
      | companion    |
      | pi-subagents |
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these agents:
      | file     | name  | description             | body             |
      | named.md | '"x"' | Names itself in quotes. | Answer the task. |
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the agents folder of the user scope holds the file "pi-claude-marketplace-demo-\"x\".md" as an earlier release wrote it, with this text:
      """
      ---
      name: demo:"x"
      description: Names itself in quotes.
      aliases: pi-claude-marketplace-demo-"x"
      systemPromptMode: replace
      inheritProjectContext: true
      inheritSkills: true
      advertise: true
      async: false
      provenance:
        generatedBy: pi-claude-marketplace
        sourcePlugin: demo
        sourceAgent: "x"
        sourcePath: {home}/marketplaces/fixtures/plugins/demo/agents/named.md
        droppedFields: []
        droppedTools: []
        warnings: []
      ---

      Answer the task.
      """
    Given the published plugin "demo" of the marketplace "fixtures" has these agents:
      | file     | name | description             | body             |
      | named.md | "x"  | Names itself in quotes. | Answer the task. |
    When the user starts a new pi session
    Then the session reports no results
    Then the agents directory of the user scope holds these file names:
      | file                              |
      | pi-claude-marketplace-demo-"x".md |
    Then the agents folder of the user scope holds the file "pi-claude-marketplace-demo-\"x\".md" with this text:
      """
      ---
      name: demo:"x"
      description: Names itself in quotes.
      aliases: pi-claude-marketplace-demo-"x"
      systemPromptMode: replace
      inheritProjectContext: true
      inheritSkills: true
      advertise: true
      async: false
      provenance:
        generatedBy: pi-claude-marketplace
        sourcePlugin: demo
        sourceAgent: "x"
        sourcePath: {home}/marketplaces/fixtures/plugins/demo/agents/named.md
        droppedFields: []
        droppedTools: []
        warnings: []
      ---

      Answer the task.
      """
    Then the agents index of the user scope holds these rows:
      | generated name                 | target file                       |
      | pi-claude-marketplace-demo-"x" | pi-claude-marketplace-demo-"x".md |
    When the user runs "/claude:plugin reinstall demo@fixtures --scope user"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status      | reasons | scope | version |
      | fixtures         | user              | demo@fixtures | demo | reinstalled |         | user  | 1.0.0   |
    Then the agents directory of the user scope holds these file names:
      | file                            |
      | pi-claude-marketplace-demo-x.md |
    Then the agents folder of the user scope holds the file "pi-claude-marketplace-demo-x.md" with this text:
      """
      ---
      name: demo:x
      description: Names itself in quotes.
      aliases: pi-claude-marketplace-demo-x
      allowNestedSubagents: true
      systemPromptMode: replace
      inheritProjectContext: true
      inheritSkills: true
      advertise: true
      provenance:
        generatedBy: pi-claude-marketplace
        sourcePlugin: demo
        sourceAgent: x
        sourcePath: {home}/marketplaces/fixtures/plugins/demo/agents/named.md
        droppedFields: []
        droppedTools: []
        warnings: []
      ---

      Answer the task.
      """
    Then the agents index of the user scope holds these rows:
      | generated name               | target file                     |
      | pi-claude-marketplace-demo-x | pi-claude-marketplace-demo-x.md |
    Then the installation record of the user scope holds these agents of "demo@fixtures":
      | agent                        |
      | pi-claude-marketplace-demo-x |

  Scenario Outline: An agent that grants <grant> gets pi-subagents' subagent tool
    Given pi runs with the scripted model and these companions:
      | companion    |
      | pi-subagents |
    Given pi-subagents hides its builtin agents
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these agents:
      | file    | name | description          | tools         | body             |
      | lead.md | lead | Delegates the tasks. | Read, <grant> | Answer the task. |
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply               | tool     | arguments                            |
      |                     | subagent | {"action":"get","agent":"demo:lead"} |
      | The agent is shown. |          |                                      |
    When the user prompts "Show the agent."
    Then the model receives these calls:
      | call | role        | text                                                                                                                                                                                                                                                                                                              |
      | 1    | user        | Show the agent.                                                                                                                                                                                                                                                                                                   |
      | 2    | user        | Show the agent.                                                                                                                                                                                                                                                                                                   |
      | 2    | assistant   | tool call subagent {"action":"get","agent":"demo:lead"}                                                                                                                                                                                                                                                           |
      | 2    | tool result | subagent returned: agent demo:lead\npath {agent dir}/agents/pi-claude-marketplace-demo-lead.md\ndescription Delegates the tasks.\naliases pi-claude-marketplace-demo-lead\ntools read, subagent\nsystem prompt mode replace\ninherit project context true\ninherit skills false\nsystem prompt:\nAnswer the task. |

    Examples:
      | grant              |
      | Agent              |
      | Agent(demo:helper) |
      | Task               |
      | Task(a, b)         |

  Scenario: A disallowed Agent or Task entry removes the subagent tool from a tools list
    Given pi runs with the scripted model and these companions:
      | companion    |
      | pi-subagents |
    Given pi-subagents hides its builtin agents
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these agents:
      | file     | name  | description   | tools       | disallowedTools | body             |
      | agent.md | agent | Denies Task.  | Read, Agent | Task            | Answer the task. |
      | task.md  | task  | Denies Agent. | Read, Task  | Agent           | Answer the task. |
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply                 | tool     | arguments                             |
      |                       | subagent | {"action":"get","agent":"demo:agent"} |
      |                       | subagent | {"action":"get","agent":"demo:task"}  |
      | The agents are shown. |          |                                       |
    When the user prompts "Show the agents."
    Then the model receives these calls:
      | call | role        | text                                                                                                                                                                                                                                                                                               |
      | 1    | user        | Show the agents.                                                                                                                                                                                                                                                                                   |
      | 2    | user        | Show the agents.                                                                                                                                                                                                                                                                                   |
      | 2    | assistant   | tool call subagent {"action":"get","agent":"demo:agent"}                                                                                                                                                                                                                                           |
      | 2    | tool result | subagent returned: agent demo:agent\npath {agent dir}/agents/pi-claude-marketplace-demo-agent.md\ndescription Denies Task.\naliases pi-claude-marketplace-demo-agent\ntools read\nsystem prompt mode replace\ninherit project context true\ninherit skills false\nsystem prompt:\nAnswer the task. |
      | 3    | user        | Show the agents.                                                                                                                                                                                                                                                                                   |
      | 3    | assistant   | tool call subagent {"action":"get","agent":"demo:agent"}                                                                                                                                                                                                                                           |
      | 3    | tool result | subagent returned: agent demo:agent\npath {agent dir}/agents/pi-claude-marketplace-demo-agent.md\ndescription Denies Task.\naliases pi-claude-marketplace-demo-agent\ntools read\nsystem prompt mode replace\ninherit project context true\ninherit skills false\nsystem prompt:\nAnswer the task. |
      | 3    | assistant   | tool call subagent {"action":"get","agent":"demo:task"}                                                                                                                                                                                                                                            |
      | 3    | tool result | subagent returned: agent demo:task\npath {agent dir}/agents/pi-claude-marketplace-demo-task.md\ndescription Denies Agent.\naliases pi-claude-marketplace-demo-task\ntools read\nsystem prompt mode replace\ninherit project context true\ninherit skills false\nsystem prompt:\nAnswer the task.   |

  Scenario: An agent without a tools list that disallows Agent or Task shows the subagent tool as excluded
    Given pi runs with the scripted model and these companions:
      | companion    |
      | pi-subagents |
    Given pi-subagents hides its builtin agents
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these agents:
      | file     | name  | description   | disallowedTools | body             |
      | agent.md | agent | Denies Agent. | Agent           | Answer the task. |
      | task.md  | task  | Denies Task.  | Task(helper)    | Answer the task. |
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply                 | tool     | arguments                             |
      |                       | subagent | {"action":"get","agent":"demo:agent"} |
      |                       | subagent | {"action":"get","agent":"demo:task"}  |
      | The agents are shown. |          |                                       |
    When the user prompts "Show the agents."
    Then the model receives these calls:
      | call | role        | text                                                                                                                                                                                                                                                                                                            |
      | 1    | user        | Show the agents.                                                                                                                                                                                                                                                                                                |
      | 2    | user        | Show the agents.                                                                                                                                                                                                                                                                                                |
      | 2    | assistant   | tool call subagent {"action":"get","agent":"demo:agent"}                                                                                                                                                                                                                                                        |
      | 2    | tool result | subagent returned: agent demo:agent\npath {agent dir}/agents/pi-claude-marketplace-demo-agent.md\ndescription Denies Agent.\naliases pi-claude-marketplace-demo-agent\nexcluded tools subagent\nsystem prompt mode replace\ninherit project context true\ninherit skills true\nsystem prompt:\nAnswer the task. |
      | 3    | user        | Show the agents.                                                                                                                                                                                                                                                                                                |
      | 3    | assistant   | tool call subagent {"action":"get","agent":"demo:agent"}                                                                                                                                                                                                                                                        |
      | 3    | tool result | subagent returned: agent demo:agent\npath {agent dir}/agents/pi-claude-marketplace-demo-agent.md\ndescription Denies Agent.\naliases pi-claude-marketplace-demo-agent\nexcluded tools subagent\nsystem prompt mode replace\ninherit project context true\ninherit skills true\nsystem prompt:\nAnswer the task. |
      | 3    | assistant   | tool call subagent {"action":"get","agent":"demo:task"}                                                                                                                                                                                                                                                         |
      | 3    | tool result | subagent returned: agent demo:task\npath {agent dir}/agents/pi-claude-marketplace-demo-task.md\ndescription Denies Task.\naliases pi-claude-marketplace-demo-task\nexcluded tools subagent\nsystem prompt mode replace\ninherit project context true\ninherit skills true\nsystem prompt:\nAnswer the task.     |

  Scenario: A source model of inherit runs the child on the session's model over pi-subagents' default model without --map-model
    Given pi runs with the scripted model and these companions:
      | companion    |
      | pi-subagents |
    Given pi-subagents hides its builtin agents
    Given pi-subagents runs subagents on the model "claude-haiku-5-5" by default
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these agents:
      | file       | name    | description      | model   | body             |
      | inherit.md | inherit | Runs on inherit. | inherit | Answer the task. |
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply              | tool     | arguments                                                  |
      |                    | subagent | {"agent":"demo:inherit","task":"Answer it.","async":false} |
      | The answer.        |          |                                                            |
      | The agent replied. |          |                                                            |
    When the user prompts "Ask the agent."
    Then the model receives these calls:
      | call | role        | text                                                                          |
      | 1    | user        | Ask the agent.                                                                |
      | 2    | user        | task Answer it.                                                               |
      | 3    | user        | Ask the agent.                                                                |
      | 3    | assistant   | tool call subagent {"agent":"demo:inherit","task":"Answer it.","async":false} |
      | 3    | tool result | subagent returned: The answer.                                                |

  Scenario: A source model of inherit runs the child on the session's model over pi-subagents' default model with --map-model
    Given pi runs with the scripted model and these companions:
      | companion    |
      | pi-subagents |
    Given pi-subagents hides its builtin agents
    Given pi-subagents runs subagents on the model "claude-haiku-5-5" by default
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these agents:
      | file       | name    | description      | model   | body             |
      | inherit.md | inherit | Runs on inherit. | inherit | Answer the task. |
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user --map-model"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply              | tool     | arguments                                                  |
      |                    | subagent | {"agent":"demo:inherit","task":"Answer it.","async":false} |
      | The answer.        |          |                                                            |
      | The agent replied. |          |                                                            |
    When the user prompts "Ask the agent."
    Then the model receives these calls:
      | call | role        | text                                                                          |
      | 1    | user        | Ask the agent.                                                                |
      | 2    | user        | task Answer it.                                                               |
      | 3    | user        | Ask the agent.                                                                |
      | 3    | assistant   | tool call subagent {"agent":"demo:inherit","task":"Answer it.","async":false} |
      | 3    | tool result | subagent returned: The answer.                                                |
