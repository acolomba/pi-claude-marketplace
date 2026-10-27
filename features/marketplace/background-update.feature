Feature: Marketplace background update

  Pi updates the plugins of autoupdate marketplaces in the background only in a tui session.
  The suite drives a real pseudoterminal and a headless RPC negative control in one sandbox,
  with local marketplaces in place of published ones.

  Scenario: A PTY backed TUI session is interactive and ready inside its sandbox
    When the user starts a tui session
    Then the tui session has an interactive terminal and is ready

  Scenario: The TUI background update refreshes an autoupdate marketplace and updates its plugin
    Given pi runs with the background update delay "0"
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install demo@tools --scope project"
    Given the user has run "/claude:plugin marketplace autoupdate tools --scope project"
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | demo | 1.10.0  |
    When the user sends the message "hello" in the tui session
    Then the tui session reports the notice "Plugin updated: demo · Run /reload to apply"
    When the user runs "/claude:plugin list"
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace details autoupdate | id         | name | status    | reasons | scope   | version |
      | tools            | project           | true                           | demo@tools | demo | installed |         | project | 1.10.0  |

  Scenario: The TUI background notice names a plugin once while both updated installs remain
    Given pi runs with the background update delay "0"
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "extras" is published as a dir source
    Given the marketplace "extras" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "tools" is added to the project scope
    Given the marketplace "extras" is added to the user scope
    Given the user has run "/claude:plugin install demo@tools --scope project"
    Given the user has run "/claude:plugin install demo@extras --scope user"
    Given the user has run "/claude:plugin marketplace autoupdate tools --scope project"
    Given the user has run "/claude:plugin marketplace autoupdate extras --scope user"
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | demo | 1.10.0  |
    Given the marketplace "extras" offers these plugins:
      | name | version |
      | demo | 1.10.0  |
    When the user sends the message "hello" in the tui session
    Then the tui session reports the notice "Plugin updated: demo · Run /reload to apply"
    When the user runs "/claude:plugin list"
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace details autoupdate | id          | name | status    | reasons | scope   | version |
      | extras           | user              | true                           | demo@extras | demo | installed |         | user    | 1.10.0  |
      | tools            | project           | true                           | demo@tools  | demo | installed |         | project | 1.10.0  |

  Scenario: A foreground command stops an in-flight background request within the wait cap
    Given pi runs with the background update delay "0"
    Given the git repository "ghp" holds these plugins:
      | name | version | path |
      | ghp  | 1.0.0   |      |
    Given the marketplace "tools" is published as a hosted source
    Given the marketplace "tools" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | ghp  | github      | ghp        | false  |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install ghp@tools --scope project"
    Given the user has run "/claude:plugin marketplace autoupdate tools --scope project"
    Given the git host holds the connection for the marketplace "tools"
    When the user runs a foreground plugin list while the tui background request is in flight
    Then the foreground plugin list stops the background request within the wait cap
    When the user runs "/claude:plugin list"
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace details autoupdate | id        | name | status    | reasons | scope   | version |
      | tools            | project           | true                           | ghp@tools | ghp  | installed |         | project | 1.0.0   |

  Scenario: A message in an RPC session leaves the plugins of an autoupdate marketplace as they are
    Given pi runs with the background update delay "0"
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install demo@tools --scope project"
    Given the user has run "/claude:plugin marketplace autoupdate tools --scope project"
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | demo | 1.10.0  |
    When the user sends the message "hello"
    Then the session reports no results
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
      | marketplace name | marketplace scope | marketplace details autoupdate | id         | name | status     | reasons | scope   | version |
      | tools            | project           | true                           | demo@tools | demo | upgradable |         | project | 1.0.0   |
