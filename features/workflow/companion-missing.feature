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
    Then the workflow engine shows these notices:
      | severity | message                                                                                                                                         |
      | info     | /demo:hello running in the background ({run id}) -- check progress with /workflows status {run id}; the result is posted here when it finishes. |
      | warning  | [workflow-delivery] delivery for {run id} deferred: endpoint for session {session id} has no thenable send function                             |

  Scenario: Installing a plugin with a workflow without the engine reports that it requires pi-dynamic-workflows
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the workflow "hello" described as "Says hello." that returns "Hello from demo."
    Given the marketplace "fixtures" is added to the user scope
    When the user runs "/claude:plugin install demo@fixtures --scope user"
    Then the command reports these results:
      | kind    | severity | needs reload | summary                             |
      | cascade | warning  | true         | A plugin operation needs attention. |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons                       | scope | version |
      | fixtures         | user              | demo@fixtures | demo | installed | requires pi-dynamic-workflows | user  | 1.0.0   |

  Scenario: Listing plugins without the engine reports the requirement as information
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the workflow "hello" described as "Says hello." that returns "Hello from demo."
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which warned
    When the user runs "/claude:plugin list"
    Then the result has these fields:
      | kind                | cascade     |
      | severity            | info        |
      | needs reload        | false       |
      | tally label         | Plugin list |
      | tally failures      | 0           |
      | tally warnings      | 0           |
      | tally success count | 1           |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons                       | scope | version |
      | fixtures         | user              | demo@fixtures | demo | installed | requires pi-dynamic-workflows | user  | 1.0.0   |

  Scenario: Without the engine, a new session offers no workflow command
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the workflow "hello" described as "Says hello." that returns "Hello from demo."
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which warned
    Given the user has started a new pi session
    When the user lists the slash commands pi offers
    Then pi offers no slash command whose name contains "hello"
