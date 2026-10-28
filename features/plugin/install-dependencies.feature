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
      | tools            | project           | lib@tools  | lib@tools  | failed | dependency failed | project |                                                             |                 |       |                  |
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

  Scenario: A root ledger failure lists every resolved dependency that did not install
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | aaa, zzz     |
      | aaa  | 1.0.0   |              |
      | zzz  | 1.0.0   |              |
    Given the published plugin "app" of the marketplace "tools" has an unreadable skill file
    Given the marketplace "tools" is added to the project scope
    When the user runs "/claude:plugin install app@tools --scope project"
    Then the result has these fields:
      | kind         | cascade                             |
      | severity     | error                               |
      | needs reload | false                               |
      | summary      | Some plugin operations have failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name      | status | reasons           | scope   | version | cause chain                        | cause truncated | leaks | rollback partial |
      | tools            | project           | aaa@tools | aaa@tools | failed | dependency failed | project |         |                                    |                 |       |                  |
      | tools            | project           | app@tools | app       | failed |                   | project | 1.0.0   | {unreadable skill file copy error} | false           |       |                  |
      | tools            | project           | zzz@tools | zzz@tools | failed | dependency failed | project |         |                                    |                 |       |                  |
    Then the project scope has no installed plugins
    Then the "claude-plugins.json" file of the project scope declares no plugins

  Scenario: A catalog failure mid walk lists the members already resolved
    Given the marketplace "other" is published as a dir source
    Given the marketplace "other" offers these plugins with dependencies:
      | name | version | dependencies |
      | zzz  | 1.0.0   |              |
    Given the marketplace "other" is added to the project scope
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies   |
      | app  | 1.0.0   | aaa, zzz@other |
      | aaa  | 1.0.0   |                |
    Given the marketplace "tools" allows dependencies on the marketplace "other"
    Given the marketplace "tools" is added to the project scope
    Given the manifest of the marketplace "other" is no longer valid json
    When the user runs "/claude:plugin install app@tools --scope project"
    Then the result has these fields:
      | kind         | cascade                             |
      | severity     | error                               |
      | needs reload | false                               |
      | summary      | Some plugin operations have failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name      | status | reasons           | scope   | cause chain                                                                                                                                                                                                             | cause truncated | leaks | rollback partial |
      | tools            | project           | aaa@tools | aaa@tools | failed | dependency failed | project |                                                                                                                                                                                                                         |                 |       |                  |
      | tools            | project           | app@tools | app       | failed | dependency failed | project |                                                                                                                                                                                                                         |                 |       |                  |
      | tools            | project           | zzz@other | zzz@other | failed |                   | project | marketplace.json is not valid JSON: SyntaxError: Expected ',' or '}' after property value in JSON at position 56 (line 1 column 57), Expected ',' or '}' after property value in JSON at position 56 (line 1 column 57) | false           |       |                  |
    Then the project scope has no installed plugins

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
      | tools            | project           | mid@tools | mid@tools | failed | dependency failed | project |                                                                                                                           |                 |       |                  |
    Then the project scope has no installed plugins
    Then the "claude-plugins.json" file of the project scope declares no plugins

  Scenario: Installing a plugin whose dependencies ask for long versions that do not overlap shows the ranges cut to 200 characters in the version conflict
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name  | version | dependencies                                                                          |
      | app   | 1.0.0   | lib@^1.0.0-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa, one, two, three |
      | one   | 1.0.0   | lib@^2.0.0-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa                  |
      | two   | 1.0.0   | lib@^3.0.0-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa                  |
      | three | 1.0.0   | lib@^4.0.0-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa                  |
      | lib   | 1.2.0   |                                                                                       |
    Given the marketplace "tools" is added to the project scope
    When the user runs "/claude:plugin install app@tools --scope project"
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id          | name        | status | reasons           | scope   | cause chain                                                                                                                                                                                                                                                                                                                      | cause truncated | leaks | rollback partial |
      | tools            | project           | app@tools   | app         | failed | dependency failed | project |                                                                                                                                                                                                                                                                                                                                  |                 |       |                  |
      | tools            | project           | lib@tools   | lib@tools   | failed | version conflict  | project | Dependency "lib@tools" has contradictory version constraints ^1.0.0-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa, ^2.0.0-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa, ^3.0.0-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa, ^4… (+62 chars) (no version satisfies all 4 declared ranges). | false           |       |                  |
      | tools            | project           | one@tools   | one@tools   | failed | dependency failed | project |                                                                                                                                                                                                                                                                                                                                  |                 |       |                  |
      | tools            | project           | three@tools | three@tools | failed | dependency failed | project |                                                                                                                                                                                                                                                                                                                                  |                 |       |                  |
      | tools            | project           | two@tools   | two@tools   | failed | dependency failed | project |                                                                                                                                                                                                                                                                                                                                  |                 |       |                  |
    Then the project scope has no installed plugins

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
      | marketplace name | marketplace scope | id        | name      | status | reasons                             | scope   | version | cause chain                                                                                                                                                                                                                                                                | cause truncated | leaks | rollback partial |
      | tools            | project           | app@tools | app       | failed | dependency failed                   | project |         |                                                                                                                                                                                                                                                                            |                 |       |                  |
      | tools            | project           | lib@tools | lib@tools | failed | already installed, version conflict | project | 1.2.0   | Dependency "lib@tools" is installed at version 1.2.0, which does not satisfy ^2.0.0, and cannot move: version 1.2.0 falls outside what the combined range admits (^2.0.0) -- required by "app@tools". To look for a version in range, run /claude:plugin update lib@tools. | false           |       |                  |
    Then the installation record of the project scope holds these plugins:
      | id        | version | enabled |
      | lib@tools | 1.2.0   | true    |
    Then the project scope stages these skills and prompts:
      | kind  | name      |
      | skill | lib-skill |
    Then the "claude-plugins.json" file of the project scope declares these plugins:
      | id        |
      | lib@tools |

  Scenario: Installing a plugin whose installed dependency records a very long version shows the version cut to 64 characters in the version conflict
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version                                                                          | dependencies |
      | app  | 1.0.0                                                                            | lib@^2.0.0   |
      | lib  | 1.2.0-zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install lib@tools --scope project"
    When the user runs "/claude:plugin install app@tools --scope project"
    Then the result has these fields:
      | kind         | cascade                             |
      | severity     | error                               |
      | needs reload | false                               |
      | summary      | Some plugin operations have failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name      | status | reasons                             | scope   | version                                                                          | cause chain                                                                                                                                                                                                                                                                                                                                                                                        | cause truncated | leaks | rollback partial |
      | tools            | project           | app@tools | app       | failed | dependency failed                   | project |                                                                                  |                                                                                                                                                                                                                                                                                                                                                                                                    |                 |       |                  |
      | tools            | project           | lib@tools | lib@tools | failed | already installed, version conflict | project | 1.2.0-zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz | Dependency "lib@tools" is installed at version 1.2.0-zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz…, which does not satisfy ^2.0.0, and cannot move: version 1.2.0-zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz… falls outside what the combined range admits (^2.0.0) -- required by "app@tools". To look for a version in range, run /claude:plugin update lib@tools. | false           |       |                  |
    Then the installation record of the project scope holds these plugins:
      | id        | version                                                                          | enabled |
      | lib@tools | 1.2.0-zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz | true    |

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
      | marketplace name | marketplace scope | id        | name      | status | reasons                             | scope   | version | cause chain                                                                                                                                                                                                                                                                           | cause truncated | leaks | rollback partial |
      | tools            | project           | app@tools | app       | failed | dependency failed                   | project |         |                                                                                                                                                                                                                                                                                       |                 |       |                  |
      | tools            | project           | lib@tools | lib@tools | failed | already installed, version conflict | project | 1.2.0   | Dependency "lib@tools" is installed at version 1.2.0, which does not satisfy ^2.0.0, and cannot move: the declared ranges admit no version in common (^2.0.0, ^1.0.0) -- required by "app@tools", "other@tools". To look for a version in range, run /claude:plugin update lib@tools. | false           |       |                  |
    Then the installation record of the project scope holds these plugins:
      | id          | version | enabled |
      | lib@tools   | 1.2.0   | true    |
      | other@tools | 1.0.0   | true    |
    Then the project scope stages these skills and prompts:
      | kind  | name        |
      | skill | lib-skill   |
      | skill | other-skill |
    Then the "claude-plugins.json" file of the project scope declares these plugins:
      | id          |
      | other@tools |

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

  Scenario: Installing a plugin whose installed git-source dependency a release tag moves into range moves the dependency first
    Given the git repository "lib" holds these plugins:
      | name | version | path |
      | lib  | 1.0.0   |      |
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | lib  | url         | lib        | false  |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install lib@tools --scope project"
    Given the git repository "lib" has a revision only the tag "lib--v2.0.0" reaches, holding these plugins:
      | name | version | path |
      | lib  | 2.0.0   |      |
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib@^2.0.0   |
    Given the marketplace "tools" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | lib  | url         | lib        | false  |
    When the user runs "/claude:plugin install app@tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name      | status    | reasons | scope   | version | from  | to                     | cause chain                                                                               | cause truncated | leaks | rollback partial |
      | tools            | project           | app@tools | app       | installed |         | project | 1.0.0   |       |                        |                                                                                           |                 |       |                  |
      | tools            | project           | lib@tools | lib@tools | updated   |         | project |         | 1.0.0 | 2.0.0-{lib revision 2} | already the highest version the combined range admits (^2.0.0) -- required by "app@tools" | false           |       |                  |
    Then the installation record of the project scope holds these plugins:
      | id        | version                | enabled |
      | app@tools | 1.0.0                  | true    |
      | lib@tools | 2.0.0-{lib revision 2} | true    |

  Scenario: Installing a plugin whose installed git-source dependency cannot move while the git host drops the connection names the update that looks for a version in range
    Given the git repository "lib" holds these plugins:
      | name | version | path |
      | lib  | 1.0.0   |      |
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | lib  | url         | lib        | false  |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install lib@tools --scope project"
    Given the git repository "lib" has a revision only the tag "lib--v2.0.0" reaches, holding these plugins:
      | name | version | path |
      | lib  | 2.0.0   |      |
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib@^2.0.0   |
    Given the marketplace "tools" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | lib  | url         | lib        | false  |
    Given the git host drops the connection for the plugin "lib"
    When the user runs "/claude:plugin install app@tools --scope project"
    Then the result has these fields:
      | kind         | cascade                             |
      | severity     | error                               |
      | needs reload | false                               |
      | summary      | Some plugin operations have failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name      | status | reasons                             | scope   | version | cause chain                                                                                                                                                                                                                                                       | cause truncated | leaks | rollback partial |
      | tools            | project           | app@tools | app       | failed | dependency failed                   | project |         |                                                                                                                                                                                                                                                                   |                 |       |                  |
      | tools            | project           | lib@tools | lib@tools | failed | already installed, version conflict | project | 1.0.0   | Dependency "lib@tools" is installed at version 1.0.0, which does not satisfy ^2.0.0, and cannot move: the release tags could not be listed (network unreachable) -- required by "app@tools". To look for a version in range, run /claude:plugin update lib@tools. | false           |       |                  |
    Then the installation record of the project scope holds these plugins:
      | id        | version | enabled |
      | lib@tools | 1.0.0   | true    |

  Scenario: Installing a plugin records a git-source dependency installed at a release tag with the tag's commit
    Given the git repository "lib" holds these plugins:
      | name | version | path |
      | lib  | 1.0.0   |      |
    Given the git repository "lib" has a revision only the tag "lib--v2.0.0" reaches, holding these plugins:
      | name | version | path |
      | lib  | 2.0.0   |      |
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib@^2.0.0   |
    Given the marketplace "tools" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | lib  | url         | lib        | false  |
    Given the marketplace "tools" is added to the project scope
    When the user runs "/claude:plugin install app@tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name      | status    | reasons | scope   | version                |
      | tools            | project           | app@tools | app       | installed |         | project | 1.0.0                  |
      | tools            | project           | lib@tools | lib@tools | installed |         | project | 2.0.0-{lib revision 2} |
    Then the installation record of the project scope holds these plugins:
      | id        | version                | enabled |
      | app@tools | 1.0.0                  | true    |
      | lib@tools | 2.0.0-{lib revision 2} | true    |

  Scenario: Installing a second plugin that asks for a dependency's range leaves the dependency recorded at its release tag in place
    Given the git repository "lib" holds these plugins:
      | name | version | path |
      | lib  | 1.0.0   |      |
    Given the git repository "lib" has a revision only the tag "lib--v2.0.0" reaches, holding these plugins:
      | name | version | path |
      | lib  | 2.0.0   |      |
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib@^2.0.0   |
      | ext  | 1.0.0   | lib (~2.0.0) |
    Given the marketplace "tools" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | lib  | url         | lib        | false  |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install app@tools --scope project"
    When the user runs "/claude:plugin install ext@tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name      | status    | reasons           | scope   | version                |
      | tools            | project           | ext@tools | ext       | installed |                   | project | 1.0.0                  |
      | tools            | project           | lib@tools | lib@tools | skipped   | already installed | project | 2.0.0-{lib revision 2} |
    Then the installation record of the project scope holds these plugins:
      | id        | version                | enabled |
      | app@tools | 1.0.0                  | true    |
      | ext@tools | 1.0.0                  | true    |
      | lib@tools | 2.0.0-{lib revision 2} | true    |

  Scenario: Installing a plugin whose anthropic-plugin-directory dependency carries a version constraint installs the dependency's listed copy, not a release tag
    Given the git repository "dirp" holds these plugins:
      | name | version | path |
      | dirp | 1.0.0   |      |
    Given the git repository "dirp" has a revision only the tag "dirp--v1.5.0" reaches, holding these plugins:
      | name | version | path |
      | dirp | 1.5.0   |      |
    Given the marketplace "anthropic-plugin-directory" is published by the anthropics organization
    Given the marketplace "anthropic-plugin-directory" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | dirp@^1.0.0  |
    Given the marketplace "anthropic-plugin-directory" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | dirp | url         | dirp       | false  |
    Given the marketplace "anthropic-plugin-directory" is added to the project scope
    When the user runs "/claude:plugin install app@anthropic-plugin-directory --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name           | marketplace scope | id                              | name                            | status    | reasons | scope   | version |
      | anthropic-plugin-directory | project           | app@anthropic-plugin-directory  | app                             | installed |         | project | 1.0.0   |
      | anthropic-plugin-directory | project           | dirp@anthropic-plugin-directory | dirp@anthropic-plugin-directory | installed |         | project | 1.0.0   |
    Then the installation record of the project scope holds these plugins:
      | id                              | version | enabled |
      | app@anthropic-plugin-directory  | 1.0.0   | true    |
      | dirp@anthropic-plugin-directory | 1.0.0   | true    |

  Scenario: Installing a plugin whose anthropic-plugin-directory dependency's listed copy is outside its version constraint fails as a version conflict and installs nothing
    Given the git repository "dirp" holds these plugins:
      | name | version | path |
      | dirp | 1.0.0   |      |
    Given the git repository "dirp" has a revision only the tag "dirp--v2.0.0" reaches, holding these plugins:
      | name | version | path |
      | dirp | 2.0.0   |      |
    Given the marketplace "anthropic-plugin-directory" is published by the anthropics organization
    Given the marketplace "anthropic-plugin-directory" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | dirp@^2.0.0  |
    Given the marketplace "anthropic-plugin-directory" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | dirp | url         | dirp       | false  |
    Given the marketplace "anthropic-plugin-directory" is added to the project scope
    When the user runs "/claude:plugin install app@anthropic-plugin-directory --scope project"
    Then the result has these fields:
      | kind         | cascade                             |
      | severity     | error                               |
      | needs reload | false                               |
      | summary      | Some plugin operations have failed. |
    Then the result lists these plugins:
      | marketplace name           | marketplace scope | id                              | name                            | status | reasons           | scope   | cause chain                                                                                                                          | cause truncated | leaks | rollback partial |
      | anthropic-plugin-directory | project           | app@anthropic-plugin-directory  | app                             | failed | dependency failed | project |                                                                                                                                      |                 |       |                  |
      | anthropic-plugin-directory | project           | dirp@anthropic-plugin-directory | dirp@anthropic-plugin-directory | failed | version conflict  | project | "dirp" from the Anthropic Directory is pinned to its listed commit (version 1.0.0), which does not satisfy ^2.0.0 required by "app". | false           |       |                  |
    Then the project scope has no installed plugins

  Scenario: Installing a plugin whose second dependency fails to install lists the dependency it rolled back as failed
    Given the git repository "dirp" holds these plugins:
      | name | version | path |
      | dirp | 1.0.0   |      |
    Given the git repository "dirp" has a revision only the tag "dirp--v2.0.0" reaches, holding these plugins:
      | name | version | path |
      | dirp | 2.0.0   |      |
    Given the marketplace "anthropic-plugin-directory" is published by the anthropics organization
    Given the marketplace "anthropic-plugin-directory" offers these plugins with dependencies:
      | name | version | dependencies     |
      | app  | 1.0.0   | mid, dirp@^2.0.0 |
      | mid  | 1.0.0   |                  |
    Given the marketplace "anthropic-plugin-directory" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | dirp | url         | dirp       | false  |
    Given the marketplace "anthropic-plugin-directory" is added to the project scope
    When the user runs "/claude:plugin install app@anthropic-plugin-directory --scope project"
    Then the result has these fields:
      | kind         | cascade                             |
      | severity     | error                               |
      | needs reload | false                               |
      | summary      | Some plugin operations have failed. |
    Then the result lists these plugins:
      | marketplace name           | marketplace scope | id                              | name                            | status | reasons           | scope   | cause chain                                                                                                                          | cause truncated | leaks | rollback partial |
      | anthropic-plugin-directory | project           | app@anthropic-plugin-directory  | app                             | failed | dependency failed | project |                                                                                                                                      |                 |       |                  |
      | anthropic-plugin-directory | project           | dirp@anthropic-plugin-directory | dirp@anthropic-plugin-directory | failed | version conflict  | project | "dirp" from the Anthropic Directory is pinned to its listed commit (version 1.0.0), which does not satisfy ^2.0.0 required by "app". | false           |       |                  |
      | anthropic-plugin-directory | project           | mid@anthropic-plugin-directory  | mid@anthropic-plugin-directory  | failed | dependency failed | project |                                                                                                                                      |                 |       |                  |
    Then the project scope has no installed plugins

  Scenario: Installing a plugin whose anthropic-plugin-directory dependency two of its plugins constrain names both plugins in the version conflict
    Given the git repository "dirp" holds these plugins:
      | name | version | path |
      | dirp | 1.0.0   |      |
    Given the git repository "dirp" has a revision only the tag "dirp--v2.0.0" reaches, holding these plugins:
      | name | version | path |
      | dirp | 2.0.0   |      |
    Given the marketplace "anthropic-plugin-directory" is published by the anthropics organization
    Given the marketplace "anthropic-plugin-directory" offers these plugins with dependencies:
      | name | version | dependencies     |
      | app  | 1.0.0   | dirp@^2.0.0, mid |
      | mid  | 1.0.0   | dirp (>=2.0.0)   |
    Given the marketplace "anthropic-plugin-directory" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | dirp | url         | dirp       | false  |
    Given the marketplace "anthropic-plugin-directory" is added to the project scope
    When the user runs "/claude:plugin install app@anthropic-plugin-directory --scope project"
    Then the result has these fields:
      | kind         | cascade                             |
      | severity     | error                               |
      | needs reload | false                               |
      | summary      | Some plugin operations have failed. |
    Then the result lists these plugins:
      | marketplace name           | marketplace scope | id                              | name                            | status | reasons           | scope   | cause chain                                                                                                                                          | cause truncated | leaks | rollback partial |
      | anthropic-plugin-directory | project           | app@anthropic-plugin-directory  | app                             | failed | dependency failed | project |                                                                                                                                                      |                 |       |                  |
      | anthropic-plugin-directory | project           | dirp@anthropic-plugin-directory | dirp@anthropic-plugin-directory | failed | version conflict  | project | "dirp" from the Anthropic Directory is pinned to its listed commit (version 1.0.0), which does not satisfy ^2.0.0, >=2.0.0 required by "app", "mid". | false           |       |                  |
      | anthropic-plugin-directory | project           | mid@anthropic-plugin-directory  | mid@anthropic-plugin-directory  | failed | dependency failed | project |                                                                                                                                                      |                 |       |                  |
    Then the project scope has no installed plugins

  Scenario: Installing a plugin whose anthropic-plugin-directory dependency lists a very long version shows the version cut to 120 characters in the version conflict
    Given the git repository "dirp" holds these plugins:
      | name | version                                                                                                                            | path |
      | dirp | 1.0.0-zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz |      |
    Given the git repository "dirp" has a revision only the tag "dirp--v2.0.0" reaches, holding these plugins:
      | name | version | path |
      | dirp | 2.0.0   |      |
    Given the marketplace "anthropic-plugin-directory" is published by the anthropics organization
    Given the marketplace "anthropic-plugin-directory" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | dirp@^2.0.0  |
    Given the marketplace "anthropic-plugin-directory" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | dirp | url         | dirp       | false  |
    Given the marketplace "anthropic-plugin-directory" is added to the project scope
    When the user runs "/claude:plugin install app@anthropic-plugin-directory --scope project"
    Then the result has these fields:
      | kind         | cascade                             |
      | severity     | error                               |
      | needs reload | false                               |
      | summary      | Some plugin operations have failed. |
    Then the result lists these plugins:
      | marketplace name           | marketplace scope | id                              | name                            | status | reasons           | scope   | cause chain                                                                                                                                                                                                                                              | cause truncated | leaks | rollback partial |
      | anthropic-plugin-directory | project           | app@anthropic-plugin-directory  | app                             | failed | dependency failed | project |                                                                                                                                                                                                                                                          |                 |       |                  |
      | anthropic-plugin-directory | project           | dirp@anthropic-plugin-directory | dirp@anthropic-plugin-directory | failed | version conflict  | project | "dirp" from the Anthropic Directory is pinned to its listed commit (version 1.0.0-zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz…), which does not satisfy ^2.0.0 required by "app". | false           |       |                  |
    Then the project scope has no installed plugins

  Scenario: Installing a plugin that asks for an installed pinned anthropic-plugin-directory plugin's range leaves that plugin in place
    Given the git repository "dirp" holds these plugins:
      | name | version | path |
      | dirp | 1.0.0   |      |
    Given the marketplace "anthropic-plugin-directory" is published by the anthropics organization
    Given the marketplace "anthropic-plugin-directory" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | dirp@^1.0.0  |
    Given the marketplace "anthropic-plugin-directory" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | dirp | url         | dirp       | true   |
    Given the marketplace "anthropic-plugin-directory" is added to the project scope
    Given the user has run "/claude:plugin install dirp@anthropic-plugin-directory --scope project"
    When the user runs "/claude:plugin install app@anthropic-plugin-directory --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name           | marketplace scope | id                              | name                            | status    | reasons           | scope   | version                 |
      | anthropic-plugin-directory | project           | app@anthropic-plugin-directory  | app                             | installed |                   | project | 1.0.0                   |
      | anthropic-plugin-directory | project           | dirp@anthropic-plugin-directory | dirp@anthropic-plugin-directory | skipped   | already installed | project | 1.0.0-{dirp revision 1} |
    Then the installation record of the project scope holds these plugins:
      | id                              | version                 | enabled |
      | app@anthropic-plugin-directory  | 1.0.0                   | true    |
      | dirp@anthropic-plugin-directory | 1.0.0-{dirp revision 1} | true    |

  Scenario: Installing a plugin whose first dependency's move also moves its second dependency moves each once
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | aaa  | 1.0.0   |              |
      | zzz  | 1.0.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install aaa@tools --scope project"
    Given the user has run "/claude:plugin install zzz@tools --scope project"
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies          |
      | app  | 1.0.0   | aaa@^2.0.0,zzz@^2.0.0 |
      | aaa  | 2.0.0   | zzz@^2.0.0            |
      | zzz  | 2.0.0   |                       |
    When the user runs "/claude:plugin install app@tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name      | status    | reasons                 | scope   | version | from  | to    | cause chain                                                                        | cause truncated | leaks | rollback partial |
      | tools            | project           | aaa@tools | aaa@tools | updated   | dependency current copy | project |         | 1.0.0 | 2.0.0 | constrained to the combined range (^2.0.0) -- required by "app@tools"              | false           |       |                  |
      | tools            | project           | app@tools | app       | installed |                         | project | 1.0.0   |       |       |                                                                                    |                 |       |                  |
      | tools            | project           | zzz@tools | zzz@tools | updated   | dependency current copy | project |         | 1.0.0 | 2.0.0 | constrained to the combined range (^2.0.0) -- required by "aaa@tools", "app@tools" | false           |       |                  |
    Then the installation record of the project scope holds these plugins:
      | id        | version | enabled |
      | aaa@tools | 2.0.0   | true    |
      | app@tools | 1.0.0   | true    |
      | zzz@tools | 2.0.0   | true    |

  Scenario: Installing a plugin only partially available fails before its installed dependency moves
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
    Given the published plugin "app" of the marketplace "tools" has an output style
    When the user runs "/claude:plugin install app@tools --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name | status              | reasons               | hint            |
      | tools            | project           | app@tools | app  | partially-available | unsupported component | partial-install |
    Then the installation record of the project scope holds these plugins:
      | id        | version | enabled |
      | lib@tools | 1.2.0   | true    |
    Then the project scope stages these skills and prompts:
      | kind  | name      |
      | skill | lib-skill |
    Then the "claude-plugins.json" file of the project scope declares these plugins:
      | id        |
      | lib@tools |

  Scenario: Installing a plugin whose second dependency's new version needs a plugin no marketplace offers fails before either dependency moves
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | aaa  | 1.0.0   |              |
      | zzz  | 1.0.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install aaa@tools --scope project"
    Given the user has run "/claude:plugin install zzz@tools --scope project"
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies          |
      | app  | 1.0.0   | aaa@^2.0.0,zzz@^2.0.0 |
      | aaa  | 2.0.0   |                       |
      | zzz  | 2.0.0   | ghost                 |
    When the user runs "/claude:plugin install app@tools --scope project"
    Then the result has these fields:
      | kind         | cascade                             |
      | severity     | error                               |
      | needs reload | false                               |
      | summary      | Some plugin operations have failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id          | name        | status | reasons           | scope   | cause chain                                                  | cause truncated | leaks | rollback partial |
      | tools            | project           | app@tools   | app         | failed | dependency failed | project |                                                              |                 |       |                  |
      | tools            | project           | ghost@tools | ghost@tools | failed | not in manifest   | project | Dependency "ghost@tools" is not declared by its marketplace. | false           |       |                  |
    Then the installation record of the project scope holds these plugins:
      | id        | version | enabled |
      | aaa@tools | 1.0.0   | true    |
      | zzz@tools | 1.0.0   | true    |
    Then the project scope stages these skills and prompts:
      | kind  | name      |
      | skill | aaa-skill |
      | skill | zzz-skill |
    Then the "claude-plugins.json" file of the project scope declares these plugins:
      | id        |
      | aaa@tools |
      | zzz@tools |

  Scenario: Installing a plugin whose disabled dependency is outside its version constraint moves the dependency and enables it
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | lib  | 1.2.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install lib@tools --scope project"
    Given the user has run "/claude:plugin disable lib@tools --scope project"
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
      | marketplace name | marketplace scope | id        | name      | status    | reasons                               | scope   | version |
      | tools            | project           | app@tools | app       | installed |                                       | project | 1.0.0   |
      | tools            | project           | lib@tools | lib@tools | installed | already installed, dependency enabled | project | 2.0.0   |
    Then the installation record of the project scope holds these plugins:
      | id        | version | enabled |
      | app@tools | 1.0.0   | true    |
      | lib@tools | 2.0.0   | true    |

  Scenario: Installing a plugin whose dependencies ask one installed dependency for different ranges moves it once to the highest version every range admits
    Given the git repository "zzz" holds these plugins:
      | name | version | path |
      | zzz  | 1.0.0   |      |
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | aaa  | 1.0.0   |              |
    Given the marketplace "tools" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | zzz  | url         | zzz        | false  |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install aaa@tools --scope project"
    Given the user has run "/claude:plugin install zzz@tools --scope project"
    Given the git repository "zzz" has a revision only the tag "zzz--v2.0.0" reaches, holding these plugins:
      | name | version | path |
      | zzz  | 2.0.0   |      |
    Given the git repository "zzz" has a revision only the tag "zzz--v3.0.0" reaches, holding these plugins:
      | name | version | path |
      | zzz  | 3.0.0   |      |
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies          |
      | app  | 1.0.0   | aaa@^2.0.0,zzz@^2.0.0 |
      | aaa  | 2.0.0   | zzz (>=2.0.0)         |
    Given the marketplace "tools" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | zzz  | url         | zzz        | false  |
    When the user runs "/claude:plugin install app@tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name      | status    | reasons                 | scope   | version | from  | to                     | cause chain                                                                                                     | cause truncated | leaks | rollback partial |
      | tools            | project           | aaa@tools | aaa@tools | updated   | dependency current copy | project |         | 1.0.0 | 2.0.0                  | constrained to the combined range (^2.0.0) -- required by "app@tools"                                           | false           |       |                  |
      | tools            | project           | app@tools | app       | installed |                         | project | 1.0.0   |       |                        |                                                                                                                 |                 |       |                  |
      | tools            | project           | zzz@tools | zzz@tools | updated   |                         | project |         | 1.0.0 | 2.0.0-{zzz revision 2} | already the highest version the combined range admits (>=2.0.0, ^2.0.0) -- required by "aaa@tools", "app@tools" | false           |       |                  |
    Then the installation record of the project scope holds these plugins:
      | id        | version                | enabled |
      | aaa@tools | 2.0.0                  | true    |
      | app@tools | 1.0.0                  | true    |
      | zzz@tools | 2.0.0-{zzz revision 2} | true    |

  Scenario: Installing a plugin whose installed dependency no release moves into range keeps the mirror a fetch warmed
    Given the git repository "xx" holds these plugins:
      | name | version | path |
      | xx   | 1.0.0   |      |
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | lib  | 1.2.0   |              |
    Given the marketplace "tools" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | xx   | url         | xx         | false  |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install lib@tools --scope project"
    Given the user has run "/claude:plugin fetch xx@tools --scope project"
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib@^2.0.0   |
      | lib  | 1.5.0   |              |
    Given the marketplace "tools" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | xx   | url         | xx         | false  |
    When the user runs "/claude:plugin install app@tools --scope project"
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name      | status | reasons                             | scope   | version | cause chain                                                                                                                                                                                                                                                                | cause truncated | leaks | rollback partial |
      | tools            | project           | app@tools | app       | failed | dependency failed                   | project |         |                                                                                                                                                                                                                                                                            |                 |       |                  |
      | tools            | project           | lib@tools | lib@tools | failed | already installed, version conflict | project | 1.2.0   | Dependency "lib@tools" is installed at version 1.2.0, which does not satisfy ^2.0.0, and cannot move: version 1.5.0 falls outside what the combined range admits (^2.0.0) -- required by "app@tools". To look for a version in range, run /claude:plugin update lib@tools. | false           |       |                  |
    Then the installation record of the project scope holds these plugins:
      | id        | version | enabled |
      | lib@tools | 1.2.0   | true    |
    Then the project scope holds these git clones:
      | clone  | origin                         | revision |
      | plugin | https://{git host}/acme/xx.git | {xx revision 1} |

  Scenario: Installing a plugin in the project scope that moves a dependency and needs a marketplace only the user scope holds clones that marketplace once
    Given the marketplace "up" is published as a url source
    Given the marketplace "up" offers these plugins:
      | name | version |
      | fff  | 1.0.0   |
    Given the marketplace "up" is added to the user scope
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | lib  | 1.0.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install lib@tools --scope project"
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies      |
      | app  | 1.0.0   | lib@^2.0.0,fff@up |
      | lib  | 2.0.0   |                   |
    Given the marketplace "tools" allows dependencies on the marketplace "up"
    When the user runs "/claude:plugin install app@tools --scope project"
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name      | status    | reasons                 | scope   | version | from  | to    | cause chain                                                           | cause truncated | leaks | rollback partial |
      | tools            | project           | app@tools | app       | installed |                         | project | 1.0.0   |       |       |                                                                       |                 |       |                  |
      | tools            | project           | fff@up    | fff@up    | installed |                         | project | 1.0.0   |       |       |                                                                       |                 |       |                  |
      | tools            | project           | lib@tools | lib@tools | updated   | dependency current copy | project |         | 1.0.0 | 2.0.0 | constrained to the combined range (^2.0.0) -- required by "app@tools" | false           |       |                  |
    Then the git host receives these requests:
      | method | path                                           | status |
      | GET    | /acme/up.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/up.git/git-upload-pack                   | 200    |
    Then the installation record of the project scope holds these plugins:
      | id        | version | enabled |
      | app@tools | 1.0.0   | true    |
      | fff@up    | 1.0.0   | true    |
      | lib@tools | 2.0.0   | true    |

  Scenario: Installing a plugin whose installed dependency moves fetches the repository of its new git dependency once
    Given the git repository "util" holds these plugins:
      | name | version | path |
      | util | 1.0.0   |      |
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | lib  | 1.2.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install lib@tools --scope project"
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies    |
      | app  | 1.0.0   | lib@^2.0.0,util |
      | lib  | 2.0.0   |                 |
    Given the marketplace "tools" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | util | url         | util       | false  |
    When the user runs "/claude:plugin install app@tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id         | name       | status    | reasons                 | scope   | version | from  | to    | cause chain                                                           | cause truncated | leaks | rollback partial |
      | tools            | project           | app@tools  | app        | installed |                         | project | 1.0.0   |       |       |                                                                       |                 |       |                  |
      | tools            | project           | lib@tools  | lib@tools  | updated   | dependency current copy | project |         | 1.2.0 | 2.0.0 | constrained to the combined range (^2.0.0) -- required by "app@tools" | false           |       |                  |
      | tools            | project           | util@tools | util@tools | installed |                         | project | 1.0.0   |       |       |                                                                       |                 |       |                  |
    Then the git host receives these requests:
      | method | path                                             | status |
      | GET    | /acme/util.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/util.git/git-upload-pack                   | 200    |
    Then the installation record of the project scope holds these plugins:
      | id         | version | enabled |
      | app@tools  | 1.0.0   | true    |
      | lib@tools  | 2.0.0   | true    |
      | util@tools | 1.0.0   | true    |

  Scenario: Installing a plugin whose moved dependency asks a new dependency for a version the plugin excludes fails before anything changes
    Given the git repository "fff" holds these plugins:
      | name | version | path |
      | fff  | 3.0.0   |      |
    Given the git repository "fff" has a revision only the tag "fff--v1.5.0" reaches, holding these plugins:
      | name | version | path |
      | fff  | 1.5.0   |      |
    Given the git repository "fff" has a revision only the tag "fff--v2.0.0" reaches, holding these plugins:
      | name | version | path |
      | fff  | 2.0.0   |      |
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | aaa  | 1.0.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install aaa@tools --scope project"
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies          |
      | app  | 1.0.0   | aaa@^2.0.0,fff@^2.0.0 |
      | aaa  | 2.0.0   | fff@^1.0.0            |
    Given the marketplace "tools" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | fff  | url         | fff        | false  |
    When the user runs "/claude:plugin install app@tools --scope project"
    Then the result has these fields:
      | kind         | cascade                             |
      | severity     | error                               |
      | needs reload | false                               |
      | summary      | Some plugin operations have failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name      | status | reasons           | scope   | cause chain                                                                                                               | cause truncated | leaks | rollback partial |
      | tools            | project           | app@tools | app       | failed | dependency failed | project |                                                                                                                           |                 |       |                  |
      | tools            | project           | fff@tools | fff@tools | failed | version conflict  | project | Dependency "fff@tools" has contradictory version constraints ^1.0.0, ^2.0.0 (no version satisfies all 2 declared ranges). | false           |       |                  |
    Then the installation record of the project scope holds these plugins:
      | id        | version | enabled |
      | aaa@tools | 1.0.0   | true    |
    Then the project scope holds no git clones

  Scenario: Installing a plugin whose moved dependency's new version needs a plugin of a marketplace with a broken manifest fails as that plugin's install does
    Given the marketplace "other" is published as a dir source
    Given the marketplace "other" offers these plugins with dependencies:
      | name | version | dependencies |
      | zzz  | 1.0.0   |              |
    Given the marketplace "other" is added to the project scope
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | aaa  | 1.0.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install aaa@tools --scope project"
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | aaa@^2.0.0   |
      | aaa  | 2.0.0   | zzz@other    |
    Given the marketplace "tools" allows dependencies on the marketplace "other"
    Given the manifest of the marketplace "other" is no longer valid json
    When the user runs "/claude:plugin install app@tools --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name | status | reasons | scope   | cause chain                                                                                                                                                                                                             | cause truncated | leaks | rollback partial |
      | tools            | project           | app@tools | app  | failed |         | project | marketplace.json is not valid JSON: SyntaxError: Expected ',' or '}' after property value in JSON at position 56 (line 1 column 57), Expected ',' or '}' after property value in JSON at position 56 (line 1 column 57) | false           |       |                  |
    Then the installation record of the project scope holds these plugins:
      | id        | version | enabled |
      | aaa@tools | 1.0.0   | true    |

  Scenario: Installing a plugin whose moved dependency narrows an installed dependency's range moves that dependency to the highest version every range admits
    Given the git repository "bbb" holds these plugins:
      | name | version | path |
      | bbb  | 1.0.0   |      |
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | aaa  | 1.0.0   |              |
    Given the marketplace "tools" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | bbb  | url         | bbb        | false  |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install aaa@tools --scope project"
    Given the user has run "/claude:plugin install bbb@tools --scope project"
    Given the git repository "bbb" has a revision only the tag "bbb--v1.4.0" reaches, holding these plugins:
      | name | version | path |
      | bbb  | 1.4.0   |      |
    Given the git repository "bbb" has a revision only the tag "bbb--v1.9.0" reaches, holding these plugins:
      | name | version | path |
      | bbb  | 1.9.0   |      |
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies          |
      | app  | 1.0.0   | aaa@^2.0.0,bbb@^1.2.0 |
      | aaa  | 2.0.0   | fff                   |
      | fff  | 1.0.0   | bbb (<1.5.0)          |
    Given the marketplace "tools" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | bbb  | url         | bbb        | false  |
    When the user runs "/claude:plugin install app@tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name      | status    | reasons                 | scope   | version | from  | to                     | cause chain                                                                                                    | cause truncated | leaks | rollback partial |
      | tools            | project           | aaa@tools | aaa@tools | updated   | dependency current copy | project |         | 1.0.0 | 2.0.0                  | constrained to the combined range (^2.0.0) -- required by "app@tools"                                          | false           |       |                  |
      | tools            | project           | app@tools | app       | installed |                         | project | 1.0.0   |       |                        |                                                                                                                |                 |       |                  |
      | tools            | project           | bbb@tools | bbb@tools | updated   |                         | project |         | 1.0.0 | 1.4.0-{bbb revision 2} | already the highest version the combined range admits (^1.2.0, <1.5.0) -- required by "app@tools", "fff@tools" | false           |       |                  |
      | tools            | project           | fff@tools | fff@tools | installed |                         | project | 1.0.0   |       |                        |                                                                                                                |                 |       |                  |
    Then the installation record of the project scope holds these plugins:
      | id        | version                | enabled |
      | aaa@tools | 2.0.0                  | true    |
      | app@tools | 1.0.0                  | true    |
      | bbb@tools | 1.4.0-{bbb revision 2} | true    |
      | fff@tools | 1.0.0                  | true    |

  Scenario: Installing a plugin whose moved dependency also needs a disabled dependency the plugin moves moves and enables that dependency once
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | aaa  | 1.0.0   |              |
      | ddd  | 1.0.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install aaa@tools --scope project"
    Given the user has run "/claude:plugin install ddd@tools --scope project"
    Given the user has run "/claude:plugin disable ddd@tools --scope project"
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies          |
      | app  | 1.0.0   | aaa@^2.0.0,ddd@^2.0.0 |
      | aaa  | 2.0.0   | ddd                   |
      | ddd  | 2.0.0   |                       |
    When the user runs "/claude:plugin install app@tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name      | status    | reasons                               | scope   | version | from  | to    | cause chain                                                           | cause truncated | leaks | rollback partial |
      | tools            | project           | aaa@tools | aaa@tools | updated   | dependency current copy               | project |         | 1.0.0 | 2.0.0 | constrained to the combined range (^2.0.0) -- required by "app@tools" | false           |       |                  |
      | tools            | project           | app@tools | app       | installed |                                       | project | 1.0.0   |       |       |                                                                       |                 |       |                  |
      | tools            | project           | ddd@tools | ddd@tools | installed | already installed, dependency enabled | project | 2.0.0   |       |       |                                                                       |                 |       |                  |
    Then the installation record of the project scope holds these plugins:
      | id        | version | enabled |
      | aaa@tools | 2.0.0   | true    |
      | app@tools | 1.0.0   | true    |
      | ddd@tools | 2.0.0   | true    |

  Scenario: Installing a plugin whose second dependency move fails keeps the first move and lists it
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | aaa  | 1.0.0   |              |
      | zzz  | 1.0.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install aaa@tools --scope project"
    Given the user has run "/claude:plugin install zzz@tools --scope project"
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies          |
      | app  | 1.0.0   | zzz@^2.0.0,aaa@^2.0.0 |
      | aaa  | 2.0.0   |                       |
      | zzz  | 2.0.0   |                       |
    Given the published plugin "aaa" of the marketplace "tools" has an unreadable skill file
    When the user runs "/claude:plugin install app@tools --scope project"
    Then the result has these fields:
      | kind         | cascade                             |
      | severity     | error                               |
      | needs reload | true                                |
      | summary      | Some plugin operations have failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name      | status  | reasons                 | scope   | version | from  | to    | cause chain                                                           | cause truncated | leaks | rollback partial |
      | tools            | project           | app@tools | app       | failed  | dependency failed       | project |         |       |       |                                                                       |                 |       |                  |
      | tools            | project           | zzz@tools | zzz@tools | updated | dependency current copy | project |         | 1.0.0 | 2.0.0 | constrained to the combined range (^2.0.0) -- required by "app@tools" | false           |       |                  |
      | tools            | project           | aaa@tools | aaa@tools | failed  |                         | project | 1.0.0   |       |       | {unreadable skill file copy error}                                    | false           |       |                  |
    Then the installation record of the project scope holds these plugins:
      | id        | version | enabled |
      | aaa@tools | 1.0.0   | true    |
      | zzz@tools | 2.0.0   | true    |

  Scenario: Installing a plugin whose second dependency's new version would overwrite a user's agent file fails before either dependency moves
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | aaa  | 1.0.0   |              |
      | zzz  | 1.0.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install aaa@tools --scope project"
    Given the user has run "/claude:plugin install zzz@tools --scope project"
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies          |
      | app  | 1.0.0   | aaa@^2.0.0,zzz@^2.0.0 |
      | aaa  | 2.0.0   |                       |
      | zzz  | 2.0.0   |                       |
    Given the published plugin "zzz" of the marketplace "tools" has the agent "helper"
    Given the agents directory of the project scope holds the file "pi-claude-marketplace-zzz-helper.md" with the text "My own helper agent."
    When the user runs "/claude:plugin install app@tools --scope project"
    Then the result has these fields:
      | kind         | cascade                             |
      | severity     | error                               |
      | needs reload | false                               |
      | summary      | Some plugin operations have failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name      | status | reasons                             | scope   | version | cause chain                                                                                                                                                                                        | cause truncated | leaks | rollback partial |
      | tools            | project           | app@tools | app       | failed | dependency failed                   | project |         |                                                                                                                                                                                                    |                 |       |                  |
      | tools            | project           | zzz@tools | zzz@tools | failed | already installed, version conflict | project | 1.0.0   | Dependency "zzz@tools" is installed at version 1.0.0, which does not satisfy ^2.0.0, and cannot move: Cannot replace agent target with non-previous content at pi-claude-marketplace-zzz-helper.md | false           |       |                  |
    Then the installation record of the project scope holds these plugins:
      | id        | version | enabled |
      | aaa@tools | 1.0.0   | true    |
      | zzz@tools | 1.0.0   | true    |
    Then the agents directory of the project scope holds these files:
      | file                                | text                 |
      | pi-claude-marketplace-zzz-helper.md | My own helper agent. |

  Scenario: Installing a plugin whose second dependency has a foreign agent claim with a missing file fails before either dependency moves
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | aaa  | 1.0.0   |              |
      | zzz  | 1.0.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install aaa@tools --scope project"
    Given the user has run "/claude:plugin install zzz@tools --scope project"
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies          |
      | app  | 1.0.0   | aaa@^2.0.0,zzz@^2.0.0 |
      | aaa  | 2.0.0   |                       |
      | zzz  | 2.0.0   |                       |
    Given the published plugin "zzz" of the marketplace "tools" has the agent "helper"
    Given the agents index of the project scope records generated name "pi-claude-marketplace-zzz-helper" for "zzz@old-catalog" at "pi-claude-marketplace-zzz-helper.md"
    Given the user has deleted the agent file "pi-claude-marketplace-zzz-helper.md" in the project scope
    Given the config and installation record bytes of the project scope are remembered
    When the user runs "/claude:plugin install app@tools --scope project"
    Then the result has these fields:
      | kind         | cascade                             |
      | severity     | error                               |
      | needs reload | false                               |
      | summary      | Some plugin operations have failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name      | status | reasons                             | scope   | version | cause chain                                                                                                                                                                                                        | cause truncated | leaks | rollback partial |
      | tools            | project           | app@tools | app       | failed | dependency failed                   | project |         |                                                                                                                                                                                                                    |                 |       |                  |
      | tools            | project           | zzz@tools | zzz@tools | failed | already installed, version conflict | project | 1.0.0   | Dependency "zzz@tools" is installed at version 1.0.0, which does not satisfy ^2.0.0, and cannot move: Refusing to stage agents for tools/zzz: "pi-claude-marketplace-zzz-helper" already owned by old-catalog/zzz. | false           |       |                  |
    Then the installation record of the project scope holds these plugins:
      | id        | version | enabled |
      | aaa@tools | 1.0.0   | true    |
      | zzz@tools | 1.0.0   | true    |
    Then the config and installation record bytes of the project scope are unchanged
    Then the agents directory of the project scope holds no files
    Then the agents index of the project scope holds these rows:
      | generated name                   | target file                         |
      | pi-claude-marketplace-zzz-helper | pi-claude-marketplace-zzz-helper.md |
    Then the staged skills directory of the project scope holds these files:
      | file               | text                                                                              |
      | aaa-skill/         |                                                                                   |
      | aaa-skill/SKILL.md | ---\nname: aaa-skill\ndescription: A skill of aaa 1.0.0.\n---\n\nVersion 1.0.0.\n |
      | zzz-skill/         |                                                                                   |
      | zzz-skill/SKILL.md | ---\nname: zzz-skill\ndescription: A skill of zzz 1.0.0.\n---\n\nVersion 1.0.0.\n |

  Scenario: Installing a plugin whose new dependency would overwrite a user's agent file fails before its installed dependency moves
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | lib  | 1.2.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install lib@tools --scope project"
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies   |
      | app  | 1.0.0   | lib@^2.0.0,kit |
      | kit  | 1.0.0   |                |
      | lib  | 2.0.0   |                |
    Given the published plugin "kit" of the marketplace "tools" has the agent "helper"
    Given the agents directory of the project scope holds the file "pi-claude-marketplace-kit-helper.md" with the text "My own helper agent."
    When the user runs "/claude:plugin install app@tools --scope project"
    Then the result has these fields:
      | kind         | cascade                             |
      | severity     | error                               |
      | needs reload | false                               |
      | summary      | Some plugin operations have failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name      | status | reasons           | scope   | cause chain                                                                                  | cause truncated | leaks | rollback partial |
      | tools            | project           | app@tools | app       | failed | dependency failed | project |                                                                                              |                 |       |                  |
      | tools            | project           | kit@tools | kit@tools | failed |                   | project | Cannot replace agent target with non-previous content at pi-claude-marketplace-kit-helper.md | false           |       |                  |
    Then the installation record of the project scope holds these plugins:
      | id        | version | enabled |
      | lib@tools | 1.2.0   | true    |
    Then the agents directory of the project scope holds these files:
      | file                                | text                 |
      | pi-claude-marketplace-kit-helper.md | My own helper agent. |

  Scenario: Installing a plugin whose dependency's newest release asks another dependency for a range the plugin excludes moves that dependency to the next release
    Given the git repository "yyy" holds these plugins:
      | name | version | path |
      | yyy  | 1.0.0   |      |
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | xxx  | 2.0.0   |              |
      | mmm  | 1.0.0   |              |
    Given the marketplace "tools" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | yyy  | url         | yyy        | false  |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install xxx@tools --scope project"
    Given the user has run "/claude:plugin install yyy@tools --scope project"
    Given the user has run "/claude:plugin install mmm@tools --scope project"
    Given the git repository "yyy" has a revision only the tag "yyy--v2.0.0" reaches, holding these plugins:
      | name | version | path | dependencies |
      | yyy  | 2.0.0   |      | xxx@^2.0.0   |
    Given the git repository "yyy" has a revision only the tag "yyy--v3.0.0" reaches, holding these plugins:
      | name | version | path | dependencies |
      | yyy  | 3.0.0   |      | xxx@^1.0.0   |
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies                        |
      | app  | 1.0.0   | yyy (>=2.0.0),mmm@^2.0.0,xxx@^2.0.0 |
      | xxx  | 2.0.0   |                                     |
      | mmm  | 2.0.0   | fff                                 |
      | fff  | 1.0.0   | yyy (~2.0.0)                        |
    Given the marketplace "tools" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | yyy  | url         | yyy        | false  |
    When the user runs "/claude:plugin install app@tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name      | status    | reasons                 | scope   | version | from  | to                     | cause chain                                                                                                     | cause truncated | leaks | rollback partial |
      | tools            | project           | app@tools | app       | installed |                         | project | 1.0.0   |       |                        |                                                                                                                 |                 |       |                  |
      | tools            | project           | fff@tools | fff@tools | installed |                         | project | 1.0.0   |       |                        |                                                                                                                 |                 |       |                  |
      | tools            | project           | mmm@tools | mmm@tools | updated   | dependency current copy | project |         | 1.0.0 | 2.0.0                  | constrained to the combined range (^2.0.0) -- required by "app@tools"                                           | false           |       |                  |
      | tools            | project           | xxx@tools | xxx@tools | skipped   | already installed       | project | 2.0.0   |       |                        |                                                                                                                 |                 |       |                  |
      | tools            | project           | yyy@tools | yyy@tools | updated   |                         | project |         | 1.0.0 | 2.0.0-{yyy revision 2} | already the highest version the combined range admits (>=2.0.0, ~2.0.0) -- required by "app@tools", "fff@tools" | false           |       |                  |
    Then the installation record of the project scope holds these plugins:
      | id        | version                | enabled |
      | app@tools | 1.0.0                  | true    |
      | fff@tools | 1.0.0                  | true    |
      | mmm@tools | 2.0.0                  | true    |
      | xxx@tools | 2.0.0                  | true    |
      | yyy@tools | 2.0.0-{yyy revision 2} | true    |

  Scenario: Installing a plugin whose installed dependencies form a chain of nine moves moves every link of the chain
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | a1   | 1.0.0   |              |
      | a2   | 1.0.0   |              |
      | a3   | 1.0.0   |              |
      | a4   | 1.0.0   |              |
      | a5   | 1.0.0   |              |
      | a6   | 1.0.0   |              |
      | a7   | 1.0.0   |              |
      | a8   | 1.0.0   |              |
      | a9   | 1.0.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install a1@tools --scope project"
    Given the user has run "/claude:plugin install a2@tools --scope project"
    Given the user has run "/claude:plugin install a3@tools --scope project"
    Given the user has run "/claude:plugin install a4@tools --scope project"
    Given the user has run "/claude:plugin install a5@tools --scope project"
    Given the user has run "/claude:plugin install a6@tools --scope project"
    Given the user has run "/claude:plugin install a7@tools --scope project"
    Given the user has run "/claude:plugin install a8@tools --scope project"
    Given the user has run "/claude:plugin install a9@tools --scope project"
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | a1@^2.0.0    |
      | a1   | 2.0.0   | a2@^2.0.0    |
      | a2   | 2.0.0   | a3@^2.0.0    |
      | a3   | 2.0.0   | a4@^2.0.0    |
      | a4   | 2.0.0   | a5@^2.0.0    |
      | a5   | 2.0.0   | a6@^2.0.0    |
      | a6   | 2.0.0   | a7@^2.0.0    |
      | a7   | 2.0.0   | a8@^2.0.0    |
      | a8   | 2.0.0   | a9@^2.0.0    |
      | a9   | 2.0.0   |              |
    When the user runs "/claude:plugin install app@tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name     | status    | reasons                 | scope   | version | from  | to    | cause chain                                                           | cause truncated | leaks | rollback partial |
      | tools            | project           | a1@tools  | a1@tools | updated   | dependency current copy | project |         | 1.0.0 | 2.0.0 | constrained to the combined range (^2.0.0) -- required by "app@tools" | false           |       |                  |
      | tools            | project           | a2@tools  | a2@tools | updated   | dependency current copy | project |         | 1.0.0 | 2.0.0 | constrained to the combined range (^2.0.0) -- required by "a1@tools"  | false           |       |                  |
      | tools            | project           | a3@tools  | a3@tools | updated   | dependency current copy | project |         | 1.0.0 | 2.0.0 | constrained to the combined range (^2.0.0) -- required by "a2@tools"  | false           |       |                  |
      | tools            | project           | a4@tools  | a4@tools | updated   | dependency current copy | project |         | 1.0.0 | 2.0.0 | constrained to the combined range (^2.0.0) -- required by "a3@tools"  | false           |       |                  |
      | tools            | project           | a5@tools  | a5@tools | updated   | dependency current copy | project |         | 1.0.0 | 2.0.0 | constrained to the combined range (^2.0.0) -- required by "a4@tools"  | false           |       |                  |
      | tools            | project           | a6@tools  | a6@tools | updated   | dependency current copy | project |         | 1.0.0 | 2.0.0 | constrained to the combined range (^2.0.0) -- required by "a5@tools"  | false           |       |                  |
      | tools            | project           | a7@tools  | a7@tools | updated   | dependency current copy | project |         | 1.0.0 | 2.0.0 | constrained to the combined range (^2.0.0) -- required by "a6@tools"  | false           |       |                  |
      | tools            | project           | a8@tools  | a8@tools | updated   | dependency current copy | project |         | 1.0.0 | 2.0.0 | constrained to the combined range (^2.0.0) -- required by "a7@tools"  | false           |       |                  |
      | tools            | project           | a9@tools  | a9@tools | updated   | dependency current copy | project |         | 1.0.0 | 2.0.0 | constrained to the combined range (^2.0.0) -- required by "a8@tools"  | false           |       |                  |
      | tools            | project           | app@tools | app      | installed |                         | project | 1.0.0   |       |       |                                                                       |                 |       |                  |
    Then the installation record of the project scope holds these plugins:
      | id        | version | enabled |
      | a1@tools  | 2.0.0   | true    |
      | a2@tools  | 2.0.0   | true    |
      | a3@tools  | 2.0.0   | true    |
      | a4@tools  | 2.0.0   | true    |
      | a5@tools  | 2.0.0   | true    |
      | a6@tools  | 2.0.0   | true    |
      | a7@tools  | 2.0.0   | true    |
      | a8@tools  | 2.0.0   | true    |
      | a9@tools  | 2.0.0   | true    |
      | app@tools | 1.0.0   | true    |

  Scenario: A dependency plan failure lists every resolved member that did not install
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | aaa  | 1.0.0   |              |
      | ddd  | 1.0.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install aaa@tools --scope project"
    Given the user has run "/claude:plugin install ddd@tools --scope project"
    Given the user has run "/claude:plugin disable ddd@tools --scope project"
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies          |
      | app  | 1.0.0   | ddd@^2.0.0,aaa@^2.0.0,zzz |
      | aaa  | 2.0.0   |                       |
      | ddd  | 2.0.0   |                       |
      | zzz  | 1.0.0   |                       |
    Given the published plugin "aaa" of the marketplace "tools" has an unreadable skill file
    When the user runs "/claude:plugin install app@tools --scope project"
    Then the result has these fields:
      | kind         | cascade                             |
      | severity     | error                               |
      | needs reload | false                               |
      | summary      | Some plugin operations have failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name      | status  | reasons           | scope   | version | from  | to    | cause chain                        | cause truncated | leaks | rollback partial |
      | tools            | project           | app@tools | app       | failed  | dependency failed | project |         |       |       |                                    |                 |       |                  |
      | tools            | project           | ddd@tools | ddd@tools | updated | already disabled  | project |         | 1.0.0 | 2.0.0 |                                    |                 |       |                  |
      | tools            | project           | aaa@tools | aaa@tools | failed  |                   | project | 1.0.0   |       |       | {unreadable skill file copy error} | false           |       |                  |
      | tools            | project           | zzz@tools | zzz@tools | failed  | dependency failed | project |         |       |       |                                    |                 |       |                  |
    Then the installation record of the project scope holds these plugins:
      | id        | version | enabled |
      | aaa@tools | 1.0.0   | true    |
      | ddd@tools | 2.0.0   | false   |

  Scenario: Installing a plugin whose new dependency fails to install after a disabled dependency moved lists the moved dependency once
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | ddd  | 1.0.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install ddd@tools --scope project"
    Given the user has run "/claude:plugin disable ddd@tools --scope project"
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies    |
      | app  | 1.0.0   | ddd@^2.0.0, xxx |
      | ddd  | 2.0.0   |                 |
      | xxx  | 1.0.0   |                 |
    Given the published plugin "xxx" of the marketplace "tools" has an unreadable skill file
    When the user runs "/claude:plugin install app@tools --scope project"
    Then the result has these fields:
      | kind         | cascade                             |
      | severity     | error                               |
      | needs reload | false                               |
      | summary      | Some plugin operations have failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name      | status  | reasons           | scope   | from  | to    | cause chain                        | cause truncated | leaks | rollback partial |
      | tools            | project           | app@tools | app       | failed  | dependency failed | project |       |       |                                    |                 |       |                  |
      | tools            | project           | xxx@tools | xxx@tools | failed  |                   | project |       |       | {unreadable skill file copy error} | false           |       |                  |
      | tools            | project           | ddd@tools | ddd@tools | updated | already disabled  | project | 1.0.0 | 2.0.0 |                                    |                 |       |                  |
    Then the installation record of the project scope holds these plugins:
      | id        | version | enabled |
      | ddd@tools | 2.0.0   | false   |

  Scenario: Installing a plugin whose moved dependency needs an installed dependency in range lists that dependency as already installed
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | aaa  | 1.0.0   |              |
      | kkk  | 1.0.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install aaa@tools --scope project"
    Given the user has run "/claude:plugin install kkk@tools --scope project"
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | aaa@^2.0.0   |
      | aaa  | 2.0.0   | kkk@^1.0.0   |
      | kkk  | 1.0.0   |              |
    When the user runs "/claude:plugin install app@tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name      | status    | reasons                 | scope   | version | from  | to    | cause chain                                                           | cause truncated | leaks | rollback partial |
      | tools            | project           | aaa@tools | aaa@tools | updated   | dependency current copy | project |         | 1.0.0 | 2.0.0 | constrained to the combined range (^2.0.0) -- required by "app@tools" | false           |       |                  |
      | tools            | project           | app@tools | app       | installed |                         | project | 1.0.0   |       |       |                                                                       |                 |       |                  |
      | tools            | project           | kkk@tools | kkk@tools | skipped   | already installed       | project | 1.0.0   |       |       |                                                                       |                 |       |                  |
    Then the installation record of the project scope holds these plugins:
      | id        | version | enabled |
      | aaa@tools | 2.0.0   | true    |
      | app@tools | 1.0.0   | true    |
      | kkk@tools | 1.0.0   | true    |

  Scenario: Installing a plugin whose disabled dependency comes from a marketplace its own marketplace does not allow fails as cross-marketplace and keeps the dependency disabled
    Given the marketplace "other" is published as a dir source
    Given the marketplace "other" offers these plugins with dependencies:
      | name | version | dependencies |
      | lib  | 1.0.0   |              |
    Given the marketplace "other" is added to the project scope
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib@other    |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install lib@other --scope project"
    Given the user has run "/claude:plugin disable lib@other --scope project"
    When the user runs "/claude:plugin install app@tools --scope project"
    Then the result has these fields:
      | kind         | cascade                             |
      | severity     | error                               |
      | needs reload | false                               |
      | summary      | Some plugin operations have failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name      | status | reasons           | scope   | cause chain                                                                                                                                                                                                                                                                  | cause truncated | leaks | rollback partial |
      | tools            | project           | app@tools | app       | failed | dependency failed | project |                                                                                                                                                                                                                                                                              |                 |       |                  |
      | tools            | project           | lib@other | lib@other | failed | cross-marketplace | project | Dependency "lib@other", declared by "app@tools", is from marketplace "other", which root marketplace "tools" does not allow. Install "lib@other" manually first, or add "other" to allowCrossMarketplaceDependenciesOn in the marketplace.json for root marketplace "tools". | false           |       |                  |
    Then the installation record of the project scope holds these plugins:
      | id        | version | enabled |
      | lib@other | 1.0.0   | false   |
