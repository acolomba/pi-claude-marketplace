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

  Scenario: Disabling a plugin with a workflow reports that its command lingers until a new session
    When the user runs "/claude:plugin disable demo@fixtures --scope user"
    Then the command reports these results:
      | kind    | severity | needs reload | summary                             |
      | cascade | warning  | true         | A plugin operation needs attention. |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status   | reasons                | scope | version |
      | fixtures         | user              | demo@fixtures | demo | disabled | stale workflow command | user  | 1.0.0   |

  Scenario: Running a workflow command after its plugin is disabled shows the engine's notice, because pi keeps the command until a new session
    Given the user has run "/claude:plugin disable demo@fixtures --scope user", which warned
    When the user runs the workflow command "/demo:hello", which starts no run
    Then the workflow engine shows these notices:
      | severity | message                                                                                       |
      | warning  | /demo:hello is not available in this project -- reload the session to drop the stale command. |

  Scenario: Enabling a disabled plugin runs its workflow again in a new session
    Given the user has run "/claude:plugin disable demo@fixtures --scope user", which warned
    Given the user has started a new pi session
    Given the user has run "/claude:plugin enable demo@fixtures --scope user"
    Given the user has started a new pi session
    When the user runs the workflow command "/demo:hello"
    Then the workflow run ends with the status "completed" and the result "Hello from demo."

  Scenario: Updating a plugin runs the new script of its workflow at once, because the engine reads the script when the command runs
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.1.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file "workflows/hello.js" with this text:
      """
      export const meta = {name:"hello",description:"Says hello again."};

      return "Hello 2.";
      """
    Given the user has run "/claude:plugin update demo@fixtures --scope user"
    When the user runs the workflow command "/demo:hello"
    Then the workflow run ends with the status "completed" and the result "Hello 2."

  Scenario: The session that ran the update still lists the old description, because pi cannot change a command it already offers
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.1.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file "workflows/hello.js" with this text:
      """
      export const meta = {name:"hello",description:"Says hello again."};

      return "Hello 2.";
      """
    Given the user has run "/claude:plugin update demo@fixtures --scope user"
    When the user lists the slash commands pi offers
    Then pi offers these workflow commands:
      | command     | description |
      | /demo:hello | Says hello. |

  Scenario: A new session after an update lists the new description of its workflow
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.1.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file "workflows/hello.js" with this text:
      """
      export const meta = {name:"hello",description:"Says hello again."};

      return "Hello 2.";
      """
    Given the user has run "/claude:plugin update demo@fixtures --scope user"
    Given the user has started a new pi session
    When the user lists the slash commands pi offers
    Then pi offers these workflow commands:
      | command     | description       |
      | /demo:hello | Says hello again. |

  Scenario: Updating to a version that renames the workflow reports that the old command lingers until a new session
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.1.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file "workflows/hello.js" with this text:
      """
      export const meta = {name:"greet",description:"Greets."};

      return "Hi.";
      """
    When the user runs "/claude:plugin update demo@fixtures --scope user"
    Then the command reports these results:
      | kind    | severity | needs reload | summary                             |
      | cascade | warning  | true         | A plugin operation needs attention. |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status  | reasons                | scope | from  | to    |
      | fixtures         | user              | demo@fixtures | demo | updated | stale workflow command | user  | 1.0.0 | 1.1.0 |

  Scenario: A new session after a renaming update offers only the new workflow command
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.1.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file "workflows/hello.js" with this text:
      """
      export const meta = {name:"greet",description:"Greets."};

      return "Hi.";
      """
    Given the user has run "/claude:plugin update demo@fixtures --scope user", which warned
    Given the user has started a new pi session
    When the user lists the slash commands pi offers
    Then pi offers these workflow commands:
      | command     | description |
      | /demo:greet | Greets.     |
