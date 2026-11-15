Feature: Workflow agent types

  A workflow step that names an agent type of its plugin runs that agent. An install, an update, or
  an info notes a type the plugin does not install, because the workflow engine runs a default
  agent in its place where Claude Code fails the step (PG-WF-02, a Pi capability gap). A scripted
  model and a local marketplace stand in for real ones.

  Background:
    Given pi runs with the scripted model and these companions:
      | companion            |
      | pi-subagents         |
      | pi-dynamic-workflows |
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |

  Scenario: Installing a plugin whose workflow names agent types the plugin does not install notes each one and still installs
    Given the published plugin "demo" of the marketplace "fixtures" has the file "agents/helper.md" with this text:
      """
      ---
      name: helper
      description: Answers the task.
      ---

      Answer the task.
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file "workflows/scan.js" with this text:
      """
      export const meta = {name:"scan",description:"Scans with three agents."};

      await agent("Answer the task.", {agentType:"demo:helper"});
      await agent("Look for ghosts.", {agentType:"demo:ghost"});
      return await agent("Look for phantoms.", {agentType:"demo:phantom"});
      """
    Given the marketplace "fixtures" is added to the user scope
    When the user runs "/claude:plugin install demo@fixtures --scope user"
    Then the command reports these results:
      | kind       | severity | needs reload | header                                                            | lines                                                                                                                                                                                                                                                                                                                                                                                                    |
      | cascade    | info     | true         |                                                                   |                                                                                                                                                                                                                                                                                                                                                                                                          |
      | diagnostic | warning  | false        | Plugin "demo" [user] installed; 2 declared components have notes. | workflow script "scan.js" in "workflows" runs agent type "demo:ghost", which this plugin does not install; the workflow engine runs a default agent in its place, where Claude Code fails the step, workflow script "scan.js" in "workflows" runs agent type "demo:phantom", which this plugin does not install; the workflow engine runs a default agent in its place, where Claude Code fails the step |
    Then the workflow install diagnostic reports these lines:
      | line                                                                                                                                                                                                 |
      | workflow script "scan.js" in "workflows" runs agent type "demo:ghost", which this plugin does not install; the workflow engine runs a default agent in its place, where Claude Code fails the step   |
      | workflow script "scan.js" in "workflows" runs agent type "demo:phantom", which this plugin does not install; the workflow engine runs a default agent in its place, where Claude Code fails the step |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope | version |
      | fixtures         | user              | demo@fixtures | demo | installed |         | user  | 1.0.0   |

  Scenario: Updating a plugin to a version whose workflow names an agent type the plugin does not install prints the note
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.1.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file "workflows/scan.js" with this text:
      """
      export const meta = {name:"scan",description:"Scans with a ghost."};

      return await agent("Look for ghosts.", {agentType:"demo:ghost"});
      """
    When the user runs "/claude:plugin update demo@fixtures --scope user"
    Then the command reports these results:
      | kind       | severity | needs reload | header                                                         | lines                                                                                                                                                                                              |
      | cascade    | info     | true         |                                                                |                                                                                                                                                                                                    |
      | diagnostic | warning  | false        | Plugin "demo" [user] updated; 1 declared component has a note. | workflow script "scan.js" in "workflows" runs agent type "demo:ghost", which this plugin does not install; the workflow engine runs a default agent in its place, where Claude Code fails the step |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status  | reasons | scope | from  | to    |
      | fixtures         | user              | demo@fixtures | demo | updated |         | user  | 1.0.0 | 1.1.0 |

  Scenario: Info on a plugin whose workflow names an agent type the plugin does not install shows the note
    Given the published plugin "demo" of the marketplace "fixtures" has the file "agents/helper.md" with this text:
      """
      ---
      name: helper
      description: Answers the task.
      ---

      Answer the task.
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file "workflows/scan.js" with this text:
      """
      export const meta = {name:"scan",description:"Scans with a ghost."};

      return await agent("Look for ghosts.", {agentType:"demo:ghost"});
      """
    Given the marketplace "fixtures" is added to the user scope
    When the user runs "/claude:plugin info demo@fixtures"
    Then the result has these fields:
      | kind                           | plugin-info                                                                                                                                                                                        |
      | marketplace details autoupdate | false                                                                                                                                                                                              |
      | marketplace name               | fixtures                                                                                                                                                                                           |
      | marketplace scope              | user                                                                                                                                                                                               |
      | needs reload                   | false                                                                                                                                                                                              |
      | plugin components agents       | helper                                                                                                                                                                                             |
      | plugin components resolved     | true                                                                                                                                                                                               |
      | plugin components skills       | demo-skill                                                                                                                                                                                         |
      | plugin components workflows    | demo:scan                                                                                                                                                                                          |
      | plugin id                      | demo@fixtures                                                                                                                                                                                      |
      | plugin name                    | demo                                                                                                                                                                                               |
      | plugin notes                   | workflow script "scan.js" in "workflows" runs agent type "demo:ghost", which this plugin does not install; the workflow engine runs a default agent in its place, where Claude Code fails the step |
      | plugin reasons                 |                                                                                                                                                                                                    |
      | plugin requires                | [{"companion":"pi-dynamic-workflows","missing":false},{"companion":"pi-subagents","missing":false}]                                                                                                |
      | plugin status                  | available                                                                                                                                                                                          |
      | plugin version                 | 1.0.0                                                                                                                                                                                              |
      | severity                       | info                                                                                                                                                                                               |

  Scenario: Installing a plugin whose workflow names only agents it installs and agents outside its namespace gives no note
    Given the published plugin "demo" of the marketplace "fixtures" has the file "agents/helper.md" with this text:
      """
      ---
      name: helper
      description: Answers the task.
      ---

      Answer the task.
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file "workflows/scan.js" with this text:
      """
      export const meta = {name:"scan",description:"Scans with three agents."};

      await agent("Answer the task.", {agentType:"demo:helper"});
      await agent("Explore the files.", {agentType:"general-purpose"});
      return await agent("Review the files.", {agentType:"other:reviewer"});
      """
    Given the marketplace "fixtures" is added to the user scope
    When the user runs "/claude:plugin install demo@fixtures --scope user"
    Then the command reports these results:
      | kind    | severity | needs reload |
      | cascade | info     | true         |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope | version |
      | fixtures         | user              | demo@fixtures | demo | installed |         | user  | 1.0.0   |

  Scenario: Installing a plugin whose workflow names a restricted agent by its generated file name gives no restriction note, as the engine never binds that name
    Given the published plugin "demo" of the marketplace "fixtures" has the file "agents/reader.md" with this text:
      """
      ---
      name: reader
      description: Reads the files.
      tools: Read
      ---

      Read the files.
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file "workflows/scan.js" with this text:
      """
      export const meta = {name:"scan",description:"Scans with a file name."};

      return await agent("Read the files.", {agentType:"pi-claude-marketplace-demo-reader"});
      """
    Given the marketplace "fixtures" is added to the user scope
    When the user runs "/claude:plugin install demo@fixtures --scope user"
    Then the command reports these results:
      | kind    | severity | needs reload |
      | cascade | info     | true         |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope | version |
      | fixtures         | user              | demo@fixtures | demo | installed |         | user  | 1.0.0   |

  Scenario: Installing a plugin whose workflow names seven agent types the plugin does not install notes five and counts the rest
    Given the published plugin "demo" of the marketplace "fixtures" has the file "workflows/scan.js" with this text:
      """
      export const meta = {name:"scan",description:"Scans with seven missing agents."};

      await agent("Look for one.", {agentType:"demo:one"});
      await agent("Look for two.", {agentType:"demo:two"});
      await agent("Look for three.", {agentType:"demo:three"});
      await agent("Look for four.", {agentType:"demo:four"});
      await agent("Look for five.", {agentType:"demo:five"});
      await agent("Look for six.", {agentType:"demo:six"});
      return await agent("Look for seven.", {agentType:"demo:seven"});
      """
    Given the marketplace "fixtures" is added to the user scope
    When the user runs "/claude:plugin install demo@fixtures --scope user"
    Then the command reports these results:
      | kind       | severity | needs reload | header                                                            | lines                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
      | cascade    | info     | true         |                                                                   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
      | diagnostic | warning  | false        | Plugin "demo" [user] installed; 6 declared components have notes. | workflow script "scan.js" in "workflows" runs agent type "demo:one", which this plugin does not install; the workflow engine runs a default agent in its place, where Claude Code fails the step, workflow script "scan.js" in "workflows" runs agent type "demo:two", which this plugin does not install; the workflow engine runs a default agent in its place, where Claude Code fails the step, workflow script "scan.js" in "workflows" runs agent type "demo:three", which this plugin does not install; the workflow engine runs a default agent in its place, where Claude Code fails the step, workflow script "scan.js" in "workflows" runs agent type "demo:four", which this plugin does not install; the workflow engine runs a default agent in its place, where Claude Code fails the step, workflow script "scan.js" in "workflows" runs agent type "demo:five", which this plugin does not install; the workflow engine runs a default agent in its place, where Claude Code fails the step, workflow script "scan.js" in "workflows" runs 2 more agent types that this plugin does not install |
    Then the workflow install diagnostic reports these lines:
      | line                                                                                                                                                                                               |
      | workflow script "scan.js" in "workflows" runs agent type "demo:one", which this plugin does not install; the workflow engine runs a default agent in its place, where Claude Code fails the step   |
      | workflow script "scan.js" in "workflows" runs agent type "demo:two", which this plugin does not install; the workflow engine runs a default agent in its place, where Claude Code fails the step   |
      | workflow script "scan.js" in "workflows" runs agent type "demo:three", which this plugin does not install; the workflow engine runs a default agent in its place, where Claude Code fails the step |
      | workflow script "scan.js" in "workflows" runs agent type "demo:four", which this plugin does not install; the workflow engine runs a default agent in its place, where Claude Code fails the step  |
      | workflow script "scan.js" in "workflows" runs agent type "demo:five", which this plugin does not install; the workflow engine runs a default agent in its place, where Claude Code fails the step  |
      | workflow script "scan.js" in "workflows" runs 2 more agent types that this plugin does not install                                                                                                 |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope | version |
      | fixtures         | user              | demo@fixtures | demo | installed |         | user  | 1.0.0   |

  Scenario: Installing a plugin whose workflow names only an agent type too long to print says why it is counted and what the engine does
    Given the published plugin "demo" of the marketplace "fixtures" has the file "workflows/scan.js" with this text:
      """
      export const meta = {name:"scan",description:"Scans with one long missing agent."};

      return await agent("Look for it.", {agentType:"demo:gggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggg"});
      """
    Given the marketplace "fixtures" is added to the user scope
    When the user runs "/claude:plugin install demo@fixtures --scope user"
    Then the workflow install diagnostic reports these lines:
      | line                                                                                                                                                                                                             |
      | workflow script "scan.js" in "workflows" runs 1 agent type longer than 128 characters that this plugin does not install; the workflow engine runs a default agent in its place, where Claude Code fails the step |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope | version |
      | fixtures         | user              | demo@fixtures | demo | installed |         | user  | 1.0.0   |

  Scenario: A workflow step that names an agent of its plugin runs on that agent's instructions
    Given the published plugin "demo" of the marketplace "fixtures" has the file "agents/helper.md" with this text:
      """
      ---
      name: helper
      description: Answers the task.
      ---

      Speak as the helper of demo.
      """
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
    Then the model receives these calls:
      | call | role | text                                                                    |
      | 1    | user | Speak as the helper of demo.\n\nTask label: agent 1\n\nAnswer the task. |

  Scenario: A workflow step that names an agent type the plugin does not install still runs, where Claude Code fails the step
    Given the published plugin "demo" of the marketplace "fixtures" has the file "agents/helper.md" with this text:
      """
      ---
      name: helper
      description: Answers the task.
      ---

      Speak as the helper of demo.
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file "workflows/ask.js" with this text:
      """
      export const meta = {name:"ask",description:"Asks a ghost."};

      return await agent("Answer the task.", {agentType:"demo:ghost"});
      """
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply       | tool | arguments |
      | The answer. |      |           |
    When the user runs the workflow command "/demo:ask", whose agent steps the model answers
    Then the workflow run ends with the status "completed" and the result "The answer."
    Then the workflow engine shows these notices:
      | notice            |
      | started /demo:ask |
