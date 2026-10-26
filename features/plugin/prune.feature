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

  Scenario: Previewing a prune lists the dependency it would uninstall and removes nothing
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib          |
      | lib  | 1.2.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install app@tools --scope project"
    Given the user has run "/claude:plugin uninstall app@tools --scope project"
    When the user runs "/claude:plugin prune --scope project --dry-run"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name | status         | reasons           | scope   | version |
      | tools            | project           | lib@tools | lib  | will uninstall | dependency pruned | project | 1.2.0   |
    Then the installation record of the project scope holds these plugins:
      | id        | version | enabled |
      | lib@tools | 1.2.0   | true    |
    Then the project scope stages these skills and prompts:
      | kind  | name      |
      | skill | lib-skill |

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
