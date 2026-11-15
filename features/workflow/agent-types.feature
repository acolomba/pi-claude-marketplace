Feature: Workflow agent types

  A workflow step that names an agent type of its plugin runs that agent. An install, an update, or
  an info notes a type the plugin does not install, because the workflow engine runs a default
  agent in its place where Claude Code stops the run (PG-WF-02, a Pi capability gap). A scripted
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
      | kind       | severity | needs reload | header                                                            | lines                                                                                                                                                                                                                                                                                                                                                                                                  |
      | cascade    | info     | true         |                                                                   |                                                                                                                                                                                                                                                                                                                                                                                                        |
      | diagnostic | warning  | false        | Plugin "demo" [user] installed; 2 declared components have notes. | workflow script "scan.js" in "workflows" runs agent type "demo:ghost", which this plugin does not install; the workflow engine runs a default agent in its place, where Claude Code stops the run, workflow script "scan.js" in "workflows" runs agent type "demo:phantom", which this plugin does not install; the workflow engine runs a default agent in its place, where Claude Code stops the run |
    Then the workflow install diagnostic reports these lines:
      | line                                                                                                                                                                                                |
      | workflow script "scan.js" in "workflows" runs agent type "demo:ghost", which this plugin does not install; the workflow engine runs a default agent in its place, where Claude Code stops the run   |
      | workflow script "scan.js" in "workflows" runs agent type "demo:phantom", which this plugin does not install; the workflow engine runs a default agent in its place, where Claude Code stops the run |
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
      | kind       | severity | needs reload | header                                                         | lines                                                                                                                                                                                             |
      | cascade    | info     | true         |                                                                |                                                                                                                                                                                                   |
      | diagnostic | warning  | false        | Plugin "demo" [user] updated; 1 declared component has a note. | workflow script "scan.js" in "workflows" runs agent type "demo:ghost", which this plugin does not install; the workflow engine runs a default agent in its place, where Claude Code stops the run |
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
      | kind                           | plugin-info                                                                                                                                                                                       |
      | marketplace details autoupdate | false                                                                                                                                                                                             |
      | marketplace name               | fixtures                                                                                                                                                                                          |
      | marketplace scope              | user                                                                                                                                                                                              |
      | needs reload                   | false                                                                                                                                                                                             |
      | plugin components agents       | helper                                                                                                                                                                                            |
      | plugin components resolved     | true                                                                                                                                                                                              |
      | plugin components skills       | demo-skill                                                                                                                                                                                        |
      | plugin components workflows    | demo:scan                                                                                                                                                                                         |
      | plugin id                      | demo@fixtures                                                                                                                                                                                     |
      | plugin name                    | demo                                                                                                                                                                                              |
      | plugin notes                   | workflow script "scan.js" in "workflows" runs agent type "demo:ghost", which this plugin does not install; the workflow engine runs a default agent in its place, where Claude Code stops the run |
      | plugin reasons                 |                                                                                                                                                                                                   |
      | plugin requires                | [{"companion":"pi-dynamic-workflows","missing":false},{"companion":"pi-subagents","missing":false}]                                                                                               |
      | plugin status                  | available                                                                                                                                                                                         |
      | plugin version                 | 1.0.0                                                                                                                                                                                             |
      | severity                       | info                                                                                                                                                                                              |
