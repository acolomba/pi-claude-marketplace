Feature: Workflow agent restrictions

  An install, an update, or an info notes when a workflow runs a plugin agent that
  restricts its tools, because outside codemode the workflow engine does not keep the restriction
  (PG-SEC-01, a Pi capability gap). A scripted model and a local marketplace stand in for real ones.

  Background:
    Given pi runs with the scripted model and these companions:
      | companion            |
      | pi-subagents         |
      | pi-dynamic-workflows |
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |

  Scenario: Installing a plugin whose workflow runs a tool-restricted agent notes that the engine does not keep the restriction
    Given the published plugin "demo" of the marketplace "fixtures" has the file "agents/reader.md" with this text:
      """
      ---
      name: reader
      description: Reads files.
      tools: Read
      ---

      Read the files you are given.
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file "workflows/scan.js" with this text:
      """
      export const meta = {name:"scan",description:"Scans with the reader."};

      return await agent("Scan the files.", {agentType:"demo:reader"});
      """
    Given the marketplace "fixtures" is added to the user scope
    When the user runs "/claude:plugin install demo@fixtures --scope user"
    Then the command reports these results:
      | kind       | severity | needs reload | header                                                           | lines                                                                                                                                                                                                              |
      | cascade    | info     | true         |                                                                  |                                                                                                                                                                                                                    |
      | diagnostic | warning  | false        | Plugin "demo" [user] installed; 1 declared component has a note. | workflow script "scan.js" in "workflows" runs agent type "demo:reader", which restricts its tools; outside codemode the workflow engine does not keep that restriction, so the agent can use bash, edit, and write |
    Then the workflow install diagnostic reports these lines:
      | line                                                                                                                                                                                                               |
      | workflow script "scan.js" in "workflows" runs agent type "demo:reader", which restricts its tools; outside codemode the workflow engine does not keep that restriction, so the agent can use bash, edit, and write |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope | version |
      | fixtures         | user              | demo@fixtures | demo | installed |         | user  | 1.0.0   |

  Scenario: Updating a plugin to a version whose workflow runs a tool-restricted agent prints the note
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.1.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file "agents/reader.md" with this text:
      """
      ---
      name: reader
      description: Reads files.
      tools: Read
      ---

      Read the files you are given.
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file "workflows/scan.js" with this text:
      """
      export const meta = {name:"scan",description:"Scans with the reader."};

      return await agent("Scan the files.", {agentType:"demo:reader"});
      """
    When the user runs "/claude:plugin update demo@fixtures --scope user"
    Then the command reports these results:
      | kind       | severity | needs reload | header                                                         | lines                                                                                                                                                                                                              |
      | cascade    | info     | true         |                                                                |                                                                                                                                                                                                                    |
      | diagnostic | warning  | false        | Plugin "demo" [user] updated; 1 declared component has a note. | workflow script "scan.js" in "workflows" runs agent type "demo:reader", which restricts its tools; outside codemode the workflow engine does not keep that restriction, so the agent can use bash, edit, and write |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status  | reasons | scope | from  | to    |
      | fixtures         | user              | demo@fixtures | demo | updated |         | user  | 1.0.0 | 1.1.0 |

  Scenario: Info on a plugin whose workflow runs a tool-restricted agent shows the note
    Given the published plugin "demo" of the marketplace "fixtures" has the file "agents/reader.md" with this text:
      """
      ---
      name: reader
      description: Reads files.
      tools: Read
      ---

      Read the files you are given.
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file "workflows/scan.js" with this text:
      """
      export const meta = {name:"scan",description:"Scans with the reader."};

      return await agent("Scan the files.", {agentType:"demo:reader"});
      """
    Given the marketplace "fixtures" is added to the user scope
    When the user runs "/claude:plugin info demo@fixtures"
    Then the result has these fields:
      | kind                           | plugin-info                                                                                                                                                                                                        |
      | marketplace details autoupdate | false                                                                                                                                                                                                              |
      | marketplace name               | fixtures                                                                                                                                                                                                           |
      | marketplace scope              | user                                                                                                                                                                                                               |
      | needs reload                   | false                                                                                                                                                                                                              |
      | plugin components agents       | reader                                                                                                                                                                                                             |
      | plugin components resolved     | true                                                                                                                                                                                                               |
      | plugin components skills       | demo-skill                                                                                                                                                                                                         |
      | plugin components workflows    | demo:scan                                                                                                                                                                                                          |
      | plugin id                      | demo@fixtures                                                                                                                                                                                                      |
      | plugin name                    | demo                                                                                                                                                                                                               |
      | plugin notes                   | workflow script "scan.js" in "workflows" runs agent type "demo:reader", which restricts its tools; outside codemode the workflow engine does not keep that restriction, so the agent can use bash, edit, and write |
      | plugin reasons                 |                                                                                                                                                                                                                    |
      | plugin requires                | [{"companion":"pi-dynamic-workflows","missing":false},{"companion":"pi-subagents","missing":false}]                                                                                                                |
      | plugin status                  | available                                                                                                                                                                                                          |
      | plugin version                 | 1.0.0                                                                                                                                                                                                              |
      | severity                       | info                                                                                                                                                                                                               |

  Scenario: Installing a plugin whose workflow runs an agent that allows every Pi built-in tool gives no note
    Given the published plugin "demo" of the marketplace "fixtures" has the file "agents/editor.md" with this text:
      """
      ---
      name: editor
      description: Edits files.
      tools: Read, Bash, Edit, Write
      ---

      Edit the files you are given.
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file "workflows/scan.js" with this text:
      """
      export const meta = {name:"scan",description:"Scans with the editor."};

      return await agent("Scan the files.", {agentType:"demo:editor"});
      """
    Given the marketplace "fixtures" is added to the user scope
    When the user runs "/claude:plugin install demo@fixtures --scope user"
    Then the command reports these results:
      | kind    | severity | needs reload |
      | cascade | info     | true         |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope | version |
      | fixtures         | user              | demo@fixtures | demo | installed |         | user  | 1.0.0   |
