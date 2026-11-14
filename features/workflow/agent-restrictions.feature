Feature: Workflow agent restrictions

  An install notes when a workflow runs a plugin agent that restricts its tools, because
  the workflow engine does not keep the restriction (PG-SEC-01, a Pi capability gap). A
  scripted model and a local marketplace stand in for real ones.

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
      | kind       | severity | needs reload | header                                                           | lines                                                                                                                                                                                                   |
      | cascade    | info     | true         |                                                                  |                                                                                                                                                                                                         |
      | diagnostic | warning  | false        | Plugin "demo" [user] installed; 1 declared component has a note. | workflow script "scan.js" in "workflows" runs agent type "demo:reader", which restricts its tools; the workflow engine does not keep that restriction, so the agent can use read, bash, edit, and write |
    Then the workflow install diagnostic reports these lines:
      | line                                                                                                                                                                                                    |
      | workflow script "scan.js" in "workflows" runs agent type "demo:reader", which restricts its tools; the workflow engine does not keep that restriction, so the agent can use read, bash, edit, and write |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope | version |
      | fixtures         | user              | demo@fixtures | demo | installed |         | user  | 1.0.0   |
