Feature: Workflow references

  Protects how a plugin's commands and skills name its workflows: a name written without
  a slash stays the saved name the workflow engine loads, and a name written with one stays
  a command (D-PG4-08). A scripted model and a local marketplace stand in.

  Background:
    Given pi runs with the scripted model and these companions:
      | companion            |
      | pi-dynamic-workflows |
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |

  Scenario: A command that names its workflow in a tool call reaches the model with the name the engine loads
    Given the published plugin "demo" of the marketplace "fixtures" has the workflow "scan" described as "Scans the project." that returns "Scan done."
    Given the published plugin "demo" of the marketplace "fixtures" has the slash command "start" described as "Starts the scan." with this body:
      """
      Call Workflow({ name: "demo:scan" }) now. Slash form: /demo:scan.
      """
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply  |
      | Noted. |
    When the user prompts "/demo:start"
    Then the model receives these calls:
      | call | role | text                                                              |
      | 1    | user | Call Workflow({ name: "demo:scan" }) now. Slash form: /demo:scan. |

  Scenario: A skill that names its workflow keeps the name without a slash in its staged files
    Given the published plugin "demo" of the marketplace "fixtures" has the workflow "scan" described as "Scans the project." that returns "Scan done."
    Given the published plugin "demo" of the marketplace "fixtures" has the skill "scanner" with this skill file:
      """
      ---
      name: scanner
      description: Runs the scan.
      allowed-tools: Workflow(demo:scan)
      ---

      Start demo:scan, or type /demo:scan.
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file "skills/scanner/jobs/start.md" with this text:
      """
      Call Workflow({ name: "demo:scan" }) now.
      """
    Given the marketplace "fixtures" is added to the user scope
    When the user runs "/claude:plugin install demo@fixtures --scope user"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope | version |
      | fixtures         | user              | demo@fixtures | demo | installed |         | user  | 1.0.0   |
    Then the staged skills directory of the user scope holds these files:
      | file                       | text                                                                                                                                                                                                                                                                                                                            |
      | demo-scanner/              |                                                                                                                                                                                                                                                                                                                                 |
      | demo-scanner/jobs/         |                                                                                                                                                                                                                                                                                                                                 |
      | demo-scanner/jobs/start.md | Call Workflow({ name: "demo:scan" }) now.                                                                                                                                                                                                                                                                                       |
      | demo-scanner/SKILL.md      | ---\nname: demo-scanner\ndescription: Runs the scan.\nallowed-tools: Workflow(demo:scan)\npi-claude-marketplace: {"names":["demo:scanner","scanner"],"pluginRoot":"{home}/marketplaces/fixtures/plugins/demo","pluginData":"{agent dir}/pi-claude-marketplace/data/fixtures/demo"}\n---\n\nStart demo:scan, or type /demo:scan. |
      | demo-skill/                |                                                                                                                                                                                                                                                                                                                                 |
      | demo-skill/SKILL.md        | ---\nname: demo-skill\ndescription: A skill of demo 1.0.0.\npi-claude-marketplace: {"names":["demo:demo-skill","demo-skill"],"pluginRoot":"{home}/marketplaces/fixtures/plugins/demo","pluginData":"{agent dir}/pi-claude-marketplace/data/fixtures/demo"}\n---\n\nVersion 1.0.0.\n                                             |
