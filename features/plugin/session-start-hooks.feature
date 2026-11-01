Feature: Plugin session start hooks

  A session start hook of an installed plugin runs once for each new session, as in Claude Code.
  Pi binds the extension twice when an RPC client starts a new session, and the hook still runs once.

  Scenario: A new session runs the session start hook once
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | shp  | 1.0.0   |
    Given the published plugin "shp" of the marketplace "tools" has a session start hook that records each run in the project file "session-starts.log"
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install shp@tools --scope project"
    When the user starts a new pi session
    Then the project file "session-starts.log" records these session start hook runs:
      | session | source |
      | first   | clear  |

  Scenario: Each later session runs the session start hook again
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | shp  | 1.0.0   |
    Given the published plugin "shp" of the marketplace "tools" has a session start hook that records each run in the project file "session-starts.log"
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install shp@tools --scope project"
    Given the user has started a new pi session
    When the user starts a new pi session
    Then the project file "session-starts.log" records these session start hook runs:
      | session | source |
      | first   | clear  |
      | second  | clear  |
