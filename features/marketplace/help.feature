Feature: Marketplace help

  Help shows the marketplace subcommands and how to call each one.
  The scenarios run the real extension in a headless Pi and read its JSON results.

  Scenario: Marketplace help shows the marketplace usage
    When the user runs "/claude:plugin marketplace help"
    Then the result has these fields:
      | kind         | usage-info                                                                                                                                                                                                                                                                                                                                                                                                                                        |
      | severity     | info                                                                                                                                                                                                                                                                                                                                                                                                                                              |
      | needs reload | false                                                                                                                                                                                                                                                                                                                                                                                                                                             |
      | usage        | Usage: /claude:plugin marketplace <add\|remove\|rm\|list\|ls\|info\|update\|autoupdate\|noautoupdate> ...\n  add <source> [--scope user\|project]\n  remove <name> [--scope user\|project]   (alias: rm)\n  list [--scope user\|project]            (alias: ls)\n  info <name> [--scope user\|project]\n  update [<name>] [--scope user\|project]\n  autoupdate [<name>] [--scope user\|project]\n  noautoupdate [<name>] [--scope user\|project] |

  Scenario: Marketplace help with an argument is rejected
    When the user runs "/claude:plugin marketplace help extra"
    Then the result has these fields:
      | kind         | usage-error                            |
      | severity     | error                                  |
      | needs reload | false                                  |
      | message      | marketplace help takes no arguments.   |
      | usage        | Usage: /claude:plugin marketplace help |
