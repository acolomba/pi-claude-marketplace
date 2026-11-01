Feature: Skill listing

  A new session lists each bridged skill under its generated name with the
  description Claude Code gives it. A local marketplace stands in for a published one.

  Scenario: A new session lists a bridged skill under its generated name with its description
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the skill "greet" described as "Greets a person by name." with this body:
      """
      Greet the person named in the arguments.
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    When the user starts a new pi session
    Then the session offers these skills:
      | command           | description              |
      | /skill:demo-greet | Greets a person by name. |
      | /skill:demo-skill | A skill of demo 1.0.0.   |

  Scenario: A skill without a description is listed with the first line of its body
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the skill "brief" with this skill file:
      """
      ---
      name: brief
      ---

      First line of the brief.
      Second line of the same paragraph.
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    When the user starts a new pi session
    Then the session offers these skills:
      | command           | description              |
      | /skill:demo-brief | First line of the brief. |
      | /skill:demo-skill | A skill of demo 1.0.0.   |
