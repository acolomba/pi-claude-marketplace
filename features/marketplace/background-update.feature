Feature: Marketplace background update

  Pi updates the plugins of autoupdate marketplaces in the background only in a tui session.
  The suite drives a real pseudoterminal and a headless RPC negative control in one sandbox,
  with local marketplaces in place of published ones.

  Scenario: A PTY backed TUI session is interactive and ready inside its sandbox
    When the user starts a tui session
    Then the tui session has an interactive terminal and is ready

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
