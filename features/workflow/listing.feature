Feature: Workflow listing

  A plugin's workflows become commands that a new session offers when the
  workflow engine is loaded. A registry probe in Pi stands in for the user's
  view of the command list, and a local marketplace for a published one.

  Scenario: A new session offers a bridged workflow as a command named for its plugin and its meta name
    Given pi runs with the scripted model and these companions:
      | companion            |
      | pi-dynamic-workflows |
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the workflow "hello" described as "Says hello." that returns "Hello from demo."
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user has started a new pi session
    When the user lists the slash commands pi offers
    Then pi offers these workflow commands:
      | command     | description |
      | /demo:hello | Says hello. |
