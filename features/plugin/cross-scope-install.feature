Feature: Plugin cross-scope install

  A project install copies a user-scope marketplace into the project scope and
  declares it in the project's base config. Local stand-ins keep each run isolated.

  Scenario: Installing a plugin into the project scope declares the user-scope marketplace of its dependency in the project's base config
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | lib  | 1.0.0   |
    Given the marketplace "upstream" is published as a dir source
    Given the marketplace "upstream" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib@tools    |
    Given the marketplace "upstream" allows dependencies on the marketplace "tools"
    Given the marketplace "upstream" is added to the user scope
    Given the marketplace "tools" is added to the user scope
    When the user runs "/claude:plugin install app@upstream --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id           | name      | status    | reasons | scope   | version |
      | upstream         | project           | app@upstream | app       | installed |         | project | 1.0.0   |
      | upstream         | project           | lib@tools    | lib@tools | installed |         | project | 1.0.0   |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name     | source                       |
      | upstream | {home}/marketplaces/upstream |
      | tools    | {home}/marketplaces/tools    |
    Then the "claude-plugins.json" file of the project scope declares these plugins:
      | id           |
      | app@upstream |

  Scenario Outline: Installing a plugin into the project scope from a marketplace the user scope added declares that marketplace in the project's base config
    Given the marketplace "tools" is published as a <source kind> source
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "tools" is added to the user scope
    When the user runs "/claude:plugin install demo@tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id         | name | status    | reasons | scope   | version |
      | tools            | project           | demo@tools | demo | installed |         | project | 1.0.0   |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name  | source   |
      | tools | <source> |
    Then the "claude-plugins.json" file of the project scope declares these plugins:
      | id         |
      | demo@tools |

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
