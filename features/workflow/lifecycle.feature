Feature: Workflow lifecycle

  Each plugin verb removes or replaces the workflow commands the engine
  offers. A removed workflow's command stays until a new session, because Pi
  cannot drop a command it offers. A scripted model stands in for a real one,
  and a local marketplace for a published one.

  Background:
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

  Scenario: Running a workflow command after its plugin is uninstalled shows the engine's notice, because pi keeps the command until a new session
    Given the user has run "/claude:plugin uninstall demo@fixtures --scope user", which warned
    When the user runs the workflow command "/demo:hello", which starts no run
    Then the workflow engine shows these notices:
      | severity | message                                                                                       |
      | warning  | /demo:hello is not available in this project -- reload the session to drop the stale command. |

  Scenario: Uninstalling a plugin with a workflow reports that its command lingers until a new session
    When the user runs "/claude:plugin uninstall demo@fixtures --scope user"
    Then the command reports these results:
      | kind    | severity | needs reload | summary                             |
      | cascade | warning  | true         | A plugin operation needs attention. |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status      | reasons                | scope | version |
      | fixtures         | user              | demo@fixtures | demo | uninstalled | stale workflow command | user  | 1.0.0   |

  Scenario: A new session after the uninstall offers no workflow command
    Given the user has run "/claude:plugin uninstall demo@fixtures --scope user", which warned
    Given the user has started a new pi session
    When the user lists the slash commands pi offers
    Then pi offers no workflow commands
