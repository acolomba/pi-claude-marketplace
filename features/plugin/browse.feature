Feature: Plugin browse

  Browse opens an interactive picker only in the terminal UI, so any other mode refuses it and
  names the list command instead. The scenarios run the real extension in a headless Pi in rpc
  mode and read its JSON results. In a real terminal the picker opens, and a driver reads its rows
  from the screen and chooses or cancels as the user does.

  Scenario: Browsing outside the terminal UI is refused with a pointer to list
    When the user runs "/claude:plugin browse"
    Then the result has these fields:
      | kind         | usage-error                                                         |
      | severity     | error                                                               |
      | needs reload | false                                                               |
      | message      | Browse is unavailable in rpc mode. Use /claude:plugin list instead. |
      | usage        | Usage: /claude:plugin browse                                        |

  Scenario: The plugin command with no subcommand is refused as browse outside the terminal UI
    When the user runs "/claude:plugin"
    Then the result has these fields:
      | kind         | usage-error                                                         |
      | severity     | error                                                               |
      | needs reload | false                                                               |
      | message      | Browse is unavailable in rpc mode. Use /claude:plugin list instead. |
      | usage        | Usage: /claude:plugin browse                                        |

  Scenario: Browse with an argument is rejected
    When the user runs "/claude:plugin browse extra"
    Then the result has these fields:
      | kind         | usage-error                  |
      | severity     | error                        |
      | needs reload | false                        |
      | message      | browse takes no arguments.   |
      | usage        | Usage: /claude:plugin browse |

  Scenario: A bare plugin command opens the terminal picker on both scopes' marketplaces with the plugins each offers and has installed (D-BG-1201)
    Given the marketplace "extras" is published as a dir source
    Given the marketplace "extras" offers these plugins:
      | name  | version |
      | lint  | 2.0.0   |
      | fmt   | 1.0.0   |
      | ghost | 3.0.0   |
    Given the marketplace "extras" publishes this manifest:
      """
      {
        "name": "extras",
        "owner": { "name": "features" },
        "plugins": [
          { "name": "lint", "source": "./plugins/lint", "version": "2.0.0" },
          { "name": "fmt", "source": "./plugins/fmt", "version": "1.0.0" },
          { "name": "ghost", "source": "./plugins/ghost" }
        ]
      }
      """
    Given the marketplace "extras" is added to the project scope
    Given the marketplace "extras" no longer holds the files of the plugin "ghost"
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | app  | 1.0.0   |
    Given the marketplace "tools" is added to the user scope
    Given the marketplace "broken" is published as a dir source
    Given the marketplace "broken" is added to the user scope
    Given the user has run "/claude:plugin install fmt@extras --scope project"
    Given the manifest of the marketplace "broken" is no longer valid json
    When the user opens the plugin picker with "/claude:plugin" in pi's terminal
    Then the plugin picker shows the screen "Browse Claude Plugin Marketplaces" with these rows:
      | label            | description                                             |
      | extras [project] | 3 available • 1 installed -- {home}/marketplaces/extras |
      | tools [user]     | 1 available -- {home}/marketplaces/tools                |
      | broken [user]    | {home}/marketplaces/broken                              |
    When the user chooses "extras [project]" in the plugin picker
    Then the plugin picker shows the screen "Plugins in extras [project]" with these rows:
      | label               | description     |
      | [installed] fmt     | 1.0.0           |
      | [unavailable] ghost | not installable |
      | [available] lint    | 2.0.0           |
    When the user chooses "[installed] fmt" in the plugin picker
    Then the plugin picker shows the screen "Action: fmt @ extras" with these rows:
      | label     | description                          |
      | Uninstall | uninstall fmt@extras --scope project |
      | Disable   | disable fmt@extras --scope project   |
      | Info      | info fmt@extras --scope project      |

  Scenario: Choosing a plugin in the terminal picker installs it
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | app  | 1.0.0   |
    Given the marketplace "tools" is added to the user scope
    When the user opens the plugin picker with "/claude:plugin browse" in pi's terminal
    When the user chooses "tools [user]" in the plugin picker
    When the user chooses "[available] app" in the plugin picker
    When the user chooses "Install" in the plugin picker
    When the user chooses "User (global)" in the plugin picker
    Then the installation record of the user scope holds these plugins:
      | id        | version | enabled |
      | app@tools | 1.0.0   | true    |

  Scenario: Cancelling the terminal picker at the install scope installs nothing
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | app  | 1.0.0   |
    Given the marketplace "tools" is added to the user scope
    Given the marketplace "extras" is published as a dir source
    Given the marketplace "extras" offers these plugins:
      | name | version |
      | lint | 2.0.0   |
    Given the marketplace "extras" is added to the project scope
    When the user opens the plugin picker with "/claude:plugin browse" in pi's terminal
    When the user chooses "tools [user]" in the plugin picker
    When the user chooses "[available] app" in the plugin picker
    When the user chooses "Install" in the plugin picker
    When the user cancels the plugin picker
    Then the user scope has no installed plugins
    Then the project scope has no installed plugins
