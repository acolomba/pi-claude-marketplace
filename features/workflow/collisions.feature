Feature: Workflow collisions

  A workflow and a command of one plugin can claim one name. The workflow keeps the name,
  as in Claude Code, and the install warns about the command it skips. A local marketplace
  and a registry probe in Pi stand in for a published one and the user's command list.

  Scenario: A command that shares its name with a workflow of its plugin is skipped with a warning
    Given pi runs with the scripted model and these companions:
      | companion            |
      | pi-dynamic-workflows |
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the workflow "hello" described as "Says hello." that returns "Hello from demo."
    Given the published plugin "demo" of the marketplace "fixtures" has the slash command "hello" described as "Hello command." with this body:
      """
      COMMAND HELLO BODY
      """
    Given the marketplace "fixtures" is added to the user scope
    When the user runs "/claude:plugin install demo@fixtures --scope user"
    Then the command reports these results:
      | kind       | severity | needs reload | header                                                           | lines                                                                                                    |
      | cascade    | info     | true         |                                                                  |                                                                                                          |
      | diagnostic | warning  | false        | Plugin "demo" [user] installed; 1 declared component has a note. | command source "hello" has the same name "demo:hello" as a workflow of the plugin; ignoring the command. |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope | version |
      | fixtures         | user              | demo@fixtures | demo | installed |         | user  | 1.0.0   |

  Scenario: A new session offers the workflow and no prompt template under a name both claim
    Given pi runs with the scripted model and these companions:
      | companion            |
      | pi-dynamic-workflows |
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the workflow "hello" described as "Says hello." that returns "Hello from demo."
    Given the published plugin "demo" of the marketplace "fixtures" has the slash command "hello" described as "Hello command." with this body:
      """
      COMMAND HELLO BODY
      """
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which skipped a command that a workflow of the plugin names
    Given the user has started a new pi session
    When the user lists the slash commands pi offers
    Then pi offers these workflow commands:
      | command     | description |
      | /demo:hello | Says hello. |
    Then pi offers no slash commands from prompt templates
