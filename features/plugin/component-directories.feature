Feature: Plugin component directories

  A plugin can declare where each kind of component lives. As in Claude Code, a
  declared path replaces the conventional folder for commands, agents, and
  workflows, and adds to the skills folder. A local marketplace stands in for a published one.

  Scenario: A declared commands path replaces the commands folder
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".claude-plugin/plugin.json" with this text:
      """
      { "name": "demo", "version": "1.0.0", "commands": "./custom-commands" }
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file "custom-commands/hello.md" with this text:
      """
      ---
      description: Says hello.
      ---

      Say hello.
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file "commands/old.md" with this text:
      """
      ---
      description: An old command.
      ---

      Do the old thing.
      """
    Given the marketplace "fixtures" is added to the project scope
    When the user runs "/claude:plugin info demo@fixtures"
    Then the result has these fields:
      | kind                           | plugin-info   |
      | marketplace details autoupdate | false         |
      | marketplace name               | fixtures      |
      | marketplace scope              | project       |
      | needs reload                   | false         |
      | plugin components commands     | hello         |
      | plugin components resolved     | true          |
      | plugin components skills       | demo-skill    |
      | plugin id                      | demo@fixtures |
      | plugin name                    | demo          |
      | plugin reasons                 |               |
      | plugin status                  | available     |
      | plugin version                 | 1.0.0         |
      | severity                       | info          |

  Scenario: A declared skills path adds to the skills folder
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".claude-plugin/plugin.json" with this text:
      """
      { "name": "demo", "version": "1.0.0", "skills": "./extra-skills" }
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file "extra-skills/extra/SKILL.md" with this text:
      """
      ---
      name: extra
      description: An extra skill.
      ---

      Extra.
      """
    Given the marketplace "fixtures" is added to the project scope
    When the user runs "/claude:plugin info demo@fixtures"
    Then the result has these fields:
      | kind                           | plugin-info       |
      | marketplace details autoupdate | false             |
      | marketplace name               | fixtures          |
      | marketplace scope              | project           |
      | needs reload                   | false             |
      | plugin components resolved     | true              |
      | plugin components skills       | demo-skill, extra |
      | plugin id                      | demo@fixtures     |
      | plugin name                    | demo              |
      | plugin reasons                 |                   |
      | plugin status                  | available         |
      | plugin version                 | 1.0.0             |
      | severity                       | info              |

  Scenario: A declared agents path replaces the agents folder
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
      { "name": "demo", "version": "1.0.0", "agents": "./custom-agents" }
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file "custom-agents/new.md" with this text:
      """
      ---
      name: new
      description: The new agent.
      ---

      Do the new thing.
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file "agents/old.md" with this text:
      """
      ---
      name: old
      description: The old agent.
      ---

      Do the old thing.
      """
    Given the marketplace "fixtures" is added to the user scope
    Given the scripted model plays these steps:
      | reply                | tool     | arguments         |
      |                      | subagent | {"action":"list"} |
      | One agent is listed. |          |                   |
    When the user runs "/claude:plugin install demo@fixtures --scope user"
    Then the command reports these results:
      | kind       | severity | needs reload | header                                                           | lines                                                                |
      | cascade    | info     | true         |                                                                  |                                                                      |
      | diagnostic | warning  | false        | Plugin "demo" [user] installed; 1 declared component has a note. | Default agents/ folder is ignored because the manifest sets "agents" |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope | version |
      | fixtures         | user              | demo@fixtures | demo | installed |         | user  | 1.0.0   |
    When the user starts a new pi session
    When the user prompts "List the agents."
    Then the model receives these calls:
      | call | role        | text                                                                                      |
      | 1    | user        | List the agents.                                                                          |
      | 2    | user        | List the agents.                                                                          |
      | 2    | assistant   | tool call subagent {"action":"list"}                                                      |
      | 2    | tool result | subagent returned: agent demo:new, aliases pi-claude-marketplace-demo-new: The new agent. |

  Scenario: A declared workflows path replaces the workflows folder
    Given pi runs with the scripted model and these companions:
      | companion            |
      | pi-dynamic-workflows |
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".claude-plugin/plugin.json" with this text:
      """
      { "name": "demo", "version": "1.0.0", "workflows": "./custom-workflows" }
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file "custom-workflows/new.js" with this text:
      """
      export const meta = {name:"new",description:"The new workflow."};

      return "New.";
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file "workflows/old.js" with this text:
      """
      export const meta = {name:"old",description:"The old workflow."};

      return "Old.";
      """
    Given the marketplace "fixtures" is added to the user scope
    When the user runs "/claude:plugin install demo@fixtures --scope user"
    Then the command reports these results:
      | kind       | severity | needs reload | header                                                           | lines                                                                      |
      | cascade    | info     | true         |                                                                  |                                                                            |
      | diagnostic | warning  | false        | Plugin "demo" [user] installed; 1 declared component has a note. | Default workflows/ folder is ignored because the manifest sets "workflows" |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope | version |
      | fixtures         | user              | demo@fixtures | demo | installed |         | user  | 1.0.0   |
    When the user starts a new pi session
    When the user lists the slash commands pi offers
    Then pi offers these workflow commands:
      | command   | description       |
      | /demo:new | The new workflow. |
