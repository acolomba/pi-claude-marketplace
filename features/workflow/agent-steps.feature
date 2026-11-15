Feature: Workflow agent steps

  An agent step of a workflow runs with the plugin agent its agentType names, returns the
  object its schema asks for, and runs in a git worktree of the project when it asks for
  isolation. A scripted model and a local marketplace stand in.

  Background:
    Given pi runs with the scripted model and these companions:
      | companion            |
      | pi-subagents         |
      | pi-dynamic-workflows |
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |

  Scenario: A workflow step on a plugin agent whose source model is inherit runs on the session's model
    Given the published plugin "demo" of the marketplace "fixtures" has these agents:
      | file      | name   | description       | model   | body             |
      | helper.md | helper | Answers the task. | inherit | Answer the task. |
    Given the published plugin "demo" of the marketplace "fixtures" has the file "workflows/ask.js" with this text:
      """
      export const meta = {name:"ask",description:"Asks the helper."};

      return await agent("Answer the task.", {agentType:"demo:helper"});
      """
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply       | tool | arguments |
      | The answer. |      |           |
    When the user runs the workflow command "/demo:ask", whose agent steps the model answers
    Then the workflow run ends with the status "completed" and the result "The answer."
    Then the workflow engine shows these notices:
      | notice            |
      | started /demo:ask |

  Scenario: A workflow step on a plugin agent whose quoted description holds a colon runs on the agent's body
    Given the published plugin "demo" of the marketplace "fixtures" has the file "agents/reader.md" with this text:
      """
      ---
      name: reader
      description: "Reviews: code."
      ---

      Read the files you are given.
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file "workflows/scan.js" with this text:
      """
      export const meta = {name:"scan",description:"Scans with the reader."};

      return await agent("Scan the files.", {agentType:"demo:reader"});
      """
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply           | tool | arguments |
      | The files pass. |      |           |
    When the user runs the workflow command "/demo:scan", whose agent steps the model answers
    Then the workflow run ends with the status "completed" and the result "The files pass."
    Then the model receives these calls:
      | call | role | text                                                                    |
      | 1    | user | Read the files you are given.\n\nTask label: agent 1\n\nScan the files. |

  Scenario: A workflow step on a plugin agent whose tools list holds a stray quote runs on the agent's body
    Given the published plugin "demo" of the marketplace "fixtures" has the file "agents/reader.md" with this text:
      """
      ---
      name: reader
      description: Reviews code.
      tools: Read, 'Bash
      ---

      Read the files you are given.
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file "workflows/scan.js" with this text:
      """
      export const meta = {name:"scan",description:"Scans with the reader."};

      return await agent("Scan the files.", {agentType:"demo:reader"});
      """
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply           | tool | arguments |
      | The files pass. |      |           |
    When the user runs the workflow command "/demo:scan", whose agent steps the model answers
    Then the workflow run ends with the status "completed" and the result "The files pass."
    Then the model receives these calls:
      | call | role | text                                                                    |
      | 1    | user | Read the files you are given.\n\nTask label: agent 1\n\nScan the files. |

  Scenario: A workflow step that asks for worktree isolation runs in a git worktree of the project, which the engine keeps where Claude Code removes an unchanged one
    Given the project is a git repository with one commit
    Given the published plugin "demo" of the marketplace "fixtures" has the file "workflows/iso.js" with this text:
      """
      export const meta = {name:"iso",description:"Checks a worktree step."};

      const first = await agent("Check the folder.", {isolation:"worktree"});
      const second = await agent("Count the worktrees.");
      return first + " " + second;
      """
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply    | tool | arguments                                                                                                                                    |
      |          | bash | {"command": "if [ $(git rev-parse --git-dir) = $(git rev-parse --git-common-dir) ]; then echo main worktree; else echo linked worktree; fi"} |
      | Checked. |      |                                                                                                                                              |
      |          | bash | {"command": "echo worktrees $(git worktree list \| wc -l) branches $(git branch \| wc -l)"}                                                  |
      | Counted. |      |                                                                                                                                              |
    When the user runs the workflow command "/demo:iso", whose agent steps the model answers
    Then the workflow run ends with the status "completed" and the result "Checked. Counted."
    Then the model receives these calls:
      | call | role        | text                                                                                                                                                       |
      | 1    | user        | Requested isolation: worktree\n\nTask label: agent 1\n\nCheck the folder.                                                                                  |
      | 2    | user        | Requested isolation: worktree\n\nTask label: agent 1\n\nCheck the folder.                                                                                  |
      | 2    | assistant   | tool call bash {"command":"if [ $(git rev-parse --git-dir) = $(git rev-parse --git-common-dir) ]; then echo main worktree; else echo linked worktree; fi"} |
      | 2    | tool result | bash returned: linked worktree\n                                                                                                                           |
      | 3    | user        | Task label: agent 2\n\nCount the worktrees.                                                                                                                |
      | 4    | user        | Task label: agent 2\n\nCount the worktrees.                                                                                                                |
      | 4    | assistant   | tool call bash {"command":"echo worktrees $(git worktree list \| wc -l) branches $(git branch \| wc -l)"}                                                  |
      | 4    | tool result | bash returned: worktrees 2 branches 2\n                                                                                                                    |
