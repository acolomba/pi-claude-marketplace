Feature: Plugin executables

  An enabled plugin's bin folder is on the PATH of Pi's bash tool, a project plugin's only in a
  project Pi trusts, and only when the folder exists (PG-CORE-06, PG-CORE-07). A scripted model
  stands in for a real model and a local marketplace for a published one.

  Scenario: The bash tool finds the executable of an enabled project plugin in a trusted project
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the executable file "bin/hello" with this text:
      """
      #!/bin/sh
      echo greeted
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply | tool | arguments                                                                       |
      |       | bash | {"command": "if command -v hello >/dev/null; then hello; else echo absent; fi"} |
      | Done. |      |                                                                                 |
    When the user prompts "run hello"
    Then the model receives these calls:
      | call | role        | text                                                                                          |
      | 1    | user        | run hello                                                                                     |
      | 2    | user        | run hello                                                                                     |
      | 2    | assistant   | tool call bash {"command":"if command -v hello >/dev/null; then hello; else echo absent; fi"} |
      | 2    | tool result | bash returned: greeted\n                                                                      |

  Scenario: The bash tool finds the executable of a user-scope plugin in a project the user marked do not trust (D-PG10-02)
    Given pi runs with the scripted model in a project the user marked "do not trust"
    Given the marketplace "mine" is published as a dir source
    Given the marketplace "mine" offers these plugins:
      | name     | version |
      | personal | 1.0.0   |
    Given the published plugin "personal" of the marketplace "mine" has the executable file "bin/hello" with this text:
      """
      #!/bin/sh
      echo greeted
      """
    Given the marketplace "mine" is added to the user scope
    Given the user has run "/claude:plugin install personal@mine --scope user"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply | tool | arguments                                                                       |
      |       | bash | {"command": "if command -v hello >/dev/null; then hello; else echo absent; fi"} |
      | Done. |      |                                                                                 |
    When the user prompts "run hello"
    Then the model receives these calls:
      | call | role        | text                                                                                          |
      | 1    | user        | run hello                                                                                     |
      | 2    | user        | run hello                                                                                     |
      | 2    | assistant   | tool call bash {"command":"if command -v hello >/dev/null; then hello; else echo absent; fi"} |
      | 2    | tool result | bash returned: greeted\n                                                                      |
