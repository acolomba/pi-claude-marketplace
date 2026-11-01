Feature: Hook additional context

  A plugin's UserPromptSubmit and SessionStart hooks can add context for the
  model, and the prompt the user typed reaches the model unchanged. A scripted
  model stands in for a real one, and recording script hooks for the plugin's.

  Scenario: A prompt hook's additional context reaches the model beside the prompt
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name | event            | matcher | form   | output                                                                                          |
      | ctx  | UserPromptSubmit |         | script | {"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"ctx-from-hook"}} |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply | tool | arguments |
      | Done. |      |           |
    When the user prompts "hello there"
    Then the model receives these calls:
      | call | role | text                                                    |
      | 1    | user | hello there                                             |
      | 1    | user | UserPromptSubmit hook additional context: ctx-from-hook |
