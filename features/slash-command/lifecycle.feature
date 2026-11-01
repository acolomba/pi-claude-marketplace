Feature: Slash command lifecycle

  Each plugin verb changes what a new session offers for a bridged command and what the model
  receives when the user invokes it. Changes apply at a new session, as Pi's /reload does.
  A local marketplace stands in for a published one, and a scripted model for a real one.

  Background:
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the slash command "greet" described as "Greets a person by name." with this body:
      """
      Greet the person by name.
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"

  Scenario: Disabling a plugin removes its slash commands from a new session
    Given the user has run "/claude:plugin disable demo@fixtures --scope project"
    Given the user has started a new pi session
    When the user lists the slash commands pi offers
    Then pi offers no slash commands from prompt templates
