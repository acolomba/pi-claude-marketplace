Feature: Workflow storage

  A plugin installed into a project saves its workflows inside the project, where the workflow engine
  reads them, and saves nothing under the user's workflow directory. A scripted model and a local
  marketplace stand in for real ones.

  Background:
    Given pi runs with the scripted model and these companions:
      | companion            |
      | pi-dynamic-workflows |
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the workflow "hello" described as "Says hello." that returns "Hello from demo."
    Given the marketplace "fixtures" is added to the project scope

  Scenario: Installing a plugin into the project saves its workflow in the project and nothing in the user's workflow directory
    When the user runs "/claude:plugin install demo@fixtures --scope project"
    Then the command reports these results:
      | kind    | severity | needs reload |
      | cascade | info     | true         |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | installed |         | project | 1.0.0   |
    Then the saved workflows directory of the project holds these files:
      | file            |
      | demo:hello.json |
    Then the user's workflow directory holds no saved or staged workflows

  Scenario: A new session offers the workflow of a project install and runs it
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    When the user runs the workflow command "/demo:hello"
    Then the workflow run ends with the status "completed" and the result "Hello from demo."
    Then the workflow engine shows these notices:
      | notice              |
      | started /demo:hello |
