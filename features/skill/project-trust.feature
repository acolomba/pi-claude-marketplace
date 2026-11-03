Feature: Skill project trust

  A project-scope skill is offered and runs its context commands only when Pi trusts the project, as
  Claude Code loads no project-scope plugin before the workspace is trusted. The project holds a pi
  settings file, so Pi's trust store alone decides. A local marketplace and a scripted model stand in
  for published and real ones.

  Background:
    Given the project holds a pi settings file
    Given pi runs with the scripted model in an untrusted project
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

      Status: !`printf ran; exit 3`
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"

  Scenario: A new session in an untrusted project offers none of its skills
    When the user starts a new pi session
    Then the session offers no skills

  Scenario: A skill of an untrusted project runs no context command and reaches the model as typed
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply  |
      | Noted. |
    When the user prompts "/skill:demo-status"
    Then the model receives these calls:
      | call | role | text               |
      | 1    | user | /skill:demo-status |

  Scenario: A skill alias of an untrusted project reaches the model as typed
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply  |
      | Noted. |
    When the user prompts "/fancy now"
    Then the model receives these calls:
      | call | role | text       |
      | 1    | user | /fancy now |

  Scenario: A new session in an untrusted project offers the skills of a user-scope plugin
    Given the marketplace "mine" is published as a dir source
    Given the marketplace "mine" offers these plugins:
      | name     | version |
      | personal | 1.0.0   |
    Given the published plugin "personal" of the marketplace "mine" has the skill "status" with this skill file:
      """
      ---
      name: mine
      description: Reports my status.
      ---

      Status: !`printf ran`
      """
    Given the marketplace "mine" is added to the user scope
    Given the user has run "/claude:plugin install personal@mine --scope user"
    When the user starts a new pi session
    Then the session offers these skills:
      | command                | description                |
      | /skill:personal-skill  | A skill of personal 1.0.0. |
      | /skill:personal-status | Reports my status.         |

  Scenario: A user-scope skill runs its context command in an untrusted project
    Given the marketplace "mine" is published as a dir source
    Given the marketplace "mine" offers these plugins:
      | name     | version |
      | personal | 1.0.0   |
    Given the published plugin "personal" of the marketplace "mine" has the skill "status" with this skill file:
      """
      ---
      name: mine
      description: Reports my status.
      ---

      Status: !`printf ran`
      """
    Given the marketplace "mine" is added to the user scope
    Given the user has run "/claude:plugin install personal@mine --scope user"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply  |
      | Noted. |
    When the user prompts "/skill:personal-status"
    Then the model receives these calls:
      | call | role | text                                                                                                                                                                                                                                           |
      | 1    | user | <skill name="personal-status" location="{agent dir}/pi-claude-marketplace/resources/skills/personal-status/SKILL.md">\nReferences are relative to {agent dir}/pi-claude-marketplace/resources/skills/personal-status.\n\nStatus: ran\n</skill> |
