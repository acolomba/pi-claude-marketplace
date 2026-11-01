Feature: Agent listing

  pi-subagents lists each bridged agent under the name, alias, and description
  Claude Code gives a plugin agent. A scripted model asks pi-subagents for its
  list, and a local marketplace stands in for a published one.

  Scenario: A bridged agent is listed under its plugin name with its alias and description
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

  Scenario: The list keeps pi-subagents' own agents beside a bridged one
    Given pi runs with the scripted model and these companions:
      | companion    |
      | pi-subagents |
    # The builtin researcher's description holds an em dash, which the
    # fix-unicode-dashes pre-commit fixer rewrites in every feature file.
    Given pi-subagents hides the builtin agent "researcher"
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
      | reply                  | tool     | arguments         |
      |                        | subagent | {"action":"list"} |
      | The agents are listed. |          |                   |
    When the user prompts "List the agents."
    Then the model receives these calls:
      | call | role        | text                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
      | 1    | user        | List the agents.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
      | 2    | user        | List the agents.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
      | 2    | assistant   | tool call subagent {"action":"list"}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
      | 2    | tool result | subagent returned: Executable agents:\nUser agents\n- demo:reviewer (user, aliases: pi-claude-marketplace-demo-reviewer): Reviews the files it is given.\n\nBuiltin agents\n- claude-code (builtin, external-cli:claude): Read-only Claude Code CLI analysis; requires local authentication and trusted user settings/hooks\n- claude-code-writer (builtin, external-cli:claude): Explicit file-writing Claude Code CLI mode; requires local authentication and trusted user settings/hooks\n- codex-exec (builtin, external-cli:codex): Read-only one-shot analysis through the installed Codex CLI\n- codex-exec-writer (builtin, external-cli:codex): Explicit workspace-writing one-shot execution through the installed Codex CLI\n- cursor-agent (builtin, external-cli:cursor-agent): Read-only one-shot analysis through the installed Cursor CLI\n- cursor-agent-writer (builtin, external-cli:cursor-agent): Explicit workspace-writing one-shot execution through the installed Cursor CLI\n- delegate (builtin): Lightweight subagent that inherits the parent model with no default reads\n- evidence-auditor (builtin): Independent evidence reviewer for checking whether important research claims are supported by their sources\n- oracle (builtin, context: fork, aliases: advisor): High-context decision-consistency oracle that protects inherited state and prevents drift\n- reviewer (builtin): Versatile review specialist for code diffs, plans, proposed solutions, codebase health, and PR/issue validation\n- scout (builtin): Fast codebase recon that returns compressed context for handoff\n- worker (builtin, context: fresh, aliases: developer, coder, implementer, develop): Implementation agent for normal tasks and approved oracle handoffs |

  Scenario: Agents without a description are listed with Claude Code's fallback
    Given pi runs with the scripted model and these companions:
      | companion    |
      | pi-subagents |
    Given pi-subagents hides its builtin agents
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these agents:
      | file      | name   | when_to_use            | when-to-use        | body                 |
      | plain.md  | plain  |                        |                    | Answer the question. |
      | noted.md  | noted  | Use it to review code. |                    | Review the code.     |
      | dashed.md | dashed |                        | Use it for audits. | Audit the build.     |
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply                  | tool     | arguments         |
      |                        | subagent | {"action":"list"} |
      | The agents are listed. |          |                   |
    When the user prompts "List the agents."
    Then the model receives these calls:
      | call | role        | text                                                                                                                                                                                                                                                                                                                     |
      | 1    | user        | List the agents.                                                                                                                                                                                                                                                                                                         |
      | 2    | user        | List the agents.                                                                                                                                                                                                                                                                                                         |
      | 2    | assistant   | tool call subagent {"action":"list"}                                                                                                                                                                                                                                                                                     |
      | 2    | tool result | subagent returned: Executable agents:\nUser agents\n- demo:dashed (user, aliases: pi-claude-marketplace-demo-dashed): Use it for audits.\n- demo:noted (user, aliases: pi-claude-marketplace-demo-noted): Use it to review code.\n- demo:plain (user, aliases: pi-claude-marketplace-demo-plain): Agent from demo plugin |

  Scenario: Agents of the same name in two plugins are listed under their own plugin names
    Given pi runs with the scripted model and these companions:
      | companion    |
      | pi-subagents |
    Given pi-subagents hides its builtin agents
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name  | version |
      | demo  | 1.0.0   |
      | tools | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the agent "reviewer" described as "Reviews the files it is given." with this body:
      """
      Review the files named in the task and report every problem you find.
      """
    Given the published plugin "tools" of the marketplace "fixtures" has the agent "reviewer" described as "Reviews the tools it is given." with this body:
      """
      Review the tools named in the task and report every problem you find.
      """
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user has run "/claude:plugin install tools@fixtures --scope user"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply                  | tool     | arguments         |
      |                        | subagent | {"action":"list"} |
      | The agents are listed. |          |                   |
    When the user prompts "List the agents."
    Then the model receives these calls:
      | call | role        | text                                                                                                                                                                                                                                                             |
      | 1    | user        | List the agents.                                                                                                                                                                                                                                                 |
      | 2    | user        | List the agents.                                                                                                                                                                                                                                                 |
      | 2    | assistant   | tool call subagent {"action":"list"}                                                                                                                                                                                                                             |
      | 2    | tool result | subagent returned: Executable agents:\nUser agents\n- demo:reviewer (user, aliases: pi-claude-marketplace-demo-reviewer): Reviews the files it is given.\n- tools:reviewer (user, aliases: pi-claude-marketplace-tools-reviewer): Reviews the tools it is given. |

  Scenario: Agent files in subfolders are listed under their folder names
    Given pi runs with the scripted model and these companions:
      | companion    |
      | pi-subagents |
    Given pi-subagents hides its builtin agents
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these agents:
      | file                  | name     | description                            | body                                  |
      | review/security.md    |          | Checks the code for security problems. | Check the code for security problems. |
      | review/deep/nested.md | nested-x | Reviews the code in depth.             | Review the code in depth.             |
      | reviewer.md           | reviewer | Reviews the files it is given.         | Review the files named in the task.   |
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply                  | tool     | arguments         |
      |                        | subagent | {"action":"list"} |
      | The agents are listed. |          |                   |
    When the user prompts "List the agents."
    Then the model receives these calls:
      | call | role        | text                                                                                                                                                                                                                                                                                                                                                                                                           |
      | 1    | user        | List the agents.                                                                                                                                                                                                                                                                                                                                                                                               |
      | 2    | user        | List the agents.                                                                                                                                                                                                                                                                                                                                                                                               |
      | 2    | assistant   | tool call subagent {"action":"list"}                                                                                                                                                                                                                                                                                                                                                                           |
      | 2    | tool result | subagent returned: Executable agents:\nUser agents\n- demo:review:deep:nested-x (user, aliases: pi-claude-marketplace-demo-review-deep-nested-x): Reviews the code in depth.\n- demo:review:security (user, aliases: pi-claude-marketplace-demo-review-security): Checks the code for security problems.\n- demo:reviewer (user, aliases: pi-claude-marketplace-demo-reviewer): Reviews the files it is given. |

  Scenario: Hidden and upper-case agent files are listed as Claude Code lists them
    Given pi runs with the scripted model and these companions:
      | companion    |
      | pi-subagents |
    Given pi-subagents hides its builtin agents
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these agents:
      | file                 | description                  | body                        |
      | .hidden.md           | Works in a hidden file.      | Work in a hidden file.      |
      | .hiddendir/inside.md | Works in a hidden folder.    | Work in a hidden folder.    |
      | UPPER.MD             | Works in an upper-case file. | Work in an upper-case file. |
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply                  | tool     | arguments         |
      |                        | subagent | {"action":"list"} |
      | The agents are listed. |          |                   |
    When the user prompts "List the agents."
    Then the model receives these calls:
      | call | role        | text                                                                                                                                                                                                                                                                                                                                                                   |
      | 1    | user        | List the agents.                                                                                                                                                                                                                                                                                                                                                       |
      | 2    | user        | List the agents.                                                                                                                                                                                                                                                                                                                                                       |
      | 2    | assistant   | tool call subagent {"action":"list"}                                                                                                                                                                                                                                                                                                                                   |
      | 2    | tool result | subagent returned: Executable agents:\nUser agents\n- demo:.hidden (user, aliases: pi-claude-marketplace-demo-.hidden): Works in a hidden file.\n- demo:.hiddendir:inside (user, aliases: pi-claude-marketplace-demo-.hiddendir-inside): Works in a hidden folder.\n- demo:UPPER.MD (user, aliases: pi-claude-marketplace-demo-UPPER.MD): Works in an upper-case file. |

  Scenario: A file without the markdown extension is not listed as an agent
    Given pi runs with the scripted model and these companions:
      | companion    |
      | pi-subagents |
    Given pi-subagents hides its builtin agents
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these agents:
      | file        | name     | description                    | body                                |
      | reviewer.md | reviewer | Reviews the files it is given. | Review the files named in the task. |
      | notes.txt   | notes    | Holds notes.                   | Keep notes.                         |
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
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

  Scenario: A declared agent file is listed under its own name
    Given pi runs with the scripted model and these companions:
      | companion    |
      | pi-subagents |
    Given pi-subagents hides its builtin agents
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".claude-plugin/plugin.json" with this text:
      """
      { "name": "demo", "version": "1.0.0", "agents": "./custom/review/security.md" }
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file "custom/review/security.md" with this text:
      """
      ---
      description: Checks the code for security problems.
      ---

      Check the code for security problems.
      """
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply                | tool     | arguments         |
      |                      | subagent | {"action":"list"} |
      | One agent is listed. |          |                   |
    When the user prompts "List the agents."
    Then the model receives these calls:
      | call | role        | text                                                                                                                                                             |
      | 1    | user        | List the agents.                                                                                                                                                 |
      | 2    | user        | List the agents.                                                                                                                                                 |
      | 2    | assistant   | tool call subagent {"action":"list"}                                                                                                                             |
      | 2    | tool result | subagent returned: Executable agents:\nUser agents\n- demo:security (user, aliases: pi-claude-marketplace-demo-security): Checks the code for security problems. |

  Scenario: An agent whose folder name flattens onto another agent's file name is reported as skipped
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these agents:
      | file               | description                            | body                                  |
      | review/security.md | Checks the code for security problems. | Check the code for security problems. |
      | review-security.md | Reviews the security notes.            | Review the security notes.            |
    Given the marketplace "fixtures" is added to the user scope
    When the user runs "/claude:plugin install demo@fixtures --scope user"
    Then the command reports these results:
      | kind       | severity | needs reload | summary                             | header                                                           | lines                                              |
      | cascade    | warning  | true         | A plugin operation needs attention. |                                                                  |                                                    |
      | diagnostic | warning  | false        |                                     | Plugin "demo" [user] installed; 1 declared component has a note. | agent source "review-security" at "[redacted path] |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons               | scope | version |
      | fixtures         | user              | demo@fixtures | demo | installed | requires pi-subagents | user  | 1.0.0   |
