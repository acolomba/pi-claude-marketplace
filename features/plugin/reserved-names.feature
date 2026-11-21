Feature: Plugin reserved names

  Names that are Object.prototype members, such as constructor and __proto__, work as
  ordinary plugin names or are refused as Claude Code refuses them. The scenarios run the
  real extension in a headless Pi with local marketplaces and a Claude Code settings file.

  Scenario: Installing a plugin named constructor records it as an ordinary plugin (D-08-07)
    Given the marketplace "mp" is published as a dir source
    Given the marketplace "mp" offers these plugins:
      | name        | version |
      | constructor | 1.0.0   |
      | hello       | 1.0.0   |
    Given the marketplace "mp" is added to the project scope
    When the user runs "/claude:plugin install constructor@mp --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id             | name        | status    | reasons | scope   | version |
      | mp               | project           | constructor@mp | constructor | installed |         | project | 1.0.0   |
    Then the installation record of the project scope holds these plugins:
      | id             | version | enabled |
      | constructor@mp | 1.0.0   | true    |
    Then the "claude-plugins.json" file of the project scope declares these plugins:
      | id             |
      | constructor@mp |
    Then the project scope stages these skills and prompts:
      | kind  | name              |
      | skill | constructor-skill |

  Scenario: The plugin list shows an installed plugin named constructor beside the marketplace's other plugins (D-08-07)
    Given the marketplace "mp" is published as a dir source
    Given the marketplace "mp" offers these plugins:
      | name        | version |
      | constructor | 1.0.0   |
      | hello       | 1.0.0   |
    Given the marketplace "mp" is added to the project scope
    Given the user has run "/claude:plugin install constructor@mp --scope project"
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
      | marketplace name | marketplace scope | id             | name        | status    | reasons | scope   | version |
      | mp               | project           | constructor@mp | constructor | installed |         | project | 1.0.0   |
      | mp               | project           | hello@mp       | hello       | available |         |         | 1.0.0   |

  Scenario: Info on an installed plugin named constructor shows its installed version and its skills (D-08-07)
    Given the marketplace "mp" is published as a dir source
    Given the marketplace "mp" offers these plugins:
      | name        | version |
      | constructor | 1.0.0   |
      | hello       | 1.0.0   |
    Given the marketplace "mp" is added to the project scope
    Given the user has run "/claude:plugin install constructor@mp --scope project"
    When the user runs "/claude:plugin info constructor@mp"
    Then the result has these fields:
      | kind                           | plugin-info       |
      | marketplace details autoupdate | false             |
      | marketplace name               | mp                |
      | marketplace scope              | project           |
      | needs reload                   | false             |
      | plugin components resolved     | true              |
      | plugin components skills       | constructor-skill |
      | plugin id                      | constructor@mp    |
      | plugin name                    | constructor       |
      | plugin reasons                 |                   |
      | plugin scope                   | project           |
      | plugin status                  | installed         |
      | plugin version                 | 1.0.0             |
      | severity                       | info              |

  Scenario: Disabling a plugin named constructor records it disabled (D-08-07)
    Given the marketplace "mp" is published as a dir source
    Given the marketplace "mp" offers these plugins:
      | name        | version |
      | constructor | 1.0.0   |
      | hello       | 1.0.0   |
    Given the marketplace "mp" is added to the project scope
    Given the user has run "/claude:plugin install constructor@mp --scope project"
    When the user runs "/claude:plugin disable constructor@mp --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id             | name        | status   | reasons | scope   | version |
      | mp               | project           | constructor@mp | constructor | disabled |         | project | 1.0.0   |
    Then the installation record of the project scope holds these plugins:
      | id             | version | enabled |
      | constructor@mp | 1.0.0   | false   |
    Then the "claude-plugins.json" file of the project scope declares these plugins:
      | id             | enabled |
      | constructor@mp | false   |

  Scenario: Enabling a disabled plugin named constructor records it enabled again (D-08-07)
    Given the marketplace "mp" is published as a dir source
    Given the marketplace "mp" offers these plugins:
      | name        | version |
      | constructor | 1.0.0   |
      | hello       | 1.0.0   |
    Given the marketplace "mp" is added to the project scope
    Given the user has run "/claude:plugin install constructor@mp --scope project"
    Given the user has run "/claude:plugin disable constructor@mp --scope project"
    When the user runs "/claude:plugin enable constructor@mp --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id             | name        | status    | reasons | scope   | version |
      | mp               | project           | constructor@mp | constructor | installed |         | project | 1.0.0   |
    Then the installation record of the project scope holds these plugins:
      | id             | version | enabled |
      | constructor@mp | 1.0.0   | true    |
    Then the project scope stages these skills and prompts:
      | kind  | name              |
      | skill | constructor-skill |

  Scenario: Updating a plugin named constructor records the version its marketplace now offers (D-08-07)
    Given the marketplace "mp" is published as a dir source
    Given the marketplace "mp" offers these plugins:
      | name        | version |
      | constructor | 1.0.0   |
      | hello       | 1.0.0   |
    Given the marketplace "mp" is added to the project scope
    Given the user has run "/claude:plugin install constructor@mp --scope project"
    Given the marketplace "mp" offers these plugins:
      | name        | version |
      | constructor | 1.1.0   |
      | hello       | 1.0.0   |
    When the user runs "/claude:plugin update constructor@mp --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id             | name        | status  | reasons | scope   | from  | to    |
      | mp               | project           | constructor@mp | constructor | updated |         | project | 1.0.0 | 1.1.0 |
    Then the installation record of the project scope holds these plugins:
      | id             | version | enabled |
      | constructor@mp | 1.1.0   | true    |

  Scenario: Updating the marketplace of an installed plugin named constructor keeps the installed version (D-08-07)
    Given the marketplace "mp" is published as a dir source
    Given the marketplace "mp" offers these plugins:
      | name        | version |
      | constructor | 1.0.0   |
      | hello       | 1.0.0   |
    Given the marketplace "mp" is added to the project scope
    Given the user has run "/claude:plugin install constructor@mp --scope project"
    Given the marketplace "mp" offers these plugins:
      | name        | version |
      | constructor | 1.1.0   |
      | hello       | 1.0.0   |
    When the user runs "/claude:plugin marketplace update mp --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | marketplace status |
      | mp               | project           | updated            |
    Then the installation record of the project scope holds these plugins:
      | id             | version | enabled |
      | constructor@mp | 1.0.0   | true    |

  Scenario: Uninstalling a plugin named constructor removes its record (D-08-07)
    Given the marketplace "mp" is published as a dir source
    Given the marketplace "mp" offers these plugins:
      | name        | version |
      | constructor | 1.0.0   |
      | hello       | 1.0.0   |
    Given the marketplace "mp" is added to the project scope
    Given the user has run "/claude:plugin install constructor@mp --scope project"
    When the user runs "/claude:plugin uninstall constructor@mp --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id             | name        | status      | reasons | scope   | version |
      | mp               | project           | constructor@mp | constructor | uninstalled |         | project | 1.0.0   |
    Then the installation record of the project scope holds no plugins
    Then the "claude-plugins.json" file of the project scope declares no plugins

  Scenario: Removing the marketplace of a plugin named constructor uninstalls it (D-08-07)
    Given the marketplace "mp" is published as a dir source
    Given the marketplace "mp" offers these plugins:
      | name        | version |
      | constructor | 1.0.0   |
      | hello       | 1.0.0   |
    Given the marketplace "mp" is added to the project scope
    Given the user has run "/claude:plugin install constructor@mp --scope project"
    When the user runs "/claude:plugin marketplace remove mp --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace status | id             | name        | status      | reasons | scope   |
      | mp               | project           | removed            | constructor@mp | constructor | uninstalled |         | project |
    Then the project scope holds no marketplace record

  Scenario: Importing a plugin named constructor installs it and declares it in the project config (D-08-07)
    Given the marketplace "mp" is published as a dir source
    Given the marketplace "mp" offers these plugins:
      | name        | version |
      | constructor | 1.0.0   |
      | hello       | 1.0.0   |
    Given the claude code settings file of the project scope holds this text:
      """
      {
        "enabledPlugins": { "constructor@mp": true },
        "extraKnownMarketplaces": {
          "mp": {
            "source": { "source": "directory", "path": "{home}/marketplaces/mp" }
          }
        }
      }
      """
    When the user runs "/claude:plugin import --scope project"
    Then the result has these fields:
      | kind                | cascade |
      | severity            | info    |
      | needs reload        | true    |
      | tally label         | Import  |
      | tally failures      | 0       |
      | tally warnings      | 0       |
      | tally success count | 2       |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace status | id             | name        | version | status    | reasons | scope   |
      | mp               | project           | added              | constructor@mp | constructor | 1.0.0   | installed |         | project |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name | source                 |
      | mp   | {home}/marketplaces/mp |
    Then the "claude-plugins.json" file of the project scope declares these plugins:
      | id             |
      | constructor@mp |
    Then the installation record of the project scope holds these plugins:
      | id             | version | enabled |
      | constructor@mp | 1.0.0   | true    |

  Scenario: Disabling an imported plugin named constructor writes its config entry back as disabled (D-08-07)
    Given the marketplace "mp" is published as a dir source
    Given the marketplace "mp" offers these plugins:
      | name        | version |
      | constructor | 1.0.0   |
      | hello       | 1.0.0   |
    Given the claude code settings file of the project scope holds this text:
      """
      {
        "enabledPlugins": { "constructor@mp": true },
        "extraKnownMarketplaces": {
          "mp": {
            "source": { "source": "directory", "path": "{home}/marketplaces/mp" }
          }
        }
      }
      """
    Given the user has run "/claude:plugin import --scope project"
    When the user runs "/claude:plugin disable constructor@mp --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id             | name        | status   | reasons | scope   | version |
      | mp               | project           | constructor@mp | constructor | disabled |         | project | 1.0.0   |
    Then the "claude-plugins.json" file of the project scope declares these plugins:
      | id             | enabled |
      | constructor@mp | false   |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name | source                 |
      | mp   | {home}/marketplaces/mp |

  Scenario: Uninstalling an imported plugin named constructor removes its config entry (D-08-07)
    Given the marketplace "mp" is published as a dir source
    Given the marketplace "mp" offers these plugins:
      | name        | version |
      | constructor | 1.0.0   |
      | hello       | 1.0.0   |
    Given the claude code settings file of the project scope holds this text:
      """
      {
        "enabledPlugins": { "constructor@mp": true },
        "extraKnownMarketplaces": {
          "mp": {
            "source": { "source": "directory", "path": "{home}/marketplaces/mp" }
          }
        }
      }
      """
    Given the user has run "/claude:plugin import --scope project"
    When the user runs "/claude:plugin uninstall constructor@mp --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id             | name        | status      | reasons | scope   | version |
      | mp               | project           | constructor@mp | constructor | uninstalled |         | project | 1.0.0   |
    Then the "claude-plugins.json" file of the project scope declares no plugins
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name | source                 |
      | mp   | {home}/marketplaces/mp |
    Then the installation record of the project scope holds no plugins

  Scenario: Applying a config that declares a plugin named constructor installs it (D-08-07)
    Given the marketplace "mp" is published as a dir source
    Given the marketplace "mp" offers these plugins:
      | name        | version |
      | constructor | 1.0.0   |
      | hello       | 1.0.0   |
    Given a config in scope project and layer base, with these marketplaces:
      | name | source                 | autoupdate |
      | mp   | {home}/marketplaces/mp |            |
    Given a config in scope project and layer base, with these plugins:
      | marketplace | plugin      | enabled |
      | mp          | constructor |         |
    When the user runs "/claude:plugin apply --scope project"
    Then the result has these fields:
      | kind                | reconcile-applied-cascade |
      | severity            | info                      |
      | needs reload        | true                      |
      | tally label         | Reconcile                 |
      | tally failures      | 0                         |
      | tally warnings      | 0                         |
      | tally success count | 2                         |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace status | id             | name        | status    | reasons | scope   | version |
      | mp               | project           | added              | constructor@mp | constructor | installed |         | project | 1.0.0   |
    Then the installation record of the project scope holds these plugins:
      | id             | version | enabled |
      | constructor@mp | 1.0.0   | true    |

  Scenario: Applying a config that declares a plugin of a marketplace named constructor refuses the marketplace and records nothing (D-PL5-28)
    Given the marketplace "constructor" is published as a dir source
    Given the marketplace "constructor" offers these plugins:
      | name  | version |
      | hello | 1.0.0   |
    Given a config in scope project and layer base, with these marketplaces:
      | name        | source                          | autoupdate |
      | constructor | {home}/marketplaces/constructor |            |
    Given a config in scope project and layer base, with these plugins:
      | marketplace | plugin | enabled |
      | constructor | hello  |         |
    When the user runs "/claude:plugin apply --scope project"
    Then the result has these fields:
      | kind           | reconcile-applied-cascade    |
      | needs reload   | false                        |
      | severity       | error                        |
      | summary        | Some operations have failed. |
      | tally failures | 2                            |
      | tally label    | Reconcile                    |
      | tally warnings | 0                            |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace status | marketplace reasons | id                | name  | status | reasons    | scope   | leaks | rollback partial |
      | constructor      | project           | failed             | invalid manifest    | hello@constructor | hello | failed | unreadable | project |       |                  |
    Then the project scope holds no marketplace record
    Then the project scope holds no marketplace checkout

  Scenario: The plugin list shows a plugin named __proto__ as unavailable as an unsupported source (D-08-07)
    Given the marketplace "hostile" is published as a dir source
    Given the marketplace "hostile" offers these plugins:
      | name      | version |
      | __proto__ | 1.0.0   |
      | hello     | 1.0.0   |
    Given the marketplace "hostile" is added to the project scope
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
      | marketplace name | marketplace scope | id                | name      | status      | reasons            | version |
      | hostile          | project           | __proto__@hostile | __proto__ | unavailable | unsupported source | 1.0.0   |
      | hostile          | project           | hello@hostile     | hello     | available   |                    | 1.0.0   |

  Scenario: Installing a plugin named __proto__ fails as an invalid plugin id and changes nothing (D-08-07)
    Given the marketplace "hostile" is published as a dir source
    Given the marketplace "hostile" offers these plugins:
      | name      | version |
      | __proto__ | 1.0.0   |
      | hello     | 1.0.0   |
    Given the marketplace "hostile" is added to the project scope
    Given the user has run "/claude:plugin install hello@hostile --scope project"
    Given the config and installation record bytes of the project scope are remembered
    When the user runs "/claude:plugin install __proto__@hostile --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id                | name      | status | reasons          | scope   | cause chain                                                                                                                                                                                                                                                                                                      | cause truncated | leaks | rollback partial |
      | hostile          | project           | __proto__@hostile | __proto__ | failed | invalid manifest | project | Plugin "__proto__@hostile" cannot be installed, because its id is invalid: Each part of a plugin id (plugin@marketplace) may use only the letters a-z and A-Z, digits, ".", "_" and "-", and must start with a letter or digit. Here the plugin's name does not; the marketplace's maintainer can rename it. | false           |       |                  |
    Then the config and installation record bytes of the project scope are unchanged
    Then the "claude-plugins.local.json" file of the project scope does not exist
    Then the project scope stages these skills and prompts:
      | kind  | name        |
      | skill | hello-skill |

  Scenario Outline: A command that names the absent marketplace constructor fails as marketplace not added and changes nothing (D-08-07)
    Given the marketplace "mp" is published as a dir source
    Given the marketplace "mp" offers these plugins:
      | name  | version |
      | hello | 1.0.0   |
    Given the marketplace "mp" is added to the project scope
    Given the user has run "/claude:plugin install hello@mp --scope project"
    Given the config and installation record bytes of the project scope are remembered
    When the user runs "/claude:plugin <command>"
    Then the result has these fields:
      | kind         | marketplace-not-added               |
      | severity     | error                               |
      | needs reload | false                               |
      | summary      | A marketplace operation has failed. |
      | name         | constructor                         |
      | reasons      | marketplace not added               |
    Then the config and installation record bytes of the project scope are unchanged
    Then the project scope stages these skills and prompts:
      | kind  | name        |
      | skill | hello-skill |

    Examples:
      | command                        |
      | info x@constructor             |
      | reinstall x@constructor        |
      | marketplace update constructor |
      | marketplace remove constructor |

  Scenario Outline: A command on a plugin named constructor that is not installed fails as not installed and changes nothing (D-08-07)
    Given the marketplace "mp" is published as a dir source
    Given the marketplace "mp" offers these plugins:
      | name  | version |
      | hello | 1.0.0   |
    Given the marketplace "mp" is added to the project scope
    Given the user has run "/claude:plugin install hello@mp --scope project"
    Given the config and installation record bytes of the project scope are remembered
    When the user runs "/claude:plugin <verb> constructor@mp --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id             | name        | status | reasons       | scope   | leaks | rollback partial |
      | mp               | project           | constructor@mp | constructor | failed | not installed | project |       |                  |
    Then the config and installation record bytes of the project scope are unchanged
    Then the project scope stages these skills and prompts:
      | kind  | name        |
      | skill | hello-skill |

    Examples:
      | verb      |
      | uninstall |
      | reinstall |
      | update    |

  Scenario: Enabling a plugin named constructor that is not installed is skipped as not installed and changes nothing (D-08-07)
    Given the marketplace "mp" is published as a dir source
    Given the marketplace "mp" offers these plugins:
      | name  | version |
      | hello | 1.0.0   |
    Given the marketplace "mp" is added to the project scope
    Given the user has run "/claude:plugin install hello@mp --scope project"
    Given the config and installation record bytes of the project scope are remembered
    When the user runs "/claude:plugin enable constructor@mp --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id             | name        | status  | reasons       | scope   |
      | mp               | project           | constructor@mp | constructor | skipped | not installed | project |
    Then the config and installation record bytes of the project scope are unchanged
    Then the project scope stages these skills and prompts:
      | kind  | name        |
      | skill | hello-skill |
