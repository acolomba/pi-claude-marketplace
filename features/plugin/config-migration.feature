Feature: Plugin config migration

  A user who upgrades from a release with no config gets one written from the installation
  records on the first load. An earlier release's installation record, and a config the user
  deleted, stand in for the upgrade, and a local marketplace stands in for a published one.

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
