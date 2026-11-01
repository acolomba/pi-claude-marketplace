Feature: Slash command listing

  A plugin's commands become slash commands that Pi offers in the next
  session, built from prompt templates. A registry probe in Pi stands in for
  the user's view of the command list, and a local marketplace for a published one.

  Scenario: A new session offers a bridged command as a prompt command with its description
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the slash command "greet" described as "Greets a person by name." with this body:
      """
      Greet the person named in the arguments.
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    When the user lists the slash commands pi offers
    Then pi offers these slash commands from prompt templates:
      | command     | description              |
      | /demo:greet | Greets a person by name. |

  Scenario: A command without a description is listed with the first line of its body
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the slash command "deploy" with this command file:
      """
      Deploy the current branch to the staging environment and report the result.

      Second paragraph.
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    When the user lists the slash commands pi offers
    Then pi offers these slash commands from prompt templates:
      | command      | description                                                                 |
      | /demo:deploy | Deploy the current branch to the staging environment and report the result. |
