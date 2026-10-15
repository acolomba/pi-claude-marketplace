Feature: Marketplace add

  Adding a marketplace records it in a scope under the name its manifest declares.
  The scenarios run the real extension in a headless Pi, read its JSON results,
  and use local marketplaces in place of published ones.

  Scenario Outline: Adding a marketplace records it in the chosen scope
    Given the marketplace "tools" is published as a <source kind> source
    When the user runs "/claude:plugin marketplace add <source> --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope   | status |
      | tools | project | added  |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name  | source   |
      | tools | <source> |

    Examples:
      | source kind | source                                                    |
      | dir         | {home}/marketplaces/tools                                 |
      | file        | {home}/marketplaces/tools/.claude-plugin/marketplace.json |

    @url
    Examples:
      | source kind | source                            |
      | url         | https://{git host}/acme/tools.git |

    @github
    Examples:
      | source kind | source     |
      | github      | acme/tools |

  Scenario: Adding a marketplace by a home-relative path keeps the ~ form in the user configuration
    Given the marketplace "tools" is published as a dir source
    When the user runs "/claude:plugin marketplace add ~/marketplaces/tools"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope | status |
      | tools | user  | added  |
    Then the "claude-plugins.json" file of the user scope declares these marketplaces:
      | name  | source               |
      | tools | ~/marketplaces/tools |

  Scenario Outline: An added marketplace is still listed in a new session
    Given the marketplace "tools" is published as a <source kind> source
    Given the marketplace "tools" is added to the project scope
    Given the user has started a new pi session
    When the user runs "/claude:plugin marketplace list"
    Then the result has these fields:
      | kind                | cascade          |
      | severity            | info             |
      | needs reload        | false            |
      | tally label         | Marketplace list |
      | tally failures      | 0                |
      | tally warnings      | 0                |
      | tally success count | 1                |
    Then the result lists these marketplaces:
      | name  | scope   | details autoupdate | details last updated at |
      | tools | project | false              | {scenario time}         |

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
