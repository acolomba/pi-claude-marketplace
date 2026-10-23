Feature: Plugin browse

  Browse opens an interactive picker only in the terminal UI, so any other mode refuses it and
  names the list command instead. The scenarios run the real extension in a headless Pi in rpc
  mode and read its JSON results.

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
