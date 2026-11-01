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

      Status: !`printf ran`
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
