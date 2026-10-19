Feature: Marketplace update

  Updating a marketplace refreshes its manifest from its source.
  The scenarios run the real extension in a headless Pi and use local
  marketplaces in place of published ones.

  Scenario: A bare update reports one result per marketplace of both scopes, project first
    Given the marketplace "beta" is published as a dir source
    Given the marketplace "alpha" is published as a dir source
    Given the marketplace "gamma" is published as a dir source
    Given the marketplace "beta" is added to the user scope
    Given the marketplace "alpha" is added to the project scope
    Given the marketplace "gamma" is added to the project scope
    When the user runs "/claude:plugin marketplace update"
    Then the command reports these results:
      | kind    | severity | needs reload | tally label        | tally failures | tally warnings | tally success count |
      | cascade | info     | false        | Marketplace update | 0              | 0              | 1                   |
      | cascade | info     | false        | Marketplace update | 0              | 0              | 1                   |
      | cascade | info     | false        | Marketplace update | 0              | 0              | 1                   |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | marketplace status | marketplace reasons |
      | alpha            | project           | skipped            | up-to-date          |
      | gamma            | project           | skipped            | up-to-date          |
      | beta             | user              | skipped            | up-to-date          |

  Scenario Outline: An unchanged marketplace is up to date
    Given the marketplace "tools" is published as a <source kind> source
    Given the marketplace "tools" is added to the project scope
    When the user runs "/claude:plugin marketplace update"
    Then the result has these fields:
      | kind                | cascade            |
      | severity            | info               |
      | needs reload        | false              |
      | tally label         | Marketplace update |
      | tally failures      | 0                  |
      | tally warnings      | 0                  |
      | tally success count | 1                  |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | marketplace status | marketplace reasons |
      | tools            | project           | skipped            | up-to-date          |

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

  Scenario Outline: A changed marketplace refreshes without plugin rows
    Given the marketplace "tools" is published as a <source kind> source
    Given the marketplace "tools" is added to the project scope
    Given the marketplace "tools" update source contains this manifest:
      """
      {"name":"tools","owner":{"name":"features"},"plugins":[],"description":"Updated tools"}
      """
    When the user runs "/claude:plugin marketplace update"
    Then the result has these fields:
      | kind                | cascade            |
      | severity            | info               |
      | needs reload        | false              |
      | tally label         | Marketplace update |
      | tally failures      | 0                  |
      | tally warnings      | 0                  |
      | tally success count | 1                  |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | marketplace status |
      | tools            | project           | updated            |

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

  Scenario Outline: Whitespace and object key order do not change a marketplace
    Given the marketplace "tools" is published as a <source kind> source
    Given the marketplace "tools" has the "<rewrite>" comparison baseline
    Given the marketplace "tools" is added to the project scope
    Given the marketplace "tools" update source has the "<rewrite>" cosmetic rewrite
    When the user runs "/claude:plugin marketplace update"
    Then the result has these fields:
      | kind                | cascade            |
      | severity            | info               |
      | needs reload        | false              |
      | tally label         | Marketplace update |
      | tally failures      | 0                  |
      | tally warnings      | 0                  |
      | tally success count | 1                  |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | marketplace status | marketplace reasons |
      | tools            | project           | skipped            | up-to-date          |

    Examples:
      | source kind | rewrite       |
      | dir         | formatting    |
      | dir         | top-level keys |
      | dir         | nested keys   |
      | file        | formatting    |
      | file        | top-level keys |
      | file        | nested keys   |

    @url
    Examples:
      | source kind | rewrite    |
      | url         | formatting |

    @github
    Examples:
      | source kind | rewrite    |
      | github      | formatting |

  Scenario Outline: An unknown manifest field changes the marketplace
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" has the "<change>" comparison baseline
    Given the marketplace "tools" is added to the project scope
    Given the marketplace "tools" update source has the "<change>" semantic rewrite
    When the user runs "/claude:plugin marketplace update"
    Then the result has these fields:
      | kind                | cascade            |
      | severity            | info               |
      | needs reload        | false              |
      | tally label         | Marketplace update |
      | tally failures      | 0                  |
      | tally warnings      | 0                  |
      | tally success count | 1                  |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | marketplace status |
      | tools            | project           | updated            |

    Examples:
      | change                |
      | unknown field added   |
      | unknown field changed |
      | unknown field removed |

  Scenario Outline: Reordering a manifest array changes the marketplace
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" has the "<array>" comparison baseline
    Given the marketplace "tools" is added to the project scope
    Given the marketplace "tools" update source has the "<array>" semantic rewrite
    When the user runs "/claude:plugin marketplace update"
    Then the result has these fields:
      | kind                | cascade            |
      | severity            | info               |
      | needs reload        | false              |
      | tally label         | Marketplace update |
      | tally failures      | 0                  |
      | tally warnings      | 0                  |
      | tally success count | 1                  |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | marketplace status |
      | tools            | project           | updated            |

    Examples:
      | array                     |
      | plugin order              |
      | allowed marketplace order |
      | unknown array order       |

  Scenario: An isolated dependency entry retains its comparison fields
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" has the "isolated dependency fields" comparison baseline
    Given the marketplace "tools" is added to the project scope
    Given the marketplace "tools" update source has the "isolated dependency fields" semantic rewrite
    When the user runs "/claude:plugin marketplace update"
    Then the result has these fields:
      | kind                | cascade            |
      | severity            | info               |
      | needs reload        | false              |
      | tally label         | Marketplace update |
      | tally failures      | 0                  |
      | tally warnings      | 0                  |
      | tally success count | 1                  |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | marketplace status |
      | tools            | project           | updated            |
