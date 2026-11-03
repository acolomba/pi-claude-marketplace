Feature: Agent invocation

  Running a bridged agent through pi-subagents starts a child whose system
  prompt is the agent's body. A scripted model stands in for a real one, and
  a local marketplace for a published one.

  Scenario: A foreground agent run starts a child whose system prompt is the agent body
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
      | reply                           | tool     | arguments                                                           |
      |                                 | subagent | {"agent":"demo:reviewer","task":"Review the README.","async":false} |
      | The README has no problems.     |          |                                                                     |
      | The reviewer found no problems. |          |                                                                     |
    When the user prompts "Ask the reviewer to check the README."
    Then the agent's model call 2 runs on the body of the agent file "pi-claude-marketplace-demo-reviewer.md" of the user scope, which reads:
      """
      Review the files named in the task and report every problem you find.
      """
    Then the model receives these calls:
      | call | role        | text                                                                                   |
      | 1    | user        | Ask the reviewer to check the README.                                                  |
      | 2    | user        | task Review the README.                                                                |
      | 3    | user        | Ask the reviewer to check the README.                                                  |
      | 3    | assistant   | tool call subagent {"agent":"demo:reviewer","task":"Review the README.","async":false} |
      | 3    | tool result | subagent returned: The README has no problems.                                         |

  Scenario: An agent that preloads a plugin skill runs with the skill's content in its system prompt
    Given pi runs with the scripted model and these companions:
      | companion    |
      | pi-subagents |
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file "skills/helper/SKILL.md" with this text:
      """
      ---
      name: helper
      description: Explains the house rules.
      ---
      Read ${CLAUDE_SKILL_DIR}/rules.md before you review.
      The plugin lives in ${CLAUDE_PLUGIN_ROOT}.
      """
    Given the published plugin "demo" of the marketplace "fixtures" has these agents:
      | file        | name     | description                    | skills | body                                                                  |
      | reviewer.md | reviewer | Reviews the files it is given. | helper | Review the files named in the task and report every problem you find. |
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply                           | tool     | arguments                                                           |
      |                                 | subagent | {"agent":"demo:reviewer","task":"Review the README.","async":false} |
      | The README has no problems.     |          |                                                                     |
      | The reviewer found no problems. |          |                                                                     |
    When the user prompts "Ask the reviewer to check the README."
    Then the agent's model call 2 runs on the body of the agent file "pi-claude-marketplace-demo-reviewer.md" of the user scope, which reads:
      """
      Review the files named in the task and report every problem you find.

      Base directory for this skill: {agent dir}/pi-claude-marketplace/resources/skills/demo-helper

      Read {agent dir}/pi-claude-marketplace/resources/skills/demo-helper/rules.md before you review.
      The plugin lives in {home}/marketplaces/fixtures/plugins/demo.
      """
    Then the model receives these calls:
      | call | role        | text                                                                                   |
      | 1    | user        | Ask the reviewer to check the README.                                                  |
      | 2    | user        | task Review the README.                                                                |
      | 3    | user        | Ask the reviewer to check the README.                                                  |
      | 3    | assistant   | tool call subagent {"agent":"demo:reviewer","task":"Review the README.","async":false} |
      | 3    | tool result | subagent returned: The README has no problems.                                         |

  Scenario: An agent does not preload a skill that has no description
    Given pi runs with the scripted model and these companions:
      | companion    |
      | pi-subagents |
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file "skills/bare/SKILL.md" with this text:
      """
      ---
      name: bare
      ---
      Follow the bare rules.
      """
    Given the published plugin "demo" of the marketplace "fixtures" has these agents:
      | file        | name     | description                    | skills | body                                                                  |
      | reviewer.md | reviewer | Reviews the files it is given. | bare   | Review the files named in the task and report every problem you find. |
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply               | tool     | arguments                               |
      |                     | subagent | {"action":"get","agent":"demo:reviewer"} |
      | The agent is shown. |          |                                         |
    When the user prompts "Show the reviewer."
    Then the model receives these calls:
      | call | role        | text                                                                                                                                                                                                                                                                                                                                                                               |
      | 1    | user        | Show the reviewer.                                                                                                                                                                                                                                                                                                                                                                 |
      | 2    | user        | Show the reviewer.                                                                                                                                                                                                                                                                                                                                                                 |
      | 2    | assistant   | tool call subagent {"action":"get","agent":"demo:reviewer"}                                                                                                                                                                                                                                                                                                                        |
      | 2    | tool result | subagent returned: agent demo:reviewer\npath {agent dir}/agents/pi-claude-marketplace-demo-reviewer.md\ndescription Reviews the files it is given.\naliases pi-claude-marketplace-demo-reviewer\nsystem prompt mode replace\ninherit project context true\ninherit skills true\nasync false\nsystem prompt:\nReview the files named in the task and report every problem you find. |

  Scenario: An agent does not preload a skill the model cannot invoke
    Given pi runs with the scripted model and these companions:
      | companion    |
      | pi-subagents |
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file "skills/hidden/SKILL.md" with this text:
      """
      ---
      name: hidden
      description: Explains the hidden rules.
      disable-model-invocation: true
      ---
      Follow the hidden rules.
      """
    Given the published plugin "demo" of the marketplace "fixtures" has these agents:
      | file        | name     | description                    | skills | body                                                                  |
      | reviewer.md | reviewer | Reviews the files it is given. | hidden | Review the files named in the task and report every problem you find. |
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply                           | tool     | arguments                                                           |
      |                                 | subagent | {"agent":"demo:reviewer","task":"Review the README.","async":false} |
      | The README has no problems.     |          |                                                                     |
      | The reviewer found no problems. |          |                                                                     |
    When the user prompts "Ask the reviewer to check the README."
    Then the agent's model call 2 runs on the body of the agent file "pi-claude-marketplace-demo-reviewer.md" of the user scope, which reads:
      """
      Review the files named in the task and report every problem you find.
      """
    Then the model receives these calls:
      | call | role        | text                                                                                   |
      | 1    | user        | Ask the reviewer to check the README.                                                  |
      | 2    | user        | task Review the README.                                                                |
      | 3    | user        | Ask the reviewer to check the README.                                                  |
      | 3    | assistant   | tool call subagent {"agent":"demo:reviewer","task":"Review the README.","async":false} |
      | 3    | tool result | subagent returned: The README has no problems.                                         |

  Scenario: Updating a plugin preloads the new version of its skill
    Given pi runs with the scripted model and these companions:
      | companion    |
      | pi-subagents |
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these agents:
      | file        | name     | description                    | skills     | body                                                                  |
      | reviewer.md | reviewer | Reviews the files it is given. | demo-skill | Review the files named in the task and report every problem you find. |
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.1.0   |
    Given the user has run "/claude:plugin update demo@fixtures --scope user"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply               | tool     | arguments                                |
      |                     | subagent | {"action":"get","agent":"demo:reviewer"} |
      | The agent is shown. |          |                                          |
    When the user prompts "Show the reviewer."
    Then the model receives these calls:
      | call | role        | text                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
      | 1    | user        | Show the reviewer.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
      | 2    | user        | Show the reviewer.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
      | 2    | assistant   | tool call subagent {"action":"get","agent":"demo:reviewer"}                                                                                                                                                                                                                                                                                                                                                                                                                                          |
      | 2    | tool result | subagent returned: agent demo:reviewer\npath {agent dir}/agents/pi-claude-marketplace-demo-reviewer.md\ndescription Reviews the files it is given.\naliases pi-claude-marketplace-demo-reviewer\nsystem prompt mode replace\ninherit project context true\ninherit skills true\nasync false\nsystem prompt:\nReview the files named in the task and report every problem you find.\n\nBase directory for this skill: {agent dir}/pi-claude-marketplace/resources/skills/demo-skill\n\nVersion 1.1.0. |

  Scenario: Apply reports an agent's preloaded skill that the model cannot invoke
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file "skills/hidden/SKILL.md" with this text:
      """
      ---
      name: hidden
      description: Explains the hidden rules.
      disable-model-invocation: true
      ---
      Follow the hidden rules.
      """
    Given the published plugin "demo" of the marketplace "fixtures" has these agents:
      | file        | name     | description                    | skills | body                                                                  |
      | reviewer.md | reviewer | Reviews the files it is given. | hidden | Review the files named in the task and report every problem you find. |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project", which warned
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.1.0   |
    When the user runs "/claude:plugin apply --scope project"
    Then the command reports these results:
      | kind                      | severity | needs reload | tally label | tally failures | tally warnings | tally success count | header                                              | lines                                                                                                                             |
      | reconcile-applied-cascade | info     | true         | Reconcile   | 0              | 0              | 1                   |                                                     |                                                                                                                                   |
      | diagnostic                | warning  | false        |             |                |                |                     | Plugin "demo" [project] updated; 1 staging warning. | [reviewer] skill reference "hidden" names a skill with disable-model-invocation: true -- not preloaded (Claude Code skips it too) |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status  | reasons               | scope   | from  | to    |
      | fixtures         | project           | demo@fixtures | demo | updated | requires pi-subagents | project | 1.0.0 | 1.1.0 |

  Scenario: A foreground run offers the child the tools its agent lists
    Given pi runs with the scripted model and these companions:
      | companion    |
      | pi-subagents |
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these agents:
      | file        | name     | description                    | tools      | body                                                                  |
      | reviewer.md | reviewer | Reviews the files it is given. | Read, Bash | Review the files named in the task and report every problem you find. |
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply                           | tool     | arguments                                                           |
      |                                 | subagent | {"agent":"demo:reviewer","task":"Review the README.","async":false} |
      | The README has no problems.     |          |                                                                     |
      | The reviewer found no problems. |          |                                                                     |
    When the user prompts "Ask the reviewer to check the README."
    Then the agent's model call 2 is offered these of the tools an agent can name:
      | tool |
      | read |
      | bash |

  Scenario: A run of an agent without a tools list offers the child the tools the session has
    Given pi runs with the scripted model and these companions:
      | companion    |
      | pi-subagents |
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these agents:
      | file        | name     | description                    | body                                                                  |
      | reviewer.md | reviewer | Reviews the files it is given. | Review the files named in the task and report every problem you find. |
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply                           | tool     | arguments                                                           |
      |                                 | subagent | {"agent":"demo:reviewer","task":"Review the README.","async":false} |
      | The README has no problems.     |          |                                                                     |
      | The reviewer found no problems. |          |                                                                     |
    When the user prompts "Ask the reviewer to check the README."
    Then the agent's model call 2 is offered the tools an agent can name that the model call 1 is offered

  Scenario: A same-name agent runs the body of the plugin that names it
    Given pi runs with the scripted model and these companions:
      | companion    |
      | pi-subagents |
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name  | version |
      | demo  | 1.0.0   |
      | tools | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these agents:
      | file        | name     | description                    | body                                                                  |
      | reviewer.md | reviewer | Reviews the files it is given. | Review the files named in the task and report every problem you find. |
    Given the published plugin "tools" of the marketplace "fixtures" has these agents:
      | file        | name     | description              | body                                                                   |
      | reviewer.md | reviewer | Reviews the tools build. | Check the build of the tools plugin and report every failure you find. |
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user has run "/claude:plugin install tools@fixtures --scope user"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply                           | tool     | arguments                                                            |
      |                                 | subagent | {"agent":"tools:reviewer","task":"Review the README.","async":false} |
      | The README has no problems.     |          |                                                                      |
      | The reviewer found no problems. |          |                                                                      |
    When the user prompts "Ask the reviewer to check the README."
    Then the agent's model call 2 runs on the body of the agent file "pi-claude-marketplace-tools-reviewer.md" of the user scope, which reads:
      """
      Check the build of the tools plugin and report every failure you find.
      """
    Then the model receives these calls:
      | call | role        | text                                                                                    |
      | 1    | user        | Ask the reviewer to check the README.                                                   |
      | 2    | user        | task Review the README.                                                                 |
      | 3    | user        | Ask the reviewer to check the README.                                                   |
      | 3    | assistant   | tool call subagent {"agent":"tools:reviewer","task":"Review the README.","async":false} |
      | 3    | tool result | subagent returned: The README has no problems.                                          |
