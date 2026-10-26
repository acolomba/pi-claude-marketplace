Feature: Plugin install dependencies

  Installing a plugin also installs the plugins it declares as dependencies.
  The scenarios run the real extension in a headless Pi and use a local
  marketplace in place of a published one.

  Scenario: Installing a plugin whose dependency carries a version constraint installs the dependency too
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib@^1.0.0   |
      | lib  | 1.2.0   |              |
    Given the marketplace "tools" is added to the project scope
    When the user runs "/claude:plugin install app@tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name      | status    | reasons                 | scope   | version |
      | tools            | project           | app@tools | app       | installed |                         | project | 1.0.0   |
      | tools            | project           | lib@tools | lib@tools | installed | dependency current copy | project | 1.2.0   |
    When the user starts a new pi session
    Then the session offers these skills:
      | command          | description           |
      | /skill:app-skill | A skill of app 1.0.0. |
      | /skill:lib-skill | A skill of lib 1.2.0. |

  Scenario: Installing a plugin installs every plugin of its dependency chain
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib          |
      | lib  | 1.0.0   | base         |
      | base | 1.0.0   |              |
    Given the marketplace "tools" is added to the project scope
    When the user runs "/claude:plugin install app@tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id         | name       | status    | reasons | scope   | version |
      | tools            | project           | app@tools  | app        | installed |         | project | 1.0.0   |
      | tools            | project           | base@tools | base@tools | installed |         | project | 1.0.0   |
      | tools            | project           | lib@tools  | lib@tools  | installed |         | project | 1.0.0   |
    Then the installation record of the project scope holds these plugins:
      | id         | version | enabled |
      | app@tools  | 1.0.0   | true    |
      | base@tools | 1.0.0   | true    |
      | lib@tools  | 1.0.0   | true    |
    Then the "claude-plugins.json" file of the project scope declares these plugins:
      | id        |
      | app@tools |

  Scenario: A new session offers the skills of every plugin of an installed dependency chain
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib          |
      | lib  | 1.0.0   | base         |
      | base | 1.0.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install app@tools --scope project"
    When the user starts a new pi session
    Then the session offers these skills:
      | command           | description            |
      | /skill:app-skill  | A skill of app 1.0.0.  |
      | /skill:base-skill | A skill of base 1.0.0. |
      | /skill:lib-skill  | A skill of lib 1.0.0.  |

  Scenario: Installing a plugin with a dependency its marketplace does not offer fails as not in manifest and installs nothing
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib          |
      | lib  | 1.0.0   | base         |
    Given the marketplace "tools" is added to the project scope
    When the user runs "/claude:plugin install app@tools --scope project"
    Then the result has these fields:
      | kind         | cascade                             |
      | severity     | error                               |
      | needs reload | false                               |
      | summary      | Some plugin operations have failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id         | name       | status | reasons           | scope   | cause chain                                                 | cause truncated | leaks | rollback partial |
      | tools            | project           | app@tools  | app        | failed | dependency failed | project |                                                             |                 |       |                  |
      | tools            | project           | base@tools | base@tools | failed | not in manifest   | project | Dependency "base@tools" is not declared by its marketplace. | false           |       |                  |
    Then the project scope has no installed plugins
    Then the "claude-plugins.json" file of the project scope declares no plugins

  Scenario: The plugin list shows every offered plugin of a failed dependency chain as available
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib          |
      | lib  | 1.0.0   | base         |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install app@tools --scope project", which failed
    When the user runs "/claude:plugin list --scope project"
    Then the result has these fields:
      | kind                | cascade     |
      | severity            | info        |
      | needs reload        | false       |
      | tally label         | Plugin list |
      | tally failures      | 0           |
      | tally warnings      | 0           |
      | tally success count | 2           |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name | status    | reasons | version |
      | tools            | project           | app@tools | app  | available |         | 1.0.0   |
      | tools            | project           | lib@tools | lib  | available |         | 1.0.0   |

  Scenario: A new session after a failed dependency chain offers no skills
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib          |
      | lib  | 1.0.0   | base         |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install app@tools --scope project", which failed
    When the user starts a new pi session
    Then the session offers no skills

  Scenario: Installing a plugin whose dependencies ask for versions that do not overlap fails as a version conflict and installs nothing
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies    |
      | app  | 1.0.0   | lib@^1.0.0, mid |
      | mid  | 1.0.0   | lib@^2.0.0      |
      | lib  | 1.2.0   |                 |
    Given the marketplace "tools" is added to the project scope
    When the user runs "/claude:plugin install app@tools --scope project"
    Then the result has these fields:
      | kind         | cascade                             |
      | severity     | error                               |
      | needs reload | false                               |
      | summary      | Some plugin operations have failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name      | status | reasons           | scope   | cause chain                                                                                                               | cause truncated | leaks | rollback partial |
      | tools            | project           | app@tools | app       | failed | dependency failed | project |                                                                                                                           |                 |       |                  |
      | tools            | project           | lib@tools | lib@tools | failed | version conflict  | project | Dependency "lib@tools" has contradictory version constraints ^1.0.0, ^2.0.0 (no version satisfies all 2 declared ranges). | false           |       |                  |
    Then the project scope has no installed plugins
    Then the "claude-plugins.json" file of the project scope declares no plugins

  Scenario: Installing a plugin whose installed dependency is outside its version constraint moves the dependency first
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | lib  | 1.2.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install lib@tools --scope project"
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib@^2.0.0   |
      | lib  | 2.0.0   |              |
    When the user runs "/claude:plugin install app@tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name      | status    | reasons                 | scope   | version | from  | to    | cause chain                                                           | cause truncated | leaks | rollback partial |
      | tools            | project           | app@tools | app       | installed |                         | project | 1.0.0   |       |       |                                                                       |                 |       |                  |
      | tools            | project           | lib@tools | lib@tools | updated   | dependency current copy | project |         | 1.2.0 | 2.0.0 | constrained to the combined range (^2.0.0) -- required by "app@tools" | false           |       |                  |
    Then the installation record of the project scope holds these plugins:
      | id        | version | enabled |
      | app@tools | 1.0.0   | true    |
      | lib@tools | 2.0.0   | true    |
    When the user starts a new pi session
    Then the session offers these skills:
      | command          | description           |
      | /skill:app-skill | A skill of app 1.0.0. |
      | /skill:lib-skill | A skill of lib 2.0.0. |

  Scenario: Installing a plugin whose installed dependency no release moves inside its version constraint fails as a version conflict and keeps only the dependency
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib@^2.0.0   |
      | lib  | 1.2.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install lib@tools --scope project"
    When the user runs "/claude:plugin install app@tools --scope project"
    Then the result has these fields:
      | kind         | cascade                             |
      | severity     | error                               |
      | needs reload | false                               |
      | summary      | Some plugin operations have failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name      | status | reasons                             | scope   | version | cause chain                                                                                                                                                                                          | cause truncated | leaks | rollback partial |
      | tools            | project           | app@tools | app       | failed | dependency failed                   | project |         |                                                                                                                                                                                                      |                 |       |                  |
      | tools            | project           | lib@tools | lib@tools | failed | already installed, version conflict | project | 1.2.0   | Dependency "lib@tools" is installed at version 1.2.0, which does not satisfy ^2.0.0, and cannot move: version 1.2.0 falls outside what the combined range admits (^2.0.0) -- required by "app@tools" | false           |       |                  |
    Then the installation record of the project scope holds these plugins:
      | id        | version | enabled |
      | lib@tools | 1.2.0   | true    |
    Then the project scope stages these skills and prompts:
      | kind  | name      |
      | skill | lib-skill |
    Then the "claude-plugins.json" file of the project scope declares these plugins:
      | id        |
      | lib@tools |

  Scenario: Installing a plugin whose installed dependency another plugin holds outside its version constraint fails as a version conflict and changes nothing
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name  | version | dependencies |
      | other | 1.0.0   | lib@^1.0.0   |
      | lib   | 1.2.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install other@tools --scope project"
    Given the marketplace "tools" offers these plugins with dependencies:
      | name  | version | dependencies |
      | app   | 1.0.0   | lib@^2.0.0   |
      | other | 1.0.0   | lib@^1.0.0   |
      | lib   | 2.0.0   |              |
    When the user runs "/claude:plugin install app@tools --scope project"
    Then the result has these fields:
      | kind         | cascade                             |
      | severity     | error                               |
      | needs reload | false                               |
      | summary      | Some plugin operations have failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name      | status | reasons                             | scope   | version | cause chain                                                                                                                                                                                                     | cause truncated | leaks | rollback partial |
      | tools            | project           | app@tools | app       | failed | dependency failed                   | project |         |                                                                                                                                                                                                                 |                 |       |                  |
      | tools            | project           | lib@tools | lib@tools | failed | already installed, version conflict | project | 1.2.0   | Dependency "lib@tools" is installed at version 1.2.0, which does not satisfy ^2.0.0, and cannot move: the declared ranges admit no version in common (^2.0.0, ^1.0.0) -- required by "app@tools", "other@tools" | false           |       |                  |
    Then the installation record of the project scope holds these plugins:
      | id          | version | enabled |
      | lib@tools   | 1.2.0   | true    |
      | other@tools | 1.0.0   | true    |

  Scenario: The plugin list shows every plugin of a dependency chain with conflicting versions as available
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies    |
      | app  | 1.0.0   | lib@^1.0.0, mid |
      | mid  | 1.0.0   | lib@^2.0.0      |
      | lib  | 1.2.0   |                 |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install app@tools --scope project", which failed
    When the user runs "/claude:plugin list --scope project"
    Then the result has these fields:
      | kind                | cascade     |
      | severity            | info        |
      | needs reload        | false       |
      | tally label         | Plugin list |
      | tally failures      | 0           |
      | tally warnings      | 0           |
      | tally success count | 3           |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name | status    | reasons | version |
      | tools            | project           | app@tools | app  | available |         | 1.0.0   |
      | tools            | project           | lib@tools | lib  | available |         | 1.2.0   |
      | tools            | project           | mid@tools | mid  | available |         | 1.0.0   |

  Scenario: A new session after a dependency chain with conflicting versions failed offers no skills
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies    |
      | app  | 1.0.0   | lib@^1.0.0, mid |
      | mid  | 1.0.0   | lib@^2.0.0      |
      | lib  | 1.2.0   |                 |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install app@tools --scope project", which failed
    When the user starts a new pi session
    Then the session offers no skills

  Scenario: A new session after a version conflict with an installed dependency offers only the skills of the dependency
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib@^2.0.0   |
      | lib  | 1.2.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install lib@tools --scope project"
    Given the user has run "/claude:plugin install app@tools --scope project", which failed
    When the user starts a new pi session
    Then the session offers these skills:
      | command          | description           |
      | /skill:lib-skill | A skill of lib 1.2.0. |
