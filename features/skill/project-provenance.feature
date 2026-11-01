Feature: Skill project provenance

  A project-scope skill runs its context commands and claims its aliases only when the user installed
  its plugin into the project, as Claude Code drops a plugin that only the repository's files name.
  Pi trusts a project that holds no pi settings file, so trust alone cannot tell the two apart. A local
  marketplace and a scripted model stand in for published and real ones.

  Background:
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the skill "status" with this skill file:
      """
      ---
      name: fancy
      description: Reports the status.
      ---

      Status: !`sh ${CLAUDE_SKILL_DIR}/status.sh`
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file "skills/status/status.sh" with this text:
      """
      printf ran
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"

  Scenario: A project skill whose install the user's pi directory does not record runs no context command
    Given the user's pi directory records no plugin install for the project
    Given the user has started a new pi session
    When the user runs "/skill:demo-status"
    Then the result has these fields:
      | kind         | usage-error                                                                                                                                                                                                                                                           |
      | severity     | error                                                                                                                                                                                                                                                                 |
      | needs reload | false                                                                                                                                                                                                                                                                 |
      | message      | The skill /skill:demo-status was not installed into the project {project dir} on this machine, or its file changed after the install. Reinstall its plugin into this project with /claude:plugin reinstall demo@fixtures --scope project, then run /reload to use it. |
      | usage        |                                                                                                                                                                                                                                                                       |

  Scenario Outline: A project skill whose staged directory changed after the install runs no context command
    Given the line "<line>" was appended to the file "<file>" of the staged project skill "demo-status"
    Given the user has started a new pi session
    When the user runs "/skill:demo-status"
    Then the result has these fields:
      | kind         | usage-error                                                                                                                                                                                                                                                           |
      | severity     | error                                                                                                                                                                                                                                                                 |
      | needs reload | false                                                                                                                                                                                                                                                                 |
      | message      | The skill /skill:demo-status was not installed into the project {project dir} on this machine, or its file changed after the install. Reinstall its plugin into this project with /claude:plugin reinstall demo@fixtures --scope project, then run /reload to use it. |
      | usage        |                                                                                                                                                                                                                                                                       |

    Examples:
      | file           | line         |
      | SKILL.md       | Changed.     |
      | status.sh      | printf pwned |
      | notes/added.md | Added.       |

  Scenario: A skill alias of a project skill whose install the user's pi directory does not record reaches the model as typed
    Given the user's pi directory records no plugin install for the project
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply  |
      | Noted. |
    When the user prompts "/fancy now"
    Then the model receives these calls:
      | call | role | text       |
      | 1    | user | /fancy now |

  Scenario: A project skill the user installed into the project runs its context command
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply  |
      | Noted. |
    When the user prompts "/skill:demo-status"
    Then the model receives these calls:
      | call | role | text                                                                                                                                                                                                                                           |
      | 1    | user | <skill name="demo-status" location="{project dir}/.pi/pi-claude-marketplace/resources/skills/demo-status/SKILL.md">\nReferences are relative to {project dir}/.pi/pi-claude-marketplace/resources/skills/demo-status.\n\nStatus: ran\n</skill> |

  Scenario: A project skill whose install the user's pi directory does not record runs its context command after the reinstall the abort names
    Given the user's pi directory records no plugin install for the project
    Given the user has run "/claude:plugin reinstall demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply  |
      | Noted. |
    When the user prompts "/skill:demo-status"
    Then the model receives these calls:
      | call | role | text                                                                                                                                                                                                                                           |
      | 1    | user | <skill name="demo-status" location="{project dir}/.pi/pi-claude-marketplace/resources/skills/demo-status/SKILL.md">\nReferences are relative to {project dir}/.pi/pi-claude-marketplace/resources/skills/demo-status.\n\nStatus: ran\n</skill> |

  Scenario: A project skill whose plugin an update changed runs the new context command
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.1.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file "skills/status/status.sh" with this text:
      """
      printf updated
      """
    Given the user has run "/claude:plugin update demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply  |
      | Noted. |
    When the user prompts "/skill:demo-status"
    Then the model receives these calls:
      | call | role | text                                                                                                                                                                                                                                           |
      | 1    | user | <skill name="demo-status" location="{project dir}/.pi/pi-claude-marketplace/resources/skills/demo-status/SKILL.md">\nReferences are relative to {project dir}/.pi/pi-claude-marketplace/resources/skills/demo-status.\n\nStatus: updated\n</skill> |

  Scenario: A project skill whose published files changed runs the new context command after a reinstall
    Given the published plugin "demo" of the marketplace "fixtures" has the file "skills/status/status.sh" with this text:
      """
      printf reinstalled
      """
    Given the user has run "/claude:plugin reinstall demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply  |
      | Noted. |
    When the user prompts "/skill:demo-status"
    Then the model receives these calls:
      | call | role | text                                                                                                                                                                                                                                           |
      | 1    | user | <skill name="demo-status" location="{project dir}/.pi/pi-claude-marketplace/resources/skills/demo-status/SKILL.md">\nReferences are relative to {project dir}/.pi/pi-claude-marketplace/resources/skills/demo-status.\n\nStatus: reinstalled\n</skill> |

  Scenario: A project skill whose plugin was disabled and enabled again runs its context command
    Given the user has run "/claude:plugin disable demo@fixtures --scope project"
    Given the user has run "/claude:plugin enable demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply  |
      | Noted. |
    When the user prompts "/skill:demo-status"
    Then the model receives these calls:
      | call | role | text                                                                                                                                                                                                                                           |
      | 1    | user | <skill name="demo-status" location="{project dir}/.pi/pi-claude-marketplace/resources/skills/demo-status/SKILL.md">\nReferences are relative to {project dir}/.pi/pi-claude-marketplace/resources/skills/demo-status.\n\nStatus: ran\n</skill> |

  Scenario: Installing a project skill's plugin while the user's record of project skill installs holds content pi cannot update fails and keeps the record
    Given the user has run "/claude:plugin uninstall demo@fixtures --scope project"
    Given the user's record of project skill installs was replaced with this text:
      """
      { "version": 2, "projects": {} }
      """
    When the user runs "/claude:plugin install demo@fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status | reasons | scope   | version | cause chain                                                                                           | cause truncated | leaks | rollback partial |
      | fixtures         | project           | demo@fixtures | demo | failed |         | project | 1.0.0   | The project skill ledger skills.json holds content this version cannot update; it was left unchanged. | false           |       |                  |
    Then the user's record of project skill installs holds this text:
      """
      { "version": 2, "projects": {} }
      """
    Then the project scope has no installed plugins

  Scenario Outline: Removing a project skill while the user's record of project skill installs holds content pi cannot update removes it and warns
    Given the user's record of project skill installs was replaced with this text:
      """
      { "version": 2 }
      """
    When the user runs "<command>"
    Then the command reports these results:
      | kind       | severity | needs reload | header                                             | lines                                                                                                                                              |
      | cascade    | info     | true         |                                                    |                                                                                                                                                    |
      | diagnostic | warning  | false        | Plugin "demo" [project] <verb>; 1 cleanup warning. | could not update the project skill ledger: The project skill ledger skills.json holds content this version cannot update; it was left unchanged. |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status | reasons | scope   | <extra field> |
      | fixtures         | project           | demo@fixtures | demo | <verb> |         | project | <extra value> |

    Examples:
      | command                                                    | verb        | extra field        | extra value |
      | /claude:plugin uninstall demo@fixtures --scope project     | uninstalled | version            | 1.0.0       |
      | /claude:plugin disable demo@fixtures --scope project       | disabled    | version            | 1.0.0       |
      | /claude:plugin marketplace remove fixtures --scope project | uninstalled | marketplace status | removed     |
