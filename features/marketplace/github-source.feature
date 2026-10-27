Feature: Marketplace github source

  A github source is an owner/repo shorthand or a github.com URL. The scenarios
  point the GitHub base override at a loopback https git host, so Pi clones
  every GitHub source from it, and the host records every request it receives.

  Scenario: Adding a github marketplace clones it from the git host
    Given the marketplace "tools" is published as a github source
    When the user runs "/claude:plugin marketplace add acme/tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope   | status |
      | tools | project | added  |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name  | source     |
      | tools | acme/tools |
    Then the git host receives these requests:
      | method | path                                              | status |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/tools.git/git-upload-pack                   | 200    |

  Scenario Outline: Each spelling of a GitHub URL clones and shows the same repository
    Given the marketplace "tools" is published as a github source
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
    Then the git host receives these requests:
      | method | path                                              | status |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/tools.git/git-upload-pack                   | 200    |
    When the user runs "/claude:plugin marketplace info tools --scope project"
    Then the marketplace info result has these fields:
      | kind                    | marketplace-info |
      | name                    | tools            |
      | scope                   | project          |
      | details autoupdate      | false            |
      | details last updated at | {scenario time}  |
      | source kind             | github           |
      | source abs path         |                  |
      | source url              |                  |
      | source owner            | acme             |
      | source repo             | tools            |
      | source ref              |                  |
      | severity                | info             |
      | needs reload            | false            |

    Examples:
      | source                            |
      | https://github.com/acme/tools     |
      | https://GitHub.com/acme/tools     |
      | https://www.github.com/acme/tools |
      | https://github.com/acme/tools.git |
      | https://github.com/acme/tools/    |

  Scenario Outline: Adding a github marketplace at a ref clones that ref
    Given the marketplace "tools" is published as a github source
    Given the marketplace "tools" has the description "Tools for formatting"
    Given the branch "stable" of the marketplace "tools" has the description "Stable tools"
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
    Then the git host receives these requests:
      | method | path                                              | status |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/tools.git/git-upload-pack                   | 200    |
    When the user runs "/claude:plugin marketplace info tools --scope project"
    Then the marketplace info result has these fields:
      | kind                    | marketplace-info |
      | name                    | tools            |
      | scope                   | project          |
      | details autoupdate      | false            |
      | details last updated at | {scenario time}  |
      | source kind             | github           |
      | source abs path         |                  |
      | source url              |                  |
      | source owner            | acme             |
      | source repo             | tools            |
      | source ref              | stable           |
      | description             | Stable tools     |
      | severity                | info             |
      | needs reload            | false            |

    Examples:
      | source                               |
      | acme/tools@stable                    |
      | acme/tools#stable                    |
      | https://github.com/acme/tools#stable |

  Scenario: Adding a github marketplace at a ref that contains an @ clones that ref
    Given the marketplace "tools" is published as a github source
    Given the marketplace "tools" has the description "Tools for formatting"
    Given the branch "release@2026" of the marketplace "tools" has the description "Release tools"
    When the user runs "/claude:plugin marketplace add acme/tools@release@2026 --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope   | status |
      | tools | project | added  |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name  | source                  |
      | tools | acme/tools@release@2026 |
    Then the git host receives these requests:
      | method | path                                              | status |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/tools.git/git-upload-pack                   | 200    |

  Scenario: Info on a github marketplace added at a ref that contains an @ shows that ref and its catalog
    Given the marketplace "tools" is published as a github source
    Given the marketplace "tools" has the description "Tools for formatting"
    Given the branch "release@2026" of the marketplace "tools" has the description "Release tools"
    Given the user has run "/claude:plugin marketplace add acme/tools@release@2026 --scope project"
    When the user runs "/claude:plugin marketplace info tools --scope project"
    Then the marketplace info result has these fields:
      | kind                    | marketplace-info |
      | name                    | tools            |
      | scope                   | project          |
      | details autoupdate      | false            |
      | details last updated at | {scenario time}  |
      | source kind             | github           |
      | source abs path         |                  |
      | source url              |                  |
      | source owner            | acme             |
      | source repo             | tools            |
      | source ref              | release@2026     |
      | description             | Release tools    |
      | severity                | info             |
      | needs reload            | false            |
