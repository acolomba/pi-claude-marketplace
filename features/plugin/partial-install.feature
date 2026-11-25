Feature: Plugin partial install

  A plugin with a component Pi does not support is partially available. Install changes nothing without
  --partial, and --partial installs only the supported parts. A plugin with no supported part is
  unavailable, and --partial does not install it. The scenarios use a headless Pi and a local marketplace.

  Scenario: Installing a partially available plugin without --partial fails as partially available
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has an output style
    Given the marketplace "fixtures" is added to the project scope
    When the user runs "/claude:plugin install demo@fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status              | reasons               | hint            |
      | fixtures         | project           | demo@fixtures | demo | partially-available | unsupported component | partial-install |
    Then the project scope has no installed plugins

  Scenario: Installing a partially available plugin with --partial installs only its supported part
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has an output style
    Given the marketplace "fixtures" is added to the project scope
    When the user runs "/claude:plugin install demo@fixtures --scope project --partial"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status              | reasons               | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | partially-installed | unsupported component | project | 1.0.0   |
    Then the installation record of the project scope holds these plugins:
      | id            | version | enabled |
      | demo@fixtures | 1.0.0   | true    |
    Then the "claude-plugins.json" file of the project scope declares these plugins:
      | id            |
      | demo@fixtures |
    Then the project scope stages these skills and prompts:
      | kind  | name       |
      | skill | demo-skill |

  Scenario: A reload offers the skills of a plugin installed with --partial
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has an output style
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project --partial"
    When the user reloads pi
    Then the session offers these skills:
      | command           | description            |
      | /skill:demo-skill | A skill of demo 1.0.0. |

  Scenario: The plugin info of a plugin installed with --partial reports an unsupported component left out
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has an output style
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project --partial"
    When the user runs "/claude:plugin info demo@fixtures"
    Then the result has these fields:
      | kind                           | plugin-info           |
      | severity                       | info                  |
      | needs reload                   | false                 |
      | marketplace name               | fixtures              |
      | marketplace scope              | project               |
      | marketplace details autoupdate | false                 |
      | plugin id                      | demo@fixtures         |
      | plugin name                    | demo                  |
      | plugin status                  | partially-installed   |
      | plugin reasons                 | unsupported component |
      | plugin scope                   | project               |
      | plugin version                 | 1.0.0                 |
      | plugin components resolved     | true                  |
      | plugin components skills       | demo-skill            |

  Scenario: Installing a plugin whose only component is an LSP server fails as unavailable, even with --partial (D-NSC-01)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" publishes this manifest:
      """
      {
        "name": "fixtures",
        "owner": { "name": "features" },
        "plugins": [{ "name": "clang", "source": "./plugins/clang", "version": "1.0.0" }]
      }
      """
    Given the marketplace "fixtures" has the file "plugins/clang/.lsp.json" at its root with this text:
      """
      { "clangd": { "command": "clangd", "extensionToLanguage": { ".c": "c" } } }
      """
    Given the marketplace "fixtures" is added to the project scope
    When the user runs "/claude:plugin install clang@fixtures --scope project --partial"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id             | name  | status      | reasons |
      | fixtures         | project           | clang@fixtures | clang | unavailable | lsp     |
    Then the project scope has no installed plugins

  Scenario: Installing a plugin whose only component is a theme fails as unavailable for an unsupported component (D-NSC-01)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" publishes this manifest:
      """
      {
        "name": "fixtures",
        "owner": { "name": "features" },
        "plugins": [{ "name": "paint", "source": "./plugins/paint", "version": "1.0.0" }]
      }
      """
    Given the marketplace "fixtures" has the file "plugins/paint/themes/dark.json" at its root with this text:
      """
      { "name": "dark" }
      """
    Given the marketplace "fixtures" is added to the project scope
    When the user runs "/claude:plugin install paint@fixtures --scope project --partial"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id             | name  | status      | reasons               |
      | fixtures         | project           | paint@fixtures | paint | unavailable | unsupported component |
    Then the project scope has no installed plugins
