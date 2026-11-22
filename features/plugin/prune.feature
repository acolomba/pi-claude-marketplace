Feature: Plugin prune

  Pruning a scope uninstalls the dependencies that no installed plugin needs
  any more, with their clones. The scenarios run the real extension in a headless
  Pi, with local marketplaces and a loopback https git host for git sources.

  Scenario: Pruning a scope with nothing to remove reports the empty result
    When the user runs "/claude:plugin prune --scope project"
    Then the result has these fields:
      | kind         | prune-empty |
      | severity     | info        |
      | needs reload | false       |
      | scope        | project     |

  Scenario: Pruning a scope uninstalls a dependency that no installed plugin needs
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib          |
      | lib  | 1.2.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install app@tools --scope project"
    Given the user has run "/claude:plugin uninstall app@tools --scope project"
    When the user runs "/claude:plugin prune --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name | status      | reasons           | scope   | version |
      | tools            | project           | lib@tools | lib  | uninstalled | dependency pruned | project | 1.2.0   |
    Then the project scope has no installed plugins

  Scenario: Pruning a git-source dependency removes its clone
    Given the git repository "ghp" holds these plugins:
      | name | version | path |
      | ghp  | 1.0.0   |      |
    Given the marketplace "gits" is published as a dir source
    Given the marketplace "gits" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | ghp          |
    Given the marketplace "gits" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | ghp  | github      | ghp        | false  |
    Given the marketplace "gits" is added to the project scope
    Given the user has run "/claude:plugin install app@gits --scope project"
    Given the user has run "/claude:plugin uninstall app@gits --scope project"
    When the user runs "/claude:plugin prune --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id       | name | status      | reasons           | scope   | version |
      | gits             | project           | ghp@gits | ghp  | uninstalled | dependency pruned | project | 1.0.0   |
    Then the project scope has no installed plugins
    Then the project scope holds no git clones
    Then the git host receives no request

  Scenario: Pruning without a scope prunes the user scope alone
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib          |
      | tool | 1.0.0   | mid          |
      | mid  | 1.1.0   |              |
      | lib  | 1.2.0   |              |
    Given the marketplace "tools" is added to the user scope
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install app@tools --scope user"
    Given the user has run "/claude:plugin uninstall app@tools --scope user"
    Given the user has run "/claude:plugin install tool@tools --scope project"
    Given the user has run "/claude:plugin uninstall tool@tools --scope project"
    Given the config and installation record bytes of the project scope are remembered
    When the user runs "/claude:plugin prune"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name | status      | reasons           | scope | version |
      | tools            | user              | lib@tools | lib  | uninstalled | dependency pruned | user  | 1.2.0   |
    Then the user scope has no installed plugins
    Then the config and installation record bytes of the project scope are unchanged
    Then the installation record of the project scope holds these plugins:
      | id        | version | enabled |
      | mid@tools | 1.1.0   | true    |
    Then the project scope stages these skills and prompts:
      | kind  | name      |
      | skill | mid-skill |

  Scenario: Previewing a prune of the user scope lists only its dependency and removes nothing
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib          |
      | tool | 1.0.0   | mid          |
      | mid  | 1.1.0   |              |
      | lib  | 1.2.0   |              |
    Given the marketplace "tools" is added to the user scope
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install app@tools --scope user"
    Given the user has run "/claude:plugin uninstall app@tools --scope user"
    Given the user has run "/claude:plugin install tool@tools --scope project"
    Given the user has run "/claude:plugin uninstall tool@tools --scope project"
    Given the config and installation record bytes of the user scope are remembered
    Given the config and installation record bytes of the project scope are remembered
    When the user runs "/claude:plugin prune --scope user --dry-run"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name | status         | reasons           | scope | version |
      | tools            | user              | lib@tools | lib  | will uninstall | dependency pruned | user  | 1.2.0   |
    Then the config and installation record bytes of the user scope are unchanged
    Then the config and installation record bytes of the project scope are unchanged
    Then the user scope stages these skills and prompts:
      | kind  | name      |
      | skill | lib-skill |

  Scenario: Previewing a prune of the project scope lists only its dependency and removes nothing
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib          |
      | tool | 1.0.0   | mid          |
      | mid  | 1.1.0   |              |
      | lib  | 1.2.0   |              |
    Given the marketplace "tools" is added to the user scope
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install app@tools --scope user"
    Given the user has run "/claude:plugin uninstall app@tools --scope user"
    Given the user has run "/claude:plugin install tool@tools --scope project"
    Given the user has run "/claude:plugin uninstall tool@tools --scope project"
    Given the config and installation record bytes of the user scope are remembered
    Given the config and installation record bytes of the project scope are remembered
    When the user runs "/claude:plugin prune --scope project --dry-run"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name | status         | reasons           | scope   | version |
      | tools            | project           | mid@tools | mid  | will uninstall | dependency pruned | project | 1.1.0   |
    Then the config and installation record bytes of the user scope are unchanged
    Then the config and installation record bytes of the project scope are unchanged
    Then the project scope stages these skills and prompts:
      | kind  | name      |
      | skill | mid-skill |

  Scenario: Pruning keeps a dependency that an installed plugin still needs
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib          |
      | lib  | 1.2.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install app@tools --scope project"
    When the user runs "/claude:plugin prune --scope project"
    Then the result has these fields:
      | kind         | prune-empty |
      | severity     | info        |
      | needs reload | false       |
      | scope        | project     |
    Then the installation record of the project scope holds these plugins:
      | id        | version | enabled |
      | app@tools | 1.0.0   | true    |
      | lib@tools | 1.2.0   | true    |

  Scenario: Pruning keeps a plugin the user installed by name
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib          |
      | lib  | 1.2.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install lib@tools --scope project"
    Given the user has run "/claude:plugin install app@tools --scope project"
    Given the user has run "/claude:plugin uninstall app@tools --scope project"
    When the user runs "/claude:plugin prune --scope project"
    Then the result has these fields:
      | kind         | prune-empty |
      | severity     | info        |
      | needs reload | false       |
      | scope        | project     |
    Then the installation record of the project scope holds these plugins:
      | id        | version | enabled |
      | lib@tools | 1.2.0   | true    |
    Then the "claude-plugins.json" file of the project scope declares these plugins:
      | id        |
      | lib@tools |

  Scenario: Pruning keeps a dependency that only a disabled plugin needs
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib          |
      | lib  | 1.2.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install app@tools --scope project"
    Given the user has run "/claude:plugin disable app@tools --scope project"
    When the user runs "/claude:plugin prune --scope project"
    Then the result has these fields:
      | kind         | prune-empty |
      | severity     | info        |
      | needs reload | false       |
      | scope        | project     |
    Then the installation record of the project scope holds these plugins:
      | id        | version | enabled |
      | app@tools | 1.0.0   | false   |
      | lib@tools | 1.2.0   | true    |
    Then the "claude-plugins.json" file of the project scope declares these plugins:
      | id        | enabled |
      | app@tools | false   |

  Scenario: Pruning removes a disabled dependency that nothing needs and what only it needs
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | mid          |
      | mid  | 1.1.0   | lib          |
      | lib  | 1.2.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install app@tools --scope project"
    Given the user has run "/claude:plugin uninstall app@tools --scope project"
    Given the user has run "/claude:plugin disable mid@tools --scope project"
    When the user runs "/claude:plugin prune --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name | status      | reasons           | scope   | version |
      | tools            | project           | mid@tools | mid  | uninstalled | dependency pruned | project | 1.1.0   |
      | tools            | project           | lib@tools | lib  | uninstalled | dependency pruned | project | 1.2.0   |
    Then the project scope has no installed plugins
    Then the "claude-plugins.json" file of the project scope declares no plugins

  Scenario: Pruning a dependency the user disabled in the local config drops its local declaration
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib          |
      | lib  | 1.2.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install app@tools --scope project"
    Given the user has run "/claude:plugin uninstall app@tools --scope project"
    Given the user has run "/claude:plugin disable lib@tools --scope project --local"
    When the user runs "/claude:plugin prune --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name | status      | reasons           | scope   | version |
      | tools            | project           | lib@tools | lib  | uninstalled | dependency pruned | project | 1.2.0   |
    Then the project scope has no installed plugins
    Then the "claude-plugins.local.json" file of the project scope declares no plugins

  Scenario: Pruning refuses and keeps the dependency while a config file of the scope is invalid
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib          |
      | lib  | 1.2.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install app@tools --scope project"
    Given the user has run "/claude:plugin uninstall app@tools --scope project"
    Given a config in scope project and layer local, with this text:
      """
      { not json
      """
    When the user runs "/claude:plugin prune --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id              | name    | status | reasons    | scope   | cause chain                                                      | cause truncated | leaks | rollback partial |
      | (prune)          | project           | (prune)@(prune) | (prune) | failed | unreadable | project | Config file "claude-plugins.local.json" failed schema validation. | false           |       |                  |
    Then the installation record of the project scope holds these plugins:
      | id        | version | enabled |
      | lib@tools | 1.2.0   | true    |
    Then the project scope stages these skills and prompts:
      | kind  | name      |
      | skill | lib-skill |
    Then the "claude-plugins.local.json" file of the project scope holds this text:
      """
      { not json
      """

  Scenario Outline: Pruning a scope with nothing to remove reports the empty scope and changes no file of it (D-12-01)
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib          |
      | lib  | 1.2.0   |              |
    Given the marketplace "tools" is added to the <scope> scope
    Given the user has run "/claude:plugin install app@tools --scope <scope>"
    Given the files of the <scope> scope are remembered
    When the user runs "/claude:plugin <arguments>"
    Then the result has these fields:
      | kind         | prune-empty |
      | severity     | info        |
      | needs reload | false       |
      | scope        | <scope>     |
    Then the files of the <scope> scope are unchanged

    Examples:
      | arguments                       | scope   |
      | prune                           | user    |
      | prune --scope user              | user    |
      | prune --scope project           | project |
      | prune --dry-run                 | user    |
      | prune --scope user --dry-run    | user    |
      | prune --dry-run --scope project | project |
      | prune --scope project --dry-run | project |

  Scenario Outline: Pruning reports an installation record that is not valid json without its path and changes no file (PRN-03)
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib          |
      | lib  | 1.2.0   |              |
    Given the marketplace "tools" is added to the <scope> scope
    Given the user has run "/claude:plugin install app@tools --scope <scope>"
    Given the user has run "/claude:plugin uninstall app@tools --scope <scope>"
    Given the installation record of the <scope> scope to prune is not valid json
    Given the files of the <scope> scope are remembered
    When the user runs "/claude:plugin <arguments>"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id              | name    | status | reasons    | scope   | cause chain                                                                                                                                                                         | cause truncated | leaks | rollback partial |
      | (prune)          | <scope>           | (prune)@(prune) | (prune) | failed | unreadable | <scope> | state.json at state.json is not valid JSON: Expected property name or '}' in JSON at position 1 (line 1 column 2), Expected property name or '}' in JSON at position 1 (line 1 column 2) | false           |       |                  |
    Then the command result contains no absolute sandbox path
    Then the files of the <scope> scope are unchanged

    Examples:
      | arguments                       | scope   |
      | prune                           | user    |
      | prune --dry-run                 | user    |
      | prune --scope project           | project |
      | prune --scope project --dry-run | project |

  Scenario Outline: Pruning refuses a flag or an argument it does not take before it selects any dependency (D-02-05)
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib          |
      | lib  | 1.2.0   |              |
    Given the marketplace "tools" is added to the user scope
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install app@tools --scope user"
    Given the user has run "/claude:plugin uninstall app@tools --scope user"
    Given the user has run "/claude:plugin install app@tools --scope project"
    Given the user has run "/claude:plugin uninstall app@tools --scope project"
    Given the files of the user scope are remembered
    Given the files of the project scope are remembered
    When the user runs "/claude:plugin <arguments>"
    Then the result has these fields:
      | kind         | usage-error                                                     |
      | severity     | error                                                           |
      | needs reload | false                                                           |
      | message      | <message>                                                       |
      | usage        | Usage: /claude:plugin prune [--scope user\|project] [--dry-run] |
    Then the files of the user scope are unchanged
    Then the files of the project scope are unchanged

    Examples:
      | arguments         | message                      |
      | prune -y          | Unknown flag: "-y".          |
      | prune --keep-data | Unknown flag: "--keep-data". |
      | prune --prune     | Unknown flag: "--prune".     |
      | prune --bogus     | Unknown flag: "--bogus".     |
      | prune lib@tools   | Too many arguments.          |

  Scenario: Pruning after a preview selects again from what the scope holds now
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name  | version | dependencies |
      | app   | 1.0.0   | old          |
      | tool  | 1.0.0   | fresh        |
      | old   | 1.1.0   |              |
      | fresh | 1.2.0   |              |
    Given the marketplace "tools" is added to the user scope
    Given the user has run "/claude:plugin install app@tools"
    Given the user has run "/claude:plugin uninstall app@tools"
    Given the user has previewed the prune with "/claude:plugin prune --dry-run", which listed these plugins:
      | marketplace name | marketplace scope | id        | name | status         | reasons           | scope | version |
      | tools            | user              | old@tools | old  | will uninstall | dependency pruned | user  | 1.1.0   |
    Given the user has run "/claude:plugin install old@tools"
    Given the user has run "/claude:plugin install tool@tools"
    Given the user has run "/claude:plugin uninstall tool@tools"
    When the user runs "/claude:plugin prune"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id          | name  | status      | reasons           | scope | version |
      | tools            | user              | fresh@tools | fresh | uninstalled | dependency pruned | user  | 1.2.0   |
    Then the installation record of the user scope holds these plugins:
      | id        | version | enabled |
      | old@tools | 1.1.0   | true    |
    Then the user scope stages these skills and prompts:
      | kind  | name      |
      | skill | old-skill |

  Scenario: Pruning removes a dependency chain dependents first, in the order its preview listed (D-05-01)
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | mid          |
      | mid  | 1.1.0   | lib          |
      | lib  | 1.2.0   |              |
    Given the marketplace "tools" is added to the user scope
    Given the user has run "/claude:plugin install app@tools"
    Given the user has run "/claude:plugin uninstall app@tools"
    Given the user has previewed the prune with "/claude:plugin prune --dry-run", which listed these plugins:
      | marketplace name | marketplace scope | id        | name | status         | reasons           | scope | version |
      | tools            | user              | mid@tools | mid  | will uninstall | dependency pruned | user  | 1.1.0   |
      | tools            | user              | lib@tools | lib  | will uninstall | dependency pruned | user  | 1.2.0   |
    When the user runs "/claude:plugin prune"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name | status      | reasons           | scope | version |
      | tools            | user              | mid@tools | mid  | uninstalled | dependency pruned | user  | 1.1.0   |
      | tools            | user              | lib@tools | lib  | uninstalled | dependency pruned | user  | 1.2.0   |
    Then the user scope has no installed plugins

  Scenario: Pruning across two marketplaces removes a chain that alternates between them and keeps what installed plugins hold (D-05-04)
    Given the marketplace "alpha" is published as a dir source
    Given the marketplace "beta" is published as a dir source
    Given the marketplace "alpha" offers these plugins with dependencies:
      | name     | version | dependencies |
      | roota    | 1.0.0   | a            |
      | a        | 1.0.0   | b@beta       |
      | c        | 1.0.0   |              |
      | disabled | 1.0.0   | paused       |
      | paused   | 1.0.0   |              |
    Given the marketplace "beta" offers these plugins with dependencies:
      | name   | version | dependencies |
      | rootz  | 1.0.0   | z            |
      | z      | 1.0.0   | c@alpha      |
      | b      | 1.0.0   | c@alpha      |
      | keeper | 1.0.0   | held         |
      | held   | 1.0.0   |              |
    Given the marketplace "alpha" allows dependencies on the marketplace "beta"
    Given the marketplace "beta" allows dependencies on the marketplace "alpha"
    Given the marketplace "alpha" is added to the project scope
    Given the marketplace "beta" is added to the project scope
    Given the user has run "/claude:plugin install roota@alpha --scope project"
    Given the user has run "/claude:plugin install rootz@beta --scope project"
    Given the user has run "/claude:plugin install disabled@alpha --scope project"
    Given the user has run "/claude:plugin disable disabled@alpha --scope project"
    Given the user has run "/claude:plugin install keeper@beta --scope project"
    Given the user has run "/claude:plugin uninstall roota@alpha --scope project"
    Given the user has run "/claude:plugin uninstall rootz@beta --scope project"
    Given the user has previewed the prune with "/claude:plugin prune --scope project --dry-run", which listed these plugins:
      | marketplace name | marketplace scope | id      | name | status         | reasons           | scope   | version |
      | alpha            | project           | a@alpha | a    | will uninstall | dependency pruned | project | 1.0.0   |
      | beta             | project           | z@beta  | z    | will uninstall | dependency pruned | project | 1.0.0   |
      | beta             | project           | b@beta  | b    | will uninstall | dependency pruned | project | 1.0.0   |
      | alpha            | project           | c@alpha | c    | will uninstall | dependency pruned | project | 1.0.0   |
    When the user runs "/claude:plugin prune --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id      | name | status      | reasons           | scope   | version |
      | alpha            | project           | a@alpha | a    | uninstalled | dependency pruned | project | 1.0.0   |
      | beta             | project           | z@beta  | z    | uninstalled | dependency pruned | project | 1.0.0   |
      | beta             | project           | b@beta  | b    | uninstalled | dependency pruned | project | 1.0.0   |
      | alpha            | project           | c@alpha | c    | uninstalled | dependency pruned | project | 1.0.0   |
    Then the installation record of the project scope holds these plugins:
      | id             | version | enabled |
      | disabled@alpha | 1.0.0   | false   |
      | held@beta      | 1.0.0   | true    |
      | keeper@beta    | 1.0.0   | true    |
      | paused@alpha   | 1.0.0   | true    |
    Then the project scope stages these skills and prompts:
      | kind  | name         |
      | skill | held-skill   |
      | skill | keeper-skill |
      | skill | paused-skill |

  Scenario: Pruning the project scope removes its dependency and changes no file of the user scope
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib          |
      | lib  | 1.2.0   |              |
    Given the marketplace "tools" is added to the user scope
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install app@tools --scope user"
    Given the user has run "/claude:plugin uninstall app@tools --scope user"
    Given the user has run "/claude:plugin install app@tools --scope project"
    Given the user has run "/claude:plugin uninstall app@tools --scope project"
    Given the files of the user scope are remembered
    When the user runs "/claude:plugin prune --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name | status      | reasons           | scope   | version |
      | tools            | project           | lib@tools | lib  | uninstalled | dependency pruned | project | 1.2.0   |
    Then the project scope has no installed plugins
    Then the files of the user scope are unchanged

  Scenario: Previewing a prune of a project scope that holds no installation record changes no file of either scope
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib          |
      | lib  | 1.2.0   |              |
    Given the marketplace "tools" is added to the user scope
    Given the user has run "/claude:plugin install app@tools --scope user"
    Given the user has run "/claude:plugin uninstall app@tools --scope user"
    Given the project scope to prune exists and holds no files
    Given the files of the user scope are remembered
    Given the files of the project scope are remembered
    When the user runs "/claude:plugin prune --scope project --dry-run"
    Then the result has these fields:
      | kind         | prune-empty |
      | severity     | info        |
      | needs reload | false       |
      | scope        | project     |
    Then the files of the project scope are unchanged
    Then the files of the user scope are unchanged

  Scenario Outline: Pruning refuses while the manifest of an installed plugin cannot be read and changes no file of either scope (D-05-07)
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib          |
      | tool | 1.0.0   | mid          |
      | mid  | 1.1.0   |              |
      | lib  | 1.2.0   |              |
    Given the marketplace "tools" is added to the user scope
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install app@tools --scope user"
    Given the user has run "/claude:plugin install tool@tools --scope user"
    Given the user has run "/claude:plugin uninstall tool@tools --scope user"
    Given the user has run "/claude:plugin install app@tools --scope project"
    Given the user has run "/claude:plugin install tool@tools --scope project"
    Given the user has run "/claude:plugin uninstall tool@tools --scope project"
    Given the published plugin "app" of the marketplace "tools" has the file ".claude-plugin/plugin.json" with this text:
      """
      {
      """
    Given the files of the user scope are remembered
    Given the files of the project scope are remembered
    When the user runs "/claude:plugin <arguments>"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name | status | reasons    | scope   | cause chain                                                                               | cause truncated | leaks | rollback partial |
      | tools            | <scope>           | app@tools | app  | failed | unreadable | <scope> | cannot read the dependencies of app@tools: its own manifest is present but cannot be read | false           |       |                  |
    Then the files of the user scope are unchanged
    Then the files of the project scope are unchanged

    Examples:
      | arguments                       | scope   |
      | prune                           | user    |
      | prune --dry-run                 | user    |
      | prune --scope project           | project |
      | prune --scope project --dry-run | project |

  Scenario: Pruning keeps a dependency whose dependent it could not remove (D-05-13)
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | mid, free    |
      | mid  | 1.1.0   | lib          |
      | free | 1.3.0   |              |
      | lib  | 1.2.0   |              |
    Given the published plugin "mid" of the marketplace "tools" has a read-only skill directory
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install app@tools --scope project"
    Given the user has run "/claude:plugin uninstall app@tools --scope project"
    When the user runs "/claude:plugin prune --scope project"
    Then the result has these fields:
      | kind         | cascade                             |
      | severity     | warning                             |
      | needs reload | true                                |
      | summary      | A plugin operation needs attention. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id         | name | status      | reasons           | scope   | version | cause chain                               | cause truncated | leaks | rollback partial |
      | tools            | project           | free@tools | free | uninstalled | dependency pruned | project | 1.3.0   |                                           |                 |       |                  |
      | tools            | project           | mid@tools  | mid  | failed      | permission denied | project | 1.1.0   | {read-only skill directory removal error} | false           |       |                  |
    Then the installation record of the project scope holds these plugins:
      | id        | version | enabled |
      | lib@tools | 1.2.0   | true    |
      | mid@tools | 1.1.0   | true    |
    Then the project scope stages these skills and prompts:
      | kind  | name      |
      | skill | lib-skill |
      | skill | mid-skill |

  Scenario: Pruning again after the user repairs what a prune could not remove removes the dependent and its dependency (D-05-13)
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | mid, free    |
      | mid  | 1.1.0   | lib          |
      | free | 1.3.0   |              |
      | lib  | 1.2.0   |              |
    Given the published plugin "mid" of the marketplace "tools" has a read-only skill directory
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install app@tools --scope project"
    Given the user has run "/claude:plugin uninstall app@tools --scope project"
    Given the user has run "/claude:plugin prune --scope project", which warned
    Given the user has made the skills the prune could not remove in the project scope writable
    When the user runs "/claude:plugin prune --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name | status      | reasons           | scope   | version |
      | tools            | project           | mid@tools | mid  | uninstalled | dependency pruned | project | 1.1.0   |
      | tools            | project           | lib@tools | lib  | uninstalled | dependency pruned | project | 1.2.0   |
    Then the project scope has no installed plugins

  Scenario: Pruning leaves no backup in the scope when it could not remove a member (NFR-3)
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | mid, free    |
      | mid  | 1.1.0   | lib          |
      | free | 1.3.0   |              |
      | lib  | 1.2.0   |              |
    Given the published plugin "mid" of the marketplace "tools" has a read-only skill directory
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install app@tools --scope project"
    Given the user has run "/claude:plugin uninstall app@tools --scope project"
    When the user runs "/claude:plugin prune --scope project"
    Then the result has these fields:
      | kind         | cascade                             |
      | severity     | warning                             |
      | needs reload | true                                |
      | summary      | A plugin operation needs attention. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id         | name | status      | reasons           | scope   | version | cause chain                               | cause truncated | leaks | rollback partial |
      | tools            | project           | free@tools | free | uninstalled | dependency pruned | project | 1.3.0   |                                           |                 |       |                  |
      | tools            | project           | mid@tools  | mid  | failed      | permission denied | project | 1.1.0   | {read-only skill directory removal error} | false           |       |                  |
    Then the prune has left no backup in the project scope

  Scenario: Previewing a prune of a record an earlier release wrote lists nothing and changes no file (D-04-03)
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib          |
      | lib  | 1.2.0   |              |
    Given the marketplace "tools" is added to the user scope
    Given the user has run "/claude:plugin install app@tools --scope user"
    Given the user has run "/claude:plugin uninstall app@tools --scope user"
    Given the installation record of the user scope is rewritten as release "0.19.2" wrote it
    Given the files of the user scope are remembered
    When the user runs "/claude:plugin prune --dry-run"
    Then the result has these fields:
      | kind         | prune-empty |
      | severity     | info        |
      | needs reload | false       |
      | scope        | user        |
    Then the files of the user scope are unchanged
