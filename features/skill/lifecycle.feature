Feature: Skill lifecycle

  Each plugin verb changes what a new session offers for a bridged skill and what the model
  receives when the user invokes it. Changes apply at a new session, as Pi's /reload does.
  A local marketplace stands in for a published one, and a scripted model for a real one.

  Background:
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

  Scenario: Disabling a plugin removes its skills from a new session
    Given the user has run "/claude:plugin disable demo@fixtures --scope project"
    When the user starts a new pi session
    Then the session offers no skills

  Scenario: A disabled plugin's skill reaches the model as the typed text
    Given pi runs with the scripted model
    Given the user has run "/claude:plugin disable demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply       |
      | Hello, Ada. |
    When the user prompts "/skill:demo-greet"
    Then the model receives these calls:
      | call | role | text              |
      | 1    | user | /skill:demo-greet |
