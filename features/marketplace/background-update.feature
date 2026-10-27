Feature: Marketplace background update

  After the first message of a session, Pi refreshes each marketplace whose autoupdate is on,
  updates its plugins in the background, and then names what moved in one notice.
  The scenarios run the real extension in a headless Pi that waits no delay before the background
  update, with local marketplaces and a loopback https git host in place of published ones.

  Scenario Outline: The first message updates the plugins of every autoupdate marketplace and names them in one notice
    Given pi runs with the background update delay "0"
    Given the marketplace "tools" is published as a <source kind> source
    Given the marketplace "kit" is published as a <source kind> source
    Given the marketplace "tools" offers these plugins:
      | name  | version |
      | demo  | 1.0.0   |
      | extra | 1.0.0   |
    Given the marketplace "kit" offers these plugins:
      | name   | version |
      | helper | 1.0.0   |
    Given the marketplace "tools" is added to the project scope
    Given the marketplace "kit" is added to the user scope
    Given the user has run "/claude:plugin install demo@tools --scope project"
    Given the user has run "/claude:plugin install extra@tools --scope project"
    Given the user has run "/claude:plugin install helper@kit --scope user"
    Given the user has run "/claude:plugin marketplace autoupdate tools --scope project"
    Given the user has run "/claude:plugin marketplace autoupdate kit --scope user"
    Given the marketplace "tools" offers these plugins:
      | name  | version |
      | demo  | 1.10.0  |
      | extra | 2.0.0   |
    Given the marketplace "kit" offers these plugins:
      | name   | version |
      | helper | 1.1.0   |
    When the user sends the message "hello"
    Then the result has these fields:
      | kind         | background-update |
      | severity     | info              |
      | needs reload | true              |
    Then the result lists these plugins:
      | name   | marketplace | scope   | from version | to version |
      | demo   | tools       | project | 1.0.0        | 1.10.0     |
      | extra  | tools       | project | 1.0.0        | 2.0.0      |
      | helper | kit         | user    | 1.0.0        | 1.1.0      |
    When the user runs "/claude:plugin list"
    Then the result has these fields:
      | kind                | cascade     |
      | severity            | info        |
      | needs reload        | false       |
      | tally label         | Plugin list |
      | tally failures      | 0           |
      | tally warnings      | 0           |
      | tally success count | 3           |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace details autoupdate | id          | name   | status    | reasons | scope   | version |
      | kit              | user              | true                           | helper@kit  | helper | installed |         | user    | 1.1.0   |
      | tools            | project           | true                           | demo@tools  | demo   | installed |         | project | 1.10.0  |
      | tools            | project           | true                           | extra@tools | extra  | installed |         | project | 2.0.0   |

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
