Feature: Plugin config migration

  A user who upgrades from a release with no config gets one written from the installation
  records on the first load, and no later load rewrites it. An earlier release's record and a
  config the user deleted stand in for the upgrade; directory marketplaces stand in for published ones.

  Background:
    Given the marketplace "fixtures" is published as a dir source

  Scenario: The first load after an upgrade from release 0.4.3 writes the config from the records
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin marketplace autoupdate fixtures --scope user"
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user scope holds what release 0.4.3 left: its installation record and no config
    When the user starts a new pi session
    Then the session reports no results
    Then the "claude-plugins.json" file of the user scope declares these marketplaces:
      | name     | source                       | autoupdate |
      | fixtures | {home}/marketplaces/fixtures | true       |
    Then the "claude-plugins.json" file of the user scope declares these plugins:
      | id            |
      | demo@fixtures |

  Scenario: The first load after the user deleted the config writes it with a disabled plugin's enabled state
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user has run "/claude:plugin disable demo@fixtures --scope user"
    Given the user has deleted the config files of the user scope
    When the user starts a new pi session
    Then the session reports no results
    Then the "claude-plugins.json" file of the user scope declares these marketplaces:
      | name     | source                       |
      | fixtures | {home}/marketplaces/fixtures |
    Then the "claude-plugins.json" file of the user scope declares these plugins:
      | id            | enabled |
      | demo@fixtures | false   |

  Scenario: Pending shows nothing to apply after the first load rebuilt the user config
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user has run "/claude:plugin disable demo@fixtures --scope user"
    Given the user has deleted the config files of the user scope
    Given the user has started a new pi session
    When the user runs "/claude:plugin pending --scope user"
    Then the result has these fields:
      | kind         | reconcile-pending-empty |
      | severity     | info                    |
      | needs reload | false                   |

  Scenario: The first load after the user deleted the config leaves out a plugin installed only as a dependency
    Given the marketplace "fixtures" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | demo         |
      | demo | 1.0.0   |              |
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install app@fixtures --scope user"
    Given the user has deleted the config files of the user scope
    When the user starts a new pi session
    Then the session reports no results
    Then the "claude-plugins.json" file of the user scope declares these plugins:
      | id           |
      | app@fixtures |
    Then the session offers these skills:
      | command           | description            |
      | /skill:app-skill  | A skill of app 1.0.0.  |
      | /skill:demo-skill | A skill of demo 1.0.0. |

  Scenario: The first load after the user deleted the config declares a dependency the user disabled as disabled
    Given the marketplace "fixtures" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | demo         |
      | demo | 1.0.0   |              |
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install app@fixtures --scope user"
    Given the user has run "/claude:plugin disable app@fixtures --scope user"
    Given the user has run "/claude:plugin disable demo@fixtures --scope user"
    Given the user has deleted the config files of the user scope
    When the user starts a new pi session
    Then the session reports no results
    Then the "claude-plugins.json" file of the user scope declares these plugins:
      | id            | enabled |
      | demo@fixtures | false   |
      | app@fixtures  | false   |

  Scenario: A later load keeps the user's edit to the config the first load wrote
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user has deleted the config files of the user scope
    Given the user has started a new pi session
    Given a config in scope user and layer base, with these plugins:
      | marketplace | plugin | enabled |
      | fixtures    | demo   | false   |
    Given the config and installation record bytes of the user scope are remembered
    When the user starts a new pi session
    Then the session reports these results:
      | kind    | severity | needs reload | needs apply | tally label       | tally failures | tally warnings | tally success count |
      | cascade | info     | false        | true        | Reconcile pending | 0              | 0              | 1                   |
      | cascade | info     | false        | true        | Reconcile pending | 0              | 0              | 1                   |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status       | reasons | scope |
      | fixtures         | user              | demo@fixtures | demo | will disable |         | user  |
      | fixtures         | user              | demo@fixtures | demo | will disable |         | user  |
    Then the config and installation record bytes of the user scope are unchanged

  Scenario: A reload in the terminal keeps the user's edit to the config the first load wrote
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" is added to the user scope
    Given pi runs with the scripted model
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user has deleted the config files of the user scope
    Given the user has started a new pi session
    Given a config in scope user and layer base, with these plugins:
      | marketplace | plugin | enabled |
      | fixtures    | demo   | false   |
    Given the config and installation record bytes of the user scope are remembered
    Given the scripted model plays these steps:
      | reply |
      | Done. |
    When the user reloads pi in the terminal and then prompts "after the reload"
    Then the model receives these calls:
      | call | role | text             |
      | 1    | user | after the reload |
    Then the config and installation record bytes of the user scope are unchanged

  Scenario: The first load after an upgrade from release 0.4.3 writes the project config with autoupdate off
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the user has run "/claude:plugin marketplace add {home}/marketplaces/fixtures --scope project"
    Given the user has run "/claude:plugin marketplace autoupdate fixtures --scope project"
    Given the user has run "/claude:plugin marketplace noautoupdate fixtures --scope project"
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the project scope holds what release 0.4.3 left: its installation record and no config
    When the user starts a new pi session
    Then the session reports no results
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name     | source                       | autoupdate |
      | fixtures | {home}/marketplaces/fixtures | false      |
    Then the "claude-plugins.json" file of the project scope declares these plugins:
      | id            |
      | demo@fixtures |

  Scenario: Pending shows nothing to apply after the first load rebuilt the project config
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the user has run "/claude:plugin marketplace add {home}/marketplaces/fixtures --scope project"
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has run "/claude:plugin disable demo@fixtures --scope project"
    Given the user has deleted the config files of the project scope
    Given the user has started a new pi session
    When the user runs "/claude:plugin pending --scope project"
    Then the result has these fields:
      | kind         | reconcile-pending-empty |
      | severity     | info                    |
      | needs reload | false                   |
    Then the "claude-plugins.json" file of the project scope declares these plugins:
      | id            | enabled |
      | demo@fixtures | false   |

  Scenario: The first load writes no project config when the local config declares every record
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the user has run "/claude:plugin marketplace add {home}/marketplaces/fixtures --scope project --local"
    Given the user has run "/claude:plugin install demo@fixtures --scope project --local"
    When the user starts a new pi session
    Then the session reports no results
    Then the "claude-plugins.json" file of the project scope does not exist
    Then the "claude-plugins.local.json" file of the project scope declares these plugins:
      | id            |
      | demo@fixtures |

  Scenario: The first load leaves the local config's marketplace out of the project config it writes
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | lib  | 1.0.0   |
    Given the user has run "/claude:plugin marketplace add {home}/marketplaces/fixtures --scope project"
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has run "/claude:plugin marketplace add {home}/marketplaces/tools --scope project"
    Given the user has run "/claude:plugin install lib@tools --scope project"
    Given the user has deleted the config files of the project scope
    Given a config in scope project and layer local, with these marketplaces:
      | name     | source                       | autoupdate |
      | fixtures | {home}/marketplaces/fixtures |            |
    Given a config in scope project and layer local, with these plugins:
      | marketplace | plugin | enabled |
      | fixtures    | demo   |         |
    When the user starts a new pi session
    Then the session reports no results
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name  | source                    |
      | tools | {home}/marketplaces/tools |
    Then the "claude-plugins.json" file of the project scope declares these plugins:
      | id        |
      | lib@tools |
