Feature: Marketplace list

  The list shows every marketplace added to either scope.
  The scenarios run the real extension in a headless Pi and read its JSON results.

  Scenario: The list is empty when no marketplace is added
    When the user runs "/claude:plugin marketplace list"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists no marketplaces

  Scenario: The list groups project before user and keeps insertion order
    Given the marketplace "zulu" is published as a dir source
    Given the marketplace "yankee" is published as a dir source
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "bravo" is published as a dir source
    Given the marketplace "alpha" is published as a dir source
    Given the marketplace "bravo" is added to the user scope
    Given the marketplace "zulu" is added to the project scope
    Given the marketplace "alpha" is added to the user scope
    Given the marketplace "yankee" is added to the project scope
    Given the marketplace "tools" is added to the project scope
    Given the marketplace "tools" is added to the user scope
    Given the user has run "/claude:plugin marketplace autoupdate zulu --scope project"
    Given the user has run "/claude:plugin marketplace autoupdate tools --scope user"
    When the user runs "/claude:plugin marketplace list"
    Then the result has these fields:
      | kind                | cascade          |
      | severity            | info             |
      | needs reload        | false            |
      | tally label         | Marketplace list |
      | tally failures      | 0                |
      | tally warnings      | 0                |
      | tally success count | 6                |
    Then the result lists these marketplaces:
      | name   | scope   | details autoupdate | details last updated at |
      | zulu   | project | true               | {scenario time}         |
      | yankee | project | false              | {scenario time}         |
      | tools  | project | false              | {scenario time}         |
      | bravo  | user    | false              | {scenario time}         |
      | alpha  | user    | false              | {scenario time}         |
      | tools  | user    | true               | {scenario time}         |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name   | source                     | autoupdate |
      | zulu   | {home}/marketplaces/zulu   | true       |
      | yankee | {home}/marketplaces/yankee |            |
      | tools  | {home}/marketplaces/tools  |            |
    Then the "claude-plugins.json" file of the user scope declares these marketplaces:
      | name  | source                    | autoupdate |
      | bravo | {home}/marketplaces/bravo |            |
      | alpha | {home}/marketplaces/alpha |            |
      | tools | {home}/marketplaces/tools | true       |

  Scenario: The list shows the effective local autoupdate override
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin marketplace autoupdate tools --scope project"
    Given the user has run "/claude:plugin marketplace add {home}/marketplaces/tools --scope project --local"
    Given the user has run "/claude:plugin marketplace noautoupdate tools --scope project --local"
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
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name  | source                    | autoupdate |
      | tools | {home}/marketplaces/tools | true       |
    Then the "claude-plugins.local.json" file of the project scope declares these marketplaces:
      | name  | source                    | autoupdate |
      | tools | {home}/marketplaces/tools | false      |

  Scenario: The project filter omits user marketplaces
    Given the marketplace "zulu" is published as a dir source
    Given the marketplace "yankee" is published as a dir source
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "bravo" is published as a dir source
    Given the marketplace "alpha" is published as a dir source
    Given the marketplace "bravo" is added to the user scope
    Given the marketplace "zulu" is added to the project scope
    Given the marketplace "alpha" is added to the user scope
    Given the marketplace "yankee" is added to the project scope
    Given the marketplace "tools" is added to the project scope
    Given the marketplace "tools" is added to the user scope
    Given the user has run "/claude:plugin marketplace autoupdate zulu --scope project"
    Given the user has run "/claude:plugin marketplace autoupdate tools --scope user"
    When the user runs "/claude:plugin marketplace list --scope project"
    Then the result has these fields:
      | kind                | cascade          |
      | severity            | info             |
      | needs reload        | false            |
      | tally label         | Marketplace list |
      | tally failures      | 0                |
      | tally warnings      | 0                |
      | tally success count | 3                |
    Then the result lists these marketplaces:
      | name   | scope   | details autoupdate | details last updated at |
      | zulu   | project | true               | {scenario time}         |
      | yankee | project | false              | {scenario time}         |
      | tools  | project | false              | {scenario time}         |

  Scenario: The user filter omits project marketplaces
    Given the marketplace "zulu" is published as a dir source
    Given the marketplace "yankee" is published as a dir source
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "bravo" is published as a dir source
    Given the marketplace "alpha" is published as a dir source
    Given the marketplace "bravo" is added to the user scope
    Given the marketplace "zulu" is added to the project scope
    Given the marketplace "alpha" is added to the user scope
    Given the marketplace "yankee" is added to the project scope
    Given the marketplace "tools" is added to the project scope
    Given the marketplace "tools" is added to the user scope
    Given the user has run "/claude:plugin marketplace autoupdate zulu --scope project"
    Given the user has run "/claude:plugin marketplace autoupdate tools --scope user"
    When the user runs "/claude:plugin marketplace list --scope user"
    Then the result has these fields:
      | kind                | cascade          |
      | severity            | info             |
      | needs reload        | false            |
      | tally label         | Marketplace list |
      | tally failures      | 0                |
      | tally warnings      | 0                |
      | tally success count | 3                |
    Then the result lists these marketplaces:
      | name  | scope | details autoupdate | details last updated at |
      | bravo | user  | false              | {scenario time}         |
      | alpha | user  | false              | {scenario time}         |
      | tools | user  | true               | {scenario time}         |

  Scenario: The project filter is empty when only user has marketplaces
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" is added to the user scope
    When the user runs "/claude:plugin marketplace list --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists no marketplaces

  Scenario: The user filter is empty when only project has marketplaces
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" is added to the project scope
    When the user runs "/claude:plugin marketplace list --scope user"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists no marketplaces

  Scenario: The ls alias lists the populated inventory
    Given the marketplace "zulu" is published as a dir source
    Given the marketplace "yankee" is published as a dir source
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "bravo" is published as a dir source
    Given the marketplace "alpha" is published as a dir source
    Given the marketplace "bravo" is added to the user scope
    Given the marketplace "zulu" is added to the project scope
    Given the marketplace "alpha" is added to the user scope
    Given the marketplace "yankee" is added to the project scope
    Given the marketplace "tools" is added to the project scope
    Given the marketplace "tools" is added to the user scope
    Given the user has run "/claude:plugin marketplace autoupdate zulu --scope project"
    Given the user has run "/claude:plugin marketplace autoupdate tools --scope user"
    When the user runs "/claude:plugin marketplace ls"
    Then the result has these fields:
      | kind                | cascade          |
      | severity            | info             |
      | needs reload        | false            |
      | tally label         | Marketplace list |
      | tally failures      | 0                |
      | tally warnings      | 0                |
      | tally success count | 6                |
    Then the result lists these marketplaces:
      | name   | scope   | details autoupdate | details last updated at |
      | zulu   | project | true               | {scenario time}         |
      | yankee | project | false              | {scenario time}         |
      | tools  | project | false              | {scenario time}         |
      | bravo  | user    | false              | {scenario time}         |
      | alpha  | user    | false              | {scenario time}         |
      | tools  | user    | true               | {scenario time}         |

  Scenario: The ls alias is empty when no marketplace is added
    When the user runs "/claude:plugin marketplace ls"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists no marketplaces
