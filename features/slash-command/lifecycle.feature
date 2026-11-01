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

  Scenario: A disabled plugin's slash command reaches the model as the typed text
    Given the user has run "/claude:plugin disable demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply  |
      | Hello. |
    When the user prompts "/demo:greet"
    Then the model receives these calls:
      | call | role | text        |
      | 1    | user | /demo:greet |

  Scenario: Enabling a disabled plugin offers its slash commands again
    Given the user has run "/claude:plugin disable demo@fixtures --scope project"
    Given the user has run "/claude:plugin enable demo@fixtures --scope project"
    Given the user has started a new pi session
    When the user lists the slash commands pi offers
    Then pi offers these slash commands from prompt templates:
      | command     | description              |
      | /demo:greet | Greets a person by name. |

  Scenario: Uninstalling a plugin removes its slash commands from a new session
    Given the user has run "/claude:plugin uninstall demo@fixtures --scope project"
    Given the user has started a new pi session
    When the user lists the slash commands pi offers
    Then pi offers no slash commands from prompt templates

  Scenario: Updating a plugin lists the new description of its slash command
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.1.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the slash command "greet" with this command file:
      """
      ---
      description: Greets someone warmly.
      ---
      Greet the person warmly.
      """
    Given the user has run "/claude:plugin update demo@fixtures --scope project"
    Given the user has started a new pi session
    When the user lists the slash commands pi offers
    Then pi offers these slash commands from prompt templates:
      | command     | description            |
      | /demo:greet | Greets someone warmly. |

  Scenario: Updating a plugin sends the model the new body of its slash command
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.1.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the slash command "greet" with this command file:
      """
      ---
      description: Greets someone warmly.
      ---
      Greet the person warmly.
      """
    Given the user has run "/claude:plugin update demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply          |
      | Hello, warmly. |
    When the user prompts "/demo:greet"
    Then the model receives these calls:
      | call | role | text                     |
      | 1    | user | Greet the person warmly. |
