Feature: Slash command invocation

  Invoking a bridged command sends the model the command's body, with the
  typed arguments filled in as Claude Code fills them. A scripted model stands
  in for a real one, and a local marketplace for a published one.

  Scenario: Invoking a command sends the model its body with the typed arguments
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
    Given the scripted model plays these steps:
      | reply       |
      | Hello, Ada. |
    When the user prompts "/demo:greet Ada"
    Then the model receives these calls:
      | call | role | text                                                       |
      | 1    | user | Greet the person named in the arguments.\n\nARGUMENTS: Ada |
