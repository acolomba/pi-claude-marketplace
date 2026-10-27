Feature: Marketplace background update

  After the first message of a session, Pi refreshes each marketplace whose autoupdate is on,
  updates its plugins in the background, and then names what moved in one notice.
  The scenarios run the real extension in a headless Pi that waits no delay before the background
  update, with local marketplaces and a loopback https git host in place of published ones.

  Scenario Outline: The first message updates the plugins of an autoupdate marketplace in the background
    Given pi runs with the background update delay "0"
    Given the marketplace "tools" is published as a <source kind> source
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
    Then the result has these fields:
      | kind         | background-update |
      | severity     | info              |
      | needs reload | true              |
    Then the result lists these plugins:
      | name | marketplace | scope   | from version | to version |
      | demo | tools       | project | 1.0.0        | 1.10.0     |
    When the user runs "/claude:plugin list --scope project"
    Then the result has these fields:
      | kind                | cascade     |
      | severity            | info        |
      | needs reload        | false       |
      | tally label         | Plugin list |
      | tally failures      | 0           |
      | tally warnings      | 0           |
      | tally success count | 1           |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace details autoupdate | id         | name | status    | reasons | scope   | version |
      | tools            | project           | true                           | demo@tools | demo | installed |         | project | 1.10.0  |

    Examples:
      | source kind |
      | dir         |
      | file        |

    @url
    Examples:
      | source kind |
      | url         |

    @github
    Examples:
      | source kind |
      | github      |
