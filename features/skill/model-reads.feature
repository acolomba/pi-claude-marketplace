Feature: Skill model reads

  Protects what the model gets when it reads a bridged skill's file on its own with Pi's read tool:
  the skill's variables filled and its arguments empty, as a typed skill with no arguments has them,
  with no context command run, and what a PostToolUse hook on that read sees and changes. A local
  marketplace, a scripted model, and a hook that records each run stand in for published and real ones.

  Background:
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the skill "status" with this skill file:
      """
      ---
      name: status
      description: Reports the status.
      arguments: [target]
      ---

      Session ${CLAUDE_SESSION_ID} at effort ${CLAUDE_EFFORT}.
      Arguments [$ARGUMENTS], target [$target], first [$0].
      Status: !`printf ran`
      """

  Scenario: A skill file the model reads has its variables filled and its arguments empty
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply  | tool | arguments                                                                                |
      |        | read | {"path":"{project dir}/.pi/pi-claude-marketplace/resources/skills/demo-status/SKILL.md"} |
      | Noted. |      |                                                                                          |
    When the user prompts "Check the status."
    Then the model receives these calls:
      | call | role        | text                                                                                                                                                                                                                                                                                                                                                                                          |
      | 1    | user        | Check the status.                                                                                                                                                                                                                                                                                                                                                                             |
      | 2    | user        | Check the status.                                                                                                                                                                                                                                                                                                                                                                             |
      | 2    | assistant   | tool call read {"path":"{project dir}/.pi/pi-claude-marketplace/resources/skills/demo-status/SKILL.md"}                                                                                                                                                                                                                                                                                       |
      | 2    | tool result | read returned: ---\nname: demo-status\ndescription: Reports the status.\narguments: [target]\npi-claude-marketplace: {"names":["demo:status","status"],"pluginRoot":"{home}/marketplaces/fixtures/plugins/demo","pluginData":"{project dir}/.pi/pi-claude-marketplace/data/fixtures/demo"}\n---\n\nSession {uuid} at effort low.\nArguments [], target [], first [$0].\nStatus: !`printf ran` |

  Scenario: A part of a skill file the model reads keeps its frontmatter and fills its body lines
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply  | tool | arguments                                                                                                     |
      |        | read | {"path":"{project dir}/.pi/pi-claude-marketplace/resources/skills/demo-status/SKILL.md","offset":2,"limit":7} |
      | Noted. |      |                                                                                                               |
    When the user prompts "Check the status."
    Then the model receives these calls:
      | call | role        | text                                                                                                                                                                                                                                                                                                                                                                             |
      | 1    | user        | Check the status.                                                                                                                                                                                                                                                                                                                                                                |
      | 2    | user        | Check the status.                                                                                                                                                                                                                                                                                                                                                                |
      | 2    | assistant   | tool call read {"path":"{project dir}/.pi/pi-claude-marketplace/resources/skills/demo-status/SKILL.md","offset":2,"limit":7}                                                                                                                                                                                                                                                     |
      | 2    | tool result | read returned: name: demo-status\ndescription: Reports the status.\narguments: [target]\npi-claude-marketplace: {"names":["demo:status","status"],"pluginRoot":"{home}/marketplaces/fixtures/plugins/demo","pluginData":"{project dir}/.pi/pi-claude-marketplace/data/fixtures/demo"}\n---\n\nSession {uuid} at effort low.\n\n[2 more lines in file. Use offset=9 to continue.] |

  Scenario: A file the model reads that pi did not load as a skill stays as it is
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply  | tool | arguments                                                                   |
      |        | read | {"path":"{home}/marketplaces/fixtures/plugins/demo/skills/status/SKILL.md"} |
      | Noted. |      |                                                                             |
    When the user prompts "Check the status."
    Then the model receives these calls:
      | call | role        | text                                                                                                                                                                                                                                   |
      | 1    | user        | Check the status.                                                                                                                                                                                                                      |
      | 2    | user        | Check the status.                                                                                                                                                                                                                      |
      | 2    | assistant   | tool call read {"path":"{home}/marketplaces/fixtures/plugins/demo/skills/status/SKILL.md"}                                                                                                                                             |
      | 2    | tool result | read returned: ---\nname: status\ndescription: Reports the status.\narguments: [target]\n---\n\nSession ${CLAUDE_SESSION_ID} at effort ${CLAUDE_EFFORT}.\nArguments [$ARGUMENTS], target [$target], first [$0].\nStatus: !`printf ran` |

  Scenario: A read hook on a skill file sees the staged text while the model gets the filled text
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name    | event       | matcher |
      | observe | PostToolUse | Read    |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply  | tool | arguments                                                                                |
      |        | read | {"path":"{project dir}/.pi/pi-claude-marketplace/resources/skills/demo-status/SKILL.md"} |
      | Noted. |      |                                                                                          |
    When the user prompts "Check the status."
    Then the hooks record these runs:
      | event       | session | tool name | tool input                                                                               | tool response                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | cwd           | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT                        | CLAUDE_PLUGIN_DATA                                | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
      | PostToolUse | first   | Read      | {"path":"{project dir}/.pi/pi-claude-marketplace/resources/skills/demo-status/SKILL.md"} | [{"type":"text","text":"---\\nname: demo-status\\ndescription: Reports the status.\\narguments: [target]\\npi-claude-marketplace: {\\"names\\":[\\"demo:status\\",\\"status\\"],\\"pluginRoot\\":\\"{home}/marketplaces/fixtures/plugins/demo\\",\\"pluginData\\":\\"{project dir}/.pi/pi-claude-marketplace/data/fixtures/demo\\"}\\n---\\n\\nSession ${CLAUDE_SESSION_ID} at effort ${CLAUDE_EFFORT}.\\nArguments [$ARGUMENTS], target [$target], first [$0].\\nStatus: !`printf ran`"}] | {project dir} |                 | observe   | {project dir}      | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/demo | first                  | first             | 1          |
    Then the model receives these calls:
      | call | role        | text                                                                                                                                                                                                                                                                                                                                                                                          |
      | 1    | user        | Check the status.                                                                                                                                                                                                                                                                                                                                                                             |
      | 2    | user        | Check the status.                                                                                                                                                                                                                                                                                                                                                                             |
      | 2    | assistant   | tool call read {"path":"{project dir}/.pi/pi-claude-marketplace/resources/skills/demo-status/SKILL.md"}                                                                                                                                                                                                                                                                                       |
      | 2    | tool result | read returned: ---\nname: demo-status\ndescription: Reports the status.\narguments: [target]\npi-claude-marketplace: {"names":["demo:status","status"],"pluginRoot":"{home}/marketplaces/fixtures/plugins/demo","pluginData":"{project dir}/.pi/pi-claude-marketplace/data/fixtures/demo"}\n---\n\nSession {uuid} at effort low.\nArguments [], target [], first [$0].\nStatus: !`printf ran` |

  Scenario: A read hook's replacement of a skill file reaches the model as the hook wrote it, with no variable filled
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name    | event       | matcher | form   | output                                                                                                                                                                                                                                                                                         |
      | replace | PostToolUse | Read    | script | {"hookSpecificOutput":{"hookEventName":"PostToolUse","updatedToolOutput":{"content":[{"type":"text","text":"Head 1 at effort ${CLAUDE_EFFORT}.\\nHead 2.\\nHead 3.\\nHead 4.\\nHead 5.\\nHead 6 at effort ${CLAUDE_EFFORT}.\\nTail 7 at effort ${CLAUDE_EFFORT}, arguments [$ARGUMENTS]."}]}}} |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply  | tool | arguments                                                                                |
      |        | read | {"path":"{project dir}/.pi/pi-claude-marketplace/resources/skills/demo-status/SKILL.md"} |
      | Noted. |      |                                                                                          |
    When the user prompts "Check the status."
    Then the model receives these calls:
      | call | role        | text                                                                                                                                                                                  |
      | 1    | user        | Check the status.                                                                                                                                                                     |
      | 2    | user        | Check the status.                                                                                                                                                                     |
      | 2    | assistant   | tool call read {"path":"{project dir}/.pi/pi-claude-marketplace/resources/skills/demo-status/SKILL.md"}                                                                               |
      | 2    | tool result | read returned: Head 1 at effort ${CLAUDE_EFFORT}.\nHead 2.\nHead 3.\nHead 4.\nHead 5.\nHead 6 at effort ${CLAUDE_EFFORT}.\nTail 7 at effort ${CLAUDE_EFFORT}, arguments [$ARGUMENTS]. |
