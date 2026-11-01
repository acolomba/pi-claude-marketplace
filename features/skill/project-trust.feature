Feature: Skill project trust

  A project-scope skill runs its context commands only when Pi trusts the project, as Claude Code
  loads no project-scope plugin before the workspace is trusted. The project holds a pi settings
  file, so Pi's trust store alone decides. A local marketplace and a scripted model stand in for
  published and real ones.

  Background:
    Given the project holds a pi settings file
    Given pi runs with the scripted model in an untrusted project that holds skills
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
    Given the user has started a new pi session

  Scenario: A skill of an untrusted project runs no context command and asks for trust
    When the user runs "/skill:demo-status"
    Then the result has these fields:
      | kind         | usage-error                                                                                                                                       |
      | severity     | error                                                                                                                                             |
      | needs reload | false                                                                                                                                             |
      | message      | The skill /skill:demo-status belongs to the project {project dir}, which Pi does not trust. Trust the project folder, then run /reload to use it. |
      | usage        |                                                                                                                                                   |

  Scenario: A skill alias of an untrusted project reaches the model as typed
    Given the scripted model plays these steps:
      | reply  |
      | Noted. |
    When the user prompts "/fancy now"
    Then the model receives these calls:
      | call | role | text       |
      | 1    | user | /fancy now |
