Feature: Workflow run

  A workflow command, the model by installed name with an argument object, or a sibling script
  runs a plugin's script in the workflow engine; Pi asks no approval first, unlike Claude Code
  in its manual permission mode (a Pi gap). A scripted model and a local marketplace stand in.

  Background:
    Given pi runs with the scripted model and these companions:
      | companion            |
      | pi-dynamic-workflows |
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |

  Scenario: Running a bridged workflow completes with the result its script returns
    Given the published plugin "demo" of the marketplace "fixtures" has the workflow "hello" described as "Says hello." that returns "Hello from demo."
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user has reloaded pi
    When the user runs the workflow command "/demo:hello"
    Then the workflow run ends with the status "completed" and the result "Hello from demo."
    Then the workflow engine shows these notices:
      | notice              |
      | started /demo:hello |

  Scenario Outline: Typed text reaches the workflow script as the engine's argument object, because the engine runs the command itself
    Given the published plugin "demo" of the marketplace "fixtures" has the file "workflows/echo.js" with this text:
      """
      export const meta = {name:"echo",description:"Echoes its arguments."};

      return JSON.stringify(args);
      """
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user has reloaded pi
    When the user runs the workflow command "<typed command>"
    Then the workflow run ends with the status "completed" and the result '<returned text>'
    Then the workflow engine shows these notices:
      | notice             |
      | started /demo:echo |

    Examples:
      | typed command                   | returned text                                                          |
      | /demo:echo first second who=Ada | {"who":"Ada","_":"first second","_raw":"first second who=Ada"}         |
      | /demo:echo                      | {"_":"","_raw":""}                                                     |
      | /demo:echo a=1 b= =c x=y=z tail | {"a":"1","b":"","x":"y=z","_":"=c tail","_raw":"a=1 b= =c x=y=z tail"} |

  Scenario: A workflow whose script throws ends failed with the error it threw
    Given the published plugin "demo" of the marketplace "fixtures" has the file "workflows/nope.js" with this text:
      """
      export const meta = {name:"nope",description:"Always fails."};

      throw new Error("Nope.");
      return "never";
      """
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user has reloaded pi
    When the user runs the workflow command "/demo:nope"
    Then the workflow run ends with the status "failed" and the error "Nope."
    Then the workflow engine shows these notices:
      | notice             |
      | started /demo:nope |

  Scenario: The model starts a workflow by name with an argument object, and the script receives the object
    Given the published plugin "demo" of the marketplace "fixtures" has the file "workflows/echo.js" with this text:
      """
      export const meta = {name:"echo",description:"Echoes two fields."};

      return "who=" + args.who + " n=" + args.items.length;
      """
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user has reloaded pi
    Given the scripted model plays these steps:
      | reply        | tool     | arguments                                                   |
      |              | workflow | {"name":"demo:echo","args":{"who":"Ada","items":["a","b"]}} |
      | Run started. |          |                                                             |
    When the user prompts "Start the echo." and the model starts a workflow run
    Then the model receives these calls:
      | call | role        | text                                                                           |
      | 1    | user        | Start the echo.                                                                |
      | 2    | user        | Start the echo.                                                                |
      | 2    | assistant   | tool call workflow {"name":"demo:echo","args":{"who":"Ada","items":["a","b"]}} |
      | 2    | tool result | workflow returned: started the workflow echo                                   |
    Then the workflow run ends with the status "completed" and the result "who=Ada n=2"

  Scenario: A workflow that calls a sibling by its installed name returns the sibling's result
    Given the published plugin "demo" of the marketplace "fixtures" has the file "workflows/inner.js" with this text:
      """
      export const meta = {name:"inner",description:"Answers the outer workflow."};

      return "inner got " + args.word;
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file "workflows/outer.js" with this text:
      """
      export const meta = {name:"outer",description:"Calls the inner workflow."};

      const answer = await workflow("demo:inner", {word:"hi"});
      return "outer: " + answer;
      """
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user has reloaded pi
    When the user runs the workflow command "/demo:outer"
    Then the workflow run ends with the status "completed" and the result "outer: inner got hi"
    Then the workflow engine shows these notices:
      | notice              |
      | started /demo:outer |
