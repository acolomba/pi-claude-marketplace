Feature: Skill sibling links

  Protects relative links between the skills of one plugin: a link from a staged skill to a
  sibling skill reaches the folder the sibling is staged in. A local marketplace stands in for a
  published one, and a scripted model for a real one.

  Scenario: A link from a skill to a file of a sibling skill reaches the model as a path that holds the file
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the skill "a" described as "Skill a." with this body:
      """
      See ../b/ref.md.
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the skill "b" described as "Skill b." with this body:
      """
      Skill b body.
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file "skills/b/ref.md" with this text:
      """
      The reference of skill b.
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply  | tool | arguments                                                                                   |
      |        | read | {"path":"{project dir}/.pi/pi-claude-marketplace/resources/skills/demo-a/../demo-b/ref.md"} |
      | Noted. |      |                                                                                             |
    When the user prompts "/demo:a"
    Then the model receives these calls:
      | call | role        | text                                                                                                                                                                                                                                      |
      | 1    | user        | <skill name="demo-a" location="{project dir}/.pi/pi-claude-marketplace/resources/skills/demo-a/SKILL.md">\nReferences are relative to {project dir}/.pi/pi-claude-marketplace/resources/skills/demo-a.\n\nSee ../demo-b/ref.md.\n</skill> |
      | 2    | user        | <skill name="demo-a" location="{project dir}/.pi/pi-claude-marketplace/resources/skills/demo-a/SKILL.md">\nReferences are relative to {project dir}/.pi/pi-claude-marketplace/resources/skills/demo-a.\n\nSee ../demo-b/ref.md.\n</skill> |
      | 2    | assistant   | tool call read {"path":"{project dir}/.pi/pi-claude-marketplace/resources/skills/demo-a/../demo-b/ref.md"}                                                                                                                                |
      | 2    | tool result | read returned: The reference of skill b.                                                                                                                                                                                                  |

  Scenario: Supporting markdown in a subfolder links to a sibling skill through the staged folder of the sibling
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the skill "a" described as "Skill a." with this body:
      """
      Skill a body.
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the skill "b" described as "Skill b." with this body:
      """
      Skill b body.
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file "skills/b/ref.md" with this text:
      """
      The reference of skill b.
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file "skills/a/references/deep.md" with this text:
      """
      Read [the reference](../../b/ref.md).
      The folder `../../b/` holds it.
      ```text
      cat ../../b/ref.md
      ```
      Back to [the skill](../SKILL.md).
      See ../../../README.md for the plugin.
      """
    Given the marketplace "fixtures" is added to the project scope
    When the user runs "/claude:plugin install demo@fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | installed |         | project | 1.0.0   |
    Then the staged skills directory of the project scope holds these files:
      | file                      | text                                                                                                                                                                                                                                                                                      |
      | demo-a/                   |                                                                                                                                                                                                                                                                                           |
      | demo-a/references/        |                                                                                                                                                                                                                                                                                           |
      | demo-a/references/deep.md | Read [the reference](../../demo-b/ref.md).\nThe folder `../../demo-b/` holds it.\n```text\ncat ../../demo-b/ref.md\n```\nBack to [the skill](../SKILL.md).\nSee ../../../README.md for the plugin.                                                                                        |
      | demo-a/SKILL.md           | ---\nname: demo-a\ndescription: Skill a.\npi-claude-marketplace: {"names":["demo:a","a"],"pluginRoot":"{home}/marketplaces/fixtures/plugins/demo","pluginData":"{project dir}/.pi/pi-claude-marketplace/data/fixtures/demo"}\n---\n\nSkill a body.\n                                      |
      | demo-b/                   |                                                                                                                                                                                                                                                                                           |
      | demo-b/ref.md             | The reference of skill b.                                                                                                                                                                                                                                                                 |
      | demo-b/SKILL.md           | ---\nname: demo-b\ndescription: Skill b.\npi-claude-marketplace: {"names":["demo:b","b"],"pluginRoot":"{home}/marketplaces/fixtures/plugins/demo","pluginData":"{project dir}/.pi/pi-claude-marketplace/data/fixtures/demo"}\n---\n\nSkill b body.\n                                      |
      | demo-skill/               |                                                                                                                                                                                                                                                                                           |
      | demo-skill/SKILL.md       | ---\nname: demo-skill\ndescription: A skill of demo 1.0.0.\npi-claude-marketplace: {"names":["demo:demo-skill","demo-skill"],"pluginRoot":"{home}/marketplaces/fixtures/plugins/demo","pluginData":"{project dir}/.pi/pi-claude-marketplace/data/fixtures/demo"}\n---\n\nVersion 1.0.0.\n |

  Scenario: A root-source plugin keeps a link to a skill its entry does not list as written
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" has the file "skills/a/SKILL.md" at its root with this text:
      """
      ---
      name: a
      description: Skill a.
      ---

      Skill a body.
      """
    Given the marketplace "fixtures" has the file "skills/a/references/links.md" at its root with this text:
      """
      Listed: ../../b/ref.md
      Unlisted: ../../c/ref.md
      """
    Given the marketplace "fixtures" has the file "skills/b/SKILL.md" at its root with this text:
      """
      ---
      name: b
      description: Skill b.
      ---

      Skill b body.
      """
    Given the marketplace "fixtures" has the file "skills/b/ref.md" at its root with this text:
      """
      The reference of skill b.
      """
    Given the marketplace "fixtures" has the file "skills/c/SKILL.md" at its root with this text:
      """
      ---
      name: c
      description: Skill c.
      ---

      Skill c body.
      """
    Given the marketplace "fixtures" has the file "skills/c/ref.md" at its root with this text:
      """
      The reference of skill c.
      """
    Given the marketplace "fixtures" publishes this manifest:
      """
      {"name":"fixtures","owner":{"name":"features"},"plugins":[{"name":"root","source":"./","version":"1.0.0","skills":["./skills/a","./skills/b"]}]}
      """
    Given the marketplace "fixtures" is added to the project scope
    When the user runs "/claude:plugin install root@fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope   | version |
      | fixtures         | project           | root@fixtures | root | installed |         | project | 1.0.0   |
    Then the staged skills directory of the project scope holds these files:
      | file                       | text                                                                                                                                                                                                                                  |
      | root-a/                    |                                                                                                                                                                                                                                       |
      | root-a/references/         |                                                                                                                                                                                                                                       |
      | root-a/references/links.md | Listed: ../../root-b/ref.md\nUnlisted: ../../c/ref.md                                                                                                                                                                                 |
      | root-a/SKILL.md            | ---\nname: root-a\ndescription: Skill a.\npi-claude-marketplace: {"names":["root:a","a"],"pluginRoot":"{home}/marketplaces/fixtures","pluginData":"{project dir}/.pi/pi-claude-marketplace/data/fixtures/root"}\n---\n\nSkill a body. |
      | root-b/                    |                                                                                                                                                                                                                                       |
      | root-b/ref.md              | The reference of skill b.                                                                                                                                                                                                             |
      | root-b/SKILL.md            | ---\nname: root-b\ndescription: Skill b.\npi-claude-marketplace: {"names":["root:b","b"],"pluginRoot":"{home}/marketplaces/fixtures","pluginData":"{project dir}/.pi/pi-claude-marketplace/data/fixtures/root"}\n---\n\nSkill b body. |
