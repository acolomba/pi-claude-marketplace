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
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which reported these notes on workflow scripts:
      | script | disposition                                         |
      | <file> | was installed but the engine will refuse to load it |
    Given the user has started a new pi session
    When the user runs the workflow command "<command>", which starts no run
    Then the workflow engine shows these notices:
      | severity | message   |
      | error    | <message> |

    Examples:
      | file        | script                                                                                                             | command        | message                                                                                                            |
      | late.js     | const greeting = "late"; export const meta = {name:"late",description:"Declares its meta late."}; return greeting; | /demo:late     | /demo:late failed: `export const meta = { name, description, phases }` must be the first statement in the script   |
      | reserved.js | export const meta = {name:"reserved",description:"Uses a reserved key.",constructor:"x"}; return "reserved";       | /demo:reserved | /demo:reserved failed: reserved key name not allowed in meta: constructor                                          |
      | nodesc.js   | export const meta = {name:"nodesc"}; return "nodesc";                                                              | /demo:nodesc   | /demo:nodesc failed: meta.description must be a non-empty string                                                   |
      | mutable.js  | export let meta = {name:"mutable",description:"Declares its meta with let."}; return "mutable";                    | /demo:mutable  | /demo:mutable failed: meta export must be `export const meta = ...`                                                |
      | hidden.js   | const meta = {name:"hidden",description:"Does not export its meta."}; return "hidden";                             | /demo:hidden   | /demo:hidden failed: `export const meta = { name, description, phases }` must be the first statement in the script |
      | pair.js     | export const meta = {name:"pair",description:"Declares two bindings."}, other = 1; return "pair";                  | /demo:pair     | /demo:pair failed: meta export must declare only `meta`                                                            |

  Scenario: Installing a plugin refuses a nondeterministic script and one that does not parse, which Claude Code refuses only when they run
    Given the published plugin "demo" of the marketplace "fixtures" has the file "workflows/clock.js" with this text:
      """
      export const meta = {name:"clock",description:"Tells the time."};

      return String(Date.now());
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file "workflows/broken.js" with this text:
      """
      export const meta = {name:"broken",description:"Does not parse."};

      return (;
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the workflow "hello" described as "Says hello." that returns "Hello from demo."
    Given the marketplace "fixtures" is added to the user scope
    When the user runs "/claude:plugin install demo@fixtures --scope user"
    Then the command reports these results:
      | kind       | severity | needs reload | header                                                            | lines                                                                                                                                                                                                                                                                  |
      | cascade    | info     | true         |                                                                   |                                                                                                                                                                                                                                                                        |
      | diagnostic | warning  | false        | Plugin "demo" [user] installed; 2 declared components have notes. | workflow script "broken.js" in "workflows" was refused: broken.js is not parseable JavaScript, so no name can be read from it, workflow script "clock.js" in "workflows" was refused: clock.js calls `Date.now`, which the workflow engine refuses as nondeterministic |
    Then the diagnostic reports these lines:
      | line                                                                                                                                    |
      | workflow script "broken.js" in "workflows" was refused: broken.js is not parseable JavaScript, so no name can be read from it           |
      | workflow script "clock.js" in "workflows" was refused: clock.js calls `Date.now`, which the workflow engine refuses as nondeterministic |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope | version |
      | fixtures         | user              | demo@fixtures | demo | installed |         | user  | 1.0.0   |

  Scenario: Installing a plugin skips a script with no meta and a script whose name is not a literal, as Claude Code does
    Given the published plugin "demo" of the marketplace "fixtures" has the file "workflows/helper.js" with this text:
      """
      const shout = (text) => text.toUpperCase();

      return shout("hi");
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file "workflows/dyn.js" with this text:
      """
      export const meta = {name:String("dyn"),description:"Has a computed name."};

      return "dyn";
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the workflow "hello" described as "Says hello." that returns "Hello from demo."
    Given the marketplace "fixtures" is added to the user scope
    When the user runs "/claude:plugin install demo@fixtures --scope user"
    Then the command reports these results:
      | kind       | severity | needs reload | header                                                            | lines                                                                                                                                                                                                                                                                   |
      | cascade    | info     | true         |                                                                   |                                                                                                                                                                                                                                                                         |
      | diagnostic | warning  | false        | Plugin "demo" [user] installed; 2 declared components have notes. | workflow script "dyn.js" in "workflows" was not installed: dyn.js declares no string-literal `meta.name`, so there is no command to install, workflow script "helper.js" in "workflows" was not installed: helper.js declares no `meta`, so there is nothing to install |
    Then the diagnostic reports these lines:
      | line                                                                                                                                        |
      | workflow script "dyn.js" in "workflows" was not installed: dyn.js declares no string-literal `meta.name`, so there is no command to install |
      | workflow script "helper.js" in "workflows" was not installed: helper.js declares no `meta`, so there is nothing to install                  |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope | version |
      | fixtures         | user              | demo@fixtures | demo | installed |         | user  | 1.0.0   |

  Scenario: Installing a plugin installs a script the engine will refuse with a note, where Claude Code skips it at load
    Given the published plugin "demo" of the marketplace "fixtures" has the file "workflows/late.js" with this text:
      """
      const greeting = "late";
      export const meta = {name:"late",description:"Declares its meta late."};

      return greeting;
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file "workflows/reserved.js" with this text:
      """
      export const meta = {name:"reserved",description:"Uses a reserved key.",constructor:"x"};

      return "reserved";
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file "workflows/nodesc.js" with this text:
      """
      export const meta = {name:"nodesc"};

      return "nodesc";
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the workflow "hello" described as "Says hello." that returns "Hello from demo."
    Given the marketplace "fixtures" is added to the user scope
    When the user runs "/claude:plugin install demo@fixtures --scope user"
    Then the command reports these results:
      | kind       | severity | needs reload | header                                                            | lines                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
      | cascade    | info     | true         |                                                                   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
      | diagnostic | warning  | false        | Plugin "demo" [user] installed; 3 declared components have notes. | workflow script "late.js" in "workflows" was installed but the engine will refuse to load it: the engine refuses at its check 3 -- `export const meta = ...` must be the first statement in the script, workflow script "nodesc.js" in "workflows" was installed but the engine will refuse to load it: the engine refuses at its check 9 -- `meta.description` must be a non-empty string, and `meta.model` (a string) and `meta.phases` (an array of objects each carrying a string `title`) must match those shapes wherever they are declared, workflow script "reserved.js" in "workflows" was installed but the engine will refuse to load it: the engine refuses at its check 8 -- every value inside `meta` must be a plain literal, so no spread, computed key, key written as anything but an identifier, string or number, method, accessor, reserved key name (`__proto__`, `constructor`, `prototype`), array hole, substituted template or computed expression |
    Then the diagnostic reports these lines:
      | line                                                                                                                                                                                                                                                                                                                                                                                                                      |
      | workflow script "late.js" in "workflows" was installed but the engine will refuse to load it: the engine refuses at its check 3 -- `export const meta = ...` must be the first statement in the script                                                                                                                                                                                                                    |
      | workflow script "nodesc.js" in "workflows" was installed but the engine will refuse to load it: the engine refuses at its check 9 -- `meta.description` must be a non-empty string, and `meta.model` (a string) and `meta.phases` (an array of objects each carrying a string `title`) must match those shapes wherever they are declared                                                                                 |
      | workflow script "reserved.js" in "workflows" was installed but the engine will refuse to load it: the engine refuses at its check 8 -- every value inside `meta` must be a plain literal, so no spread, computed key, key written as anything but an identifier, string or number, method, accessor, reserved key name (`__proto__`, `constructor`, `prototype`), array hole, substituted template or computed expression |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope | version |
      | fixtures         | user              | demo@fixtures | demo | installed |         | user  | 1.0.0   |

  Scenario: Installing a plugin whose workflow script the engine accepts reports no note
    Given the published plugin "demo" of the marketplace "fixtures" has the workflow "hello" described as "Says hello." that returns "Hello from demo."
    Given the marketplace "fixtures" is added to the user scope
    When the user runs "/claude:plugin install demo@fixtures --scope user"
    Then the command reports these results:
      | kind    | severity | needs reload |
      | cascade | info     | true         |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope | version |
      | fixtures         | user              | demo@fixtures | demo | installed |         | user  | 1.0.0   |

  Scenario: A new session offers a command for each installed script and none for a refused or skipped one
    Given the published plugin "demo" of the marketplace "fixtures" has the file "workflows/clock.js" with this text:
      """
      export const meta = {name:"clock",description:"Tells the time."};

      return String(Date.now());
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file "workflows/broken.js" with this text:
      """
      export const meta = {name:"broken",description:"Does not parse."};

      return (;
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file "workflows/helper.js" with this text:
      """
      const shout = (text) => text.toUpperCase();

      return shout("hi");
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file "workflows/dyn.js" with this text:
      """
      export const meta = {name:String("dyn"),description:"Has a computed name."};

      return "dyn";
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file "workflows/late.js" with this text:
      """
      const greeting = "late";
      export const meta = {name:"late",description:"Declares its meta late."};

      return greeting;
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file "workflows/reserved.js" with this text:
      """
      export const meta = {name:"reserved",description:"Uses a reserved key.",constructor:"x"};

      return "reserved";
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file "workflows/nodesc.js" with this text:
      """
      export const meta = {name:"nodesc"};

      return "nodesc";
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the workflow "hello" described as "Says hello." that returns "Hello from demo."
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which reported these notes on workflow scripts:
      | script      | disposition                                         |
      | broken.js   | was refused                                         |
      | clock.js    | was refused                                         |
      | dyn.js      | was not installed                                   |
      | helper.js   | was not installed                                   |
      | late.js     | was installed but the engine will refuse to load it |
      | nodesc.js   | was installed but the engine will refuse to load it |
      | reserved.js | was installed but the engine will refuse to load it |
    Given the user has started a new pi session
    When the user lists the slash commands pi offers
    Then pi offers these workflow commands:
      | command        | description                 |
      | /demo:hello    | Says hello.                 |
      | /demo:late     | Declares its meta late.     |
      | /demo:nodesc   | Saved workflow: demo:nodesc |
      | /demo:reserved | Uses a reserved key.        |
