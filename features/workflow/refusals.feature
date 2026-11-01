Feature: Workflow refusals

  An install reports each workflow script it cannot install as written, and
  the workflow engine refuses at run a script installed with a note. A
  scripted model stands in for a real one, and a local marketplace for a
  published one.

  Background:
    Given pi runs with the scripted model and these companions:
      | companion            |
      | pi-dynamic-workflows |
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |

  Scenario Outline: Running the command of a script installed with a note shows the engine's refusal and starts no run, where Claude Code skips the script at load
    Given the published plugin "demo" of the marketplace "fixtures" has the file "workflows/<file>" with this text:
      """
      <script>
      """
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which reported notes on workflow scripts of the plugin
    Given the user has started a new pi session
    When the user runs the workflow command "<command>", which starts no run
    Then the workflow engine shows these notices:
      | severity | message   |
      | error    | <message> |

    Examples:
      | file        | script                                                                                                             | command        | message                                                                                                          |
      | late.js     | const greeting = "late"; export const meta = {name:"late",description:"Declares its meta late."}; return greeting; | /demo:late     | /demo:late failed: `export const meta = { name, description, phases }` must be the first statement in the script |
      | reserved.js | export const meta = {name:"reserved",description:"Uses a reserved key.",constructor:"x"}; return "reserved";       | /demo:reserved | /demo:reserved failed: reserved key name not allowed in meta: constructor                                        |
      | nodesc.js   | export const meta = {name:"nodesc"}; return "nodesc";                                                              | /demo:nodesc   | /demo:nodesc failed: meta.description must be a non-empty string                                                 |
