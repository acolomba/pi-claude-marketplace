Feature: Workflow companion missing

  An install reports when the workflow engine is not loaded, and its workflows work once
  the engine loads, with no reinstall. A new session stands in for /reload, which re-reads
  pi's settings the same way, and a scripted model and a local marketplace for real ones.

  Scenario: Adding the engine to pi's settings after the install runs the workflow in a new session with no reinstall
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the workflow "hello" described as "Says hello." that returns "Hello from demo."
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which warned
    Given the user has added the pi-dynamic-workflows package to pi's settings
    Given the user has started a new pi session
    When the user runs the workflow command "/demo:hello"
    Then the workflow run ends with the status "completed" and the result "Hello from demo."
