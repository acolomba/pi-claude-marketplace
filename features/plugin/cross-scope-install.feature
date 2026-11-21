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

  Scenario: Installing a plugin into the project scope replaces the leftover checkout that an interrupted add of the user-scope marketplace left (MA-12)
    Given the marketplace "tools" is published as a url source
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "tools" is added to the user scope
    Given the project scope holds a checkout of the marketplace "tools" that an interrupted add left
    When the user runs "/claude:plugin install demo@tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id         | name | status    | reasons | scope   | version |
      | tools            | project           | demo@tools | demo | installed |         | project | 1.0.0   |
    Then the checkout of the marketplace "tools" in the project scope holds these files:
      | file                                    |
      | .claude-plugin/marketplace.json         |
      | plugins/demo/.claude-plugin/plugin.json |
      | plugins/demo/skills/demo-skill/SKILL.md |
    Then the project scope holds these git clones:
      | clone       | origin                            | revision |
      | marketplace | https://{git host}/acme/tools.git |          |
    Then the git host receives these requests:
      | method | path                                              | status |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/tools.git/git-upload-pack                   | 200    |

  Scenario: Installing into the project scope a plugin that the user-scope marketplace does not list fails before the project clones the marketplace (WR-05, WR-07)
    Given the marketplace "tools" is published as a url source
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "tools" is added to the user scope
    Given the files of the user scope are remembered
    When the user runs "/claude:plugin install ghost@tools --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id          | name  | status | reasons         | scope   | leaks | rollback partial | cause chain                                      | cause truncated |
      | tools            | project           | ghost@tools | ghost | failed | not in manifest | project |       |                  | Plugin "ghost" not found in marketplace "tools". | false           |
    Then the git host receives no request
    Then the project scope holds no marketplace record
    Then the project scope holds no marketplace checkout
    Then the "claude-plugins.json" file of the project scope does not exist
    Then the files of the user scope are unchanged

  Scenario: Installing a plugin into the project scope refuses a directory of the user's own where the marketplace checkout goes and keeps it (MA-13)
    Given the marketplace "tools" is published as a url source
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "tools" is added to the user scope
    Given the project scope holds a directory of the user's own where the checkout of the marketplace "tools" goes
    Given the files of the user scope are remembered
    When the user runs "/claude:plugin install demo@tools --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id         | name | status | reasons     | scope   | leaks | rollback partial | cause chain                 | cause truncated |
      | tools            | project           | demo@tools | demo | failed | stale clone | project |       |                  | stale source clone at tools | false           |
    Then the checkout of the marketplace "tools" in the project scope holds these files:
      | file      |
      | notes.txt |
    Then the project scope holds no marketplace record
    Then the "claude-plugins.json" file of the project scope does not exist
    Then the files of the user scope are unchanged

  Scenario: Installing a plugin into the project scope reads its dependencies from the project's fresh checkout, not the older checkout of the user scope (D-MF-04)
    Given the marketplace "tools" is published as a url source
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | app  | 1.0.0   |
    Given the marketplace "tools" is added to the user scope
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib          |
      | lib  | 1.0.0   |              |
    When the user runs "/claude:plugin install app@tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name      | status    | reasons | scope   | version |
      | tools            | project           | app@tools | app       | installed |         | project | 1.0.0   |
      | tools            | project           | lib@tools | lib@tools | installed |         | project | 1.0.0   |
    Then the installation record of the project scope holds these plugins:
      | id        | version | enabled |
      | app@tools | 1.0.0   | true    |
      | lib@tools | 1.0.0   | true    |

  Scenario: Installing a plugin into the project scope adds the user-scope url marketplace of its dependency to the project, with a checkout in each scope (LAYER-07, D-MF-04)
    Given the marketplace "tools" is published as a url source
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
    Then the project scope holds these git clones:
      | clone       | origin                            | revision |
      | marketplace | https://{git host}/acme/tools.git |          |
    Then the user scope holds these git clones:
      | clone       | origin                            | revision |
      | marketplace | https://{git host}/acme/tools.git |          |
    Then the git host receives these requests:
      | method | path                                              | status |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/tools.git/git-upload-pack                   | 200    |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name     | source                            |
      | upstream | {home}/marketplaces/upstream      |
      | tools    | https://{git host}/acme/tools.git |
    Then the "claude-plugins.json" file of the project scope declares these plugins:
      | id           |
      | app@upstream |
