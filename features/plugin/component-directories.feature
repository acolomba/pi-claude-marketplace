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
