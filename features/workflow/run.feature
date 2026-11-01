Feature: Workflow run

  A bridged workflow command runs the plugin's script in the workflow engine, which
  hands it the engine's argument object; Pi asks no approval first, unlike Claude Code
  in its manual permission mode (a Pi gap). A scripted model and a local marketplace stand in.

  Scenario: Running a bridged workflow completes with the result its script returns
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
    When the user runs the workflow command "/demo:hello"
    Then the workflow run ends with the status "completed" and the result "Hello from demo."

  Scenario Outline: Typed text reaches the workflow script as the engine's argument object, because the engine runs the command itself
    Given pi runs with the scripted model and these companions:
      | companion            |
      | pi-dynamic-workflows |
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file "workflows/echo.js" with this text:
      """
      export const meta = {name:"echo",description:"Echoes its arguments."};

      return JSON.stringify(args);
      """
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user has started a new pi session
    When the user runs the workflow command "<typed command>"
    Then the workflow run ends with the status "completed" and the result '<returned text>'

    Examples:
      | typed command                   | returned text                                                          |
      | /demo:echo first second who=Ada | {"who":"Ada","_":"first second","_raw":"first second who=Ada"}         |
      | /demo:echo                      | {"_":"","_raw":""}                                                     |
      | /demo:echo a=1 b= =c x=y=z tail | {"a":"1","b":"","x":"y=z","_":"=c tail","_raw":"a=1 b= =c x=y=z tail"} |

  Scenario: A workflow whose script throws ends failed with the error it threw
    Given pi runs with the scripted model and these companions:
      | companion            |
      | pi-dynamic-workflows |
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file "workflows/nope.js" with this text:
      """
      export const meta = {name:"nope",description:"Always fails."};

      throw new Error("Nope.");
      return "never";
      """
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user has started a new pi session
    When the user runs the workflow command "/demo:nope"
    Then the workflow run ends with the status "failed" and the error "Error: Nope."
