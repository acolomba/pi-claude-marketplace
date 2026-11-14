Feature: Skill root-source entries

  Protects the D-PG4-01 rule of Claude Code 2.1.323: a marketplace entry whose source is the
  marketplace root and which lists skills gets only the listed skill folders. A local
  marketplace stands in for a published one.

  Background:
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" has the file "skills/a/SKILL.md" at its root with this text:
      """
      ---
      name: a
      description: Skill a.
      ---

      Skill a body.
      """
    Given the marketplace "fixtures" has the file "skills/b/SKILL.md" at its root with this text:
      """
      ---
      name: b
      description: Skill b.
      ---

      Skill b body.
      """

  Scenario: Installing a root-source entry that lists skills stages only the listed skills
    Given the marketplace "fixtures" has the file "skills/a/references/deep.md" at its root with this text:
      """
      A deep reference.
      """
    Given the marketplace "fixtures" publishes this manifest:
      """
      {"name":"fixtures","owner":{"name":"features"},"plugins":[{"name":"root","source":"./","version":"1.0.0","skills":["./skills/a"]}]}
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
      | file                      | text                                                                                                                                                                                                                   |
      | root-a/                   |                                                                                                                                                                                                                        |
      | root-a/references/        |                                                                                                                                                                                                                        |
      | root-a/references/deep.md | A deep reference.                                                                                                                                                                                                      |
      | root-a/SKILL.md           | ---\nname: root-a\ndescription: Skill a.\npi-claude-marketplace: {"names":["root:a","a"],"pluginRoot":"{home}/marketplaces/fixtures","pluginData":"{project dir}/.pi/pi-claude-marketplace/data/fixtures/root"}\n---\n\nSkill a body. |

  Scenario: Two root-source entries that share one skills folder each stage only their own listed skills
    Given the marketplace "fixtures" publishes this manifest:
      """
      {"name":"fixtures","owner":{"name":"features"},"plugins":[{"name":"one","source":"./","version":"1.0.0","skills":["./skills/a"]},{"name":"two","source":"./","version":"1.0.0","skills":["./skills/b"]}]}
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install one@fixtures --scope project"
    When the user runs "/claude:plugin install two@fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id           | name | status    | reasons | scope   | version |
      | fixtures         | project           | two@fixtures | two  | installed |         | project | 1.0.0   |
    Then the staged skills directory of the project scope holds these files:
      | file           | text                                                                                                                                                                                                                 |
      | one-a/         |                                                                                                                                                                                                                      |
      | one-a/SKILL.md | ---\nname: one-a\ndescription: Skill a.\npi-claude-marketplace: {"names":["one:a","a"],"pluginRoot":"{home}/marketplaces/fixtures","pluginData":"{project dir}/.pi/pi-claude-marketplace/data/fixtures/one"}\n---\n\nSkill a body. |
      | two-b/         |                                                                                                                                                                                                                      |
      | two-b/SKILL.md | ---\nname: two-b\ndescription: Skill b.\npi-claude-marketplace: {"names":["two:b","b"],"pluginRoot":"{home}/marketplaces/fixtures","pluginData":"{project dir}/.pi/pi-claude-marketplace/data/fixtures/two"}\n---\n\nSkill b body. |

  Scenario: An update that drops a listed skill removes its staged folder and its record
    Given the marketplace "fixtures" publishes this manifest:
      """
      {"name":"fixtures","owner":{"name":"features"},"plugins":[{"name":"root","source":"./","version":"1.0.0","skills":["./skills/a","./skills/b"]}]}
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install root@fixtures --scope project"
    Given the marketplace "fixtures" publishes this manifest:
      """
      {"name":"fixtures","owner":{"name":"features"},"plugins":[{"name":"root","source":"./","version":"1.1.0","skills":["./skills/a"]}]}
      """
    When the user runs "/claude:plugin update root@fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status  | reasons | scope   | from  | to    |
      | fixtures         | project           | root@fixtures | root | updated |         | project | 1.0.0 | 1.1.0 |
    Then the staged skills directory of the project scope holds these files:
      | file            | text                                                                                                                                                                                                                                  |
      | root-a/         |                                                                                                                                                                                                                                       |
      | root-a/SKILL.md | ---\nname: root-a\ndescription: Skill a.\npi-claude-marketplace: {"names":["root:a","a"],"pluginRoot":"{home}/marketplaces/fixtures","pluginData":"{project dir}/.pi/pi-claude-marketplace/data/fixtures/root"}\n---\n\nSkill a body. |
    Then the installation record of the project scope holds these skills of "root@fixtures":
      | skill  |
      | root-a |

  Scenario: A reinstall removes a skill that the entry stopped listing under the same version
    Given the marketplace "fixtures" publishes this manifest:
      """
      {"name":"fixtures","owner":{"name":"features"},"plugins":[{"name":"root","source":"./","version":"1.0.0","skills":["./skills/a","./skills/b"]}]}
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install root@fixtures --scope project"
    Given the marketplace "fixtures" publishes this manifest:
      """
      {"name":"fixtures","owner":{"name":"features"},"plugins":[{"name":"root","source":"./","version":"1.0.0","skills":["./skills/a"]}]}
      """
    When the user runs "/claude:plugin reinstall root@fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status      | reasons | scope   | version |
      | fixtures         | project           | root@fixtures | root | reinstalled |         | project | 1.0.0   |
    Then the staged skills directory of the project scope holds these files:
      | file            | text                                                                                                                                                                                                                                  |
      | root-a/         |                                                                                                                                                                                                                                       |
      | root-a/SKILL.md | ---\nname: root-a\ndescription: Skill a.\npi-claude-marketplace: {"names":["root:a","a"],"pluginRoot":"{home}/marketplaces/fixtures","pluginData":"{project dir}/.pi/pi-claude-marketplace/data/fixtures/root"}\n---\n\nSkill a body. |
    Then the installation record of the project scope holds these skills of "root@fixtures":
      | skill  |
      | root-a |

  Scenario: A new session after the update offers only the skill that stays
    Given the marketplace "fixtures" publishes this manifest:
      """
      {"name":"fixtures","owner":{"name":"features"},"plugins":[{"name":"root","source":"./","version":"1.0.0","skills":["./skills/a","./skills/b"]}]}
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install root@fixtures --scope project"
    Given the marketplace "fixtures" publishes this manifest:
      """
      {"name":"fixtures","owner":{"name":"features"},"plugins":[{"name":"root","source":"./","version":"1.1.0","skills":["./skills/a"]}]}
      """
    Given the user has run "/claude:plugin update root@fixtures --scope project"
    When the user starts a new pi session
    Then the session offers these skills:
      | command       | description |
      | /skill:root-a | Skill a.    |

  Scenario: The Claude Code name of a dropped skill reaches the model as typed
    Given pi runs with the scripted model
    Given the marketplace "fixtures" publishes this manifest:
      """
      {"name":"fixtures","owner":{"name":"features"},"plugins":[{"name":"root","source":"./","version":"1.0.0","skills":["./skills/a","./skills/b"]}]}
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install root@fixtures --scope project"
    Given the marketplace "fixtures" publishes this manifest:
      """
      {"name":"fixtures","owner":{"name":"features"},"plugins":[{"name":"root","source":"./","version":"1.1.0","skills":["./skills/a"]}]}
      """
    Given the user has run "/claude:plugin update root@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply  |
      | Noted. |
    When the user prompts "/root:b Ada"
    Then the model receives these calls:
      | call | role | text        |
      | 1    | user | /root:b Ada |

  Scenario: A second reinstall of a converged root-source plugin changes nothing
    Given the marketplace "fixtures" publishes this manifest:
      """
      {"name":"fixtures","owner":{"name":"features"},"plugins":[{"name":"root","source":"./","version":"1.0.0","skills":["./skills/a","./skills/b"]}]}
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install root@fixtures --scope project"
    Given the marketplace "fixtures" publishes this manifest:
      """
      {"name":"fixtures","owner":{"name":"features"},"plugins":[{"name":"root","source":"./","version":"1.0.0","skills":["./skills/a"]}]}
      """
    Given the user has run "/claude:plugin reinstall root@fixtures --scope project"
    When the user runs "/claude:plugin reinstall root@fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status      | reasons | scope   | version |
      | fixtures         | project           | root@fixtures | root | reinstalled |         | project | 1.0.0   |
    Then the staged skills directory of the project scope holds these files:
      | file            | text                                                                                                                                                                                                                                  |
      | root-a/         |                                                                                                                                                                                                                                       |
      | root-a/SKILL.md | ---\nname: root-a\ndescription: Skill a.\npi-claude-marketplace: {"names":["root:a","a"],"pluginRoot":"{home}/marketplaces/fixtures","pluginData":"{project dir}/.pi/pi-claude-marketplace/data/fixtures/root"}\n---\n\nSkill a body. |
    Then the installation record of the project scope holds these skills of "root@fixtures":
      | skill  |
      | root-a |

  Scenario: Info on a root-source entry that lists skills lists only the listed skills
    Given the marketplace "fixtures" has the file "skills/a/references/deep.md" at its root with this text:
      """
      A deep reference.
      """
    Given the marketplace "fixtures" publishes this manifest:
      """
      {"name":"fixtures","owner":{"name":"features"},"plugins":[{"name":"root","source":"./","version":"1.0.0","skills":["./skills/a"]}]}
      """
    Given the marketplace "fixtures" is added to the project scope
    When the user runs "/claude:plugin info root@fixtures"
    Then the result has these fields:
      | kind                           | plugin-info   |
      | marketplace details autoupdate | false         |
      | marketplace name               | fixtures      |
      | marketplace scope              | project       |
      | needs reload                   | false         |
      | plugin components resolved     | true          |
      | plugin components skills       | a             |
      | plugin id                      | root@fixtures |
      | plugin name                    | root          |
      | plugin reasons                 |               |
      | plugin status                  | available     |
      | plugin version                 | 1.0.0         |
      | severity                       | info          |

  Scenario: Installing a root-source entry with an escaping listed path stages the listed skills inside the plugin
    Given the marketplace "fixtures" publishes this manifest:
      """
      {"name":"fixtures","owner":{"name":"features"},"plugins":[{"name":"root","source":"./","version":"1.0.0","skills":["./skills/a","../outside"]}]}
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
      | file            | text                                                                                                                                                                                                                                  |
      | root-a/         |                                                                                                                                                                                                                                       |
      | root-a/SKILL.md | ---\nname: root-a\ndescription: Skill a.\npi-claude-marketplace: {"names":["root:a","a"],"pluginRoot":"{home}/marketplaces/fixtures","pluginData":"{project dir}/.pi/pi-claude-marketplace/data/fixtures/root"}\n---\n\nSkill a body. |

  Scenario: Info on a root-source entry with an escaping listed path lists only the listed skills inside the plugin
    Given the marketplace "fixtures" publishes this manifest:
      """
      {"name":"fixtures","owner":{"name":"features"},"plugins":[{"name":"root","source":"./","version":"1.0.0","skills":["./skills/a","../outside"]}]}
      """
    Given the marketplace "fixtures" is added to the project scope
    When the user runs "/claude:plugin info root@fixtures"
    Then the result has these fields:
      | kind                           | plugin-info   |
      | marketplace details autoupdate | false         |
      | marketplace name               | fixtures      |
      | marketplace scope              | project       |
      | needs reload                   | false         |
      | plugin components resolved     | true          |
      | plugin components skills       | a             |
      | plugin id                      | root@fixtures |
      | plugin name                    | root          |
      | plugin reasons                 |               |
      | plugin status                  | available     |
      | plugin version                 | 1.0.0         |
      | severity                       | info          |

  Scenario: Info on a root-source entry whose only listed path escapes lists no skills
    Given the marketplace "fixtures" publishes this manifest:
      """
      {"name":"fixtures","owner":{"name":"features"},"plugins":[{"name":"root","source":"./","version":"1.0.0","skills":["../outside"]}]}
      """
    Given the marketplace "fixtures" is added to the project scope
    When the user runs "/claude:plugin info root@fixtures"
    Then the result has these fields:
      | kind                           | plugin-info   |
      | marketplace details autoupdate | false         |
      | marketplace name               | fixtures      |
      | marketplace scope              | project       |
      | needs reload                   | false         |
      | plugin components resolved     | true          |
      | plugin id                      | root@fixtures |
      | plugin name                    | root          |
      | plugin reasons                 |               |
      | plugin status                  | available     |
      | plugin version                 | 1.0.0         |
      | severity                       | info          |

  Scenario: Info on an unavailable root-source entry does not list a listed path that climbs back through the working directory
    Given the marketplace "fixtures" has the file "hooks/hooks.json" at its root with this text:
      """
      { not valid json
      """
    Given the marketplace "fixtures" publishes this manifest:
      """
      {"name":"fixtures","owner":{"name":"features"},"plugins":[{"name":"root","source":"./","version":"1.0.0","skills":["./skills/a","../project/skills/b"]}]}
      """
    Given the marketplace "fixtures" is added to the project scope
    When the user runs "/claude:plugin info root@fixtures"
    Then the result has these fields:
      | kind                           | plugin-info       |
      | marketplace details autoupdate | false             |
      | marketplace name               | fixtures          |
      | marketplace scope              | project           |
      | needs reload                   | false             |
      | plugin components resolved     | true              |
      | plugin components skills       | a                 |
      | plugin id                      | root@fixtures     |
      | plugin name                    | root              |
      | plugin reasons                 | unsupported hooks |
      | plugin status                  | unavailable       |
      | plugin version                 | 1.0.0             |
      | severity                       | info              |

  Scenario: Info on an unavailable root-source entry whose listed folders are all missing lists the skills folder
    Given the marketplace "fixtures" has the file "hooks/hooks.json" at its root with this text:
      """
      { not valid json
      """
    Given the marketplace "fixtures" publishes this manifest:
      """
      {"name":"fixtures","owner":{"name":"features"},"plugins":[{"name":"root","source":"./","version":"1.0.0","skills":["./skills/missing"]}]}
      """
    Given the marketplace "fixtures" is added to the project scope
    When the user runs "/claude:plugin info root@fixtures"
    Then the result has these fields:
      | kind                           | plugin-info       |
      | marketplace details autoupdate | false             |
      | marketplace name               | fixtures          |
      | marketplace scope              | project           |
      | needs reload                   | false             |
      | plugin components resolved     | true              |
      | plugin components skills       | a, b              |
      | plugin id                      | root@fixtures     |
      | plugin name                    | root              |
      | plugin reasons                 | unsupported hooks |
      | plugin status                  | unavailable       |
      | plugin version                 | 1.0.0             |
      | severity                       | info              |
