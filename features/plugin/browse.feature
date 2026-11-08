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

  Scenario: The terminal picker lists the marketplaces of both scopes
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | app  | 1.0.0   |
    Given the marketplace "tools" is added to the user scope
    Given the marketplace "extras" is published as a dir source
    Given the marketplace "extras" offers these plugins:
      | name | version |
      | lint | 2.0.0   |
      | fmt  | 1.0.0   |
    Given the marketplace "extras" is added to the project scope
    When the user opens the plugin picker with "/claude:plugin browse" in pi's terminal
    Then the plugin picker shows the screen "Browse Claude Plugin Marketplaces" with these rows:
      | label            | description                               |
      | extras [project] | 0 plugin(s) -- {home}/marketplaces/extras |
      | tools [user]     | 0 plugin(s) -- {home}/marketplaces/tools  |

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

  Scenario: Cancelling the terminal picker installs nothing
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
    When the user cancels the plugin picker
    Then the user scope has no installed plugins
    Then the project scope has no installed plugins
