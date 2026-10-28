Feature: Marketplace market alias

  The market alias runs every marketplace command, as Claude Code's /plugin market does.
  The scenarios run the real extension in a headless Pi, read its JSON results, and
  use local marketplaces in place of published ones.

  Scenario: The market alias adds a marketplace to the chosen scope
    Given the marketplace "tools" is published as a dir source
    When the user runs "/claude:plugin market add {home}/marketplaces/tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope   | status |
      | tools | project | added  |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name  | source                    |
      | tools | {home}/marketplaces/tools |

  Scenario: The market alias lists the added marketplaces
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" is added to the project scope
    When the user runs "/claude:plugin market list --scope project"
    Then the result has these fields:
      | kind                | cascade          |
      | severity            | info             |
      | needs reload        | false            |
      | tally label         | Marketplace list |
      | tally failures      | 0                |
      | tally warnings      | 0                |
      | tally success count | 1                |
    Then the result lists these marketplaces:
      | name  | scope   | details autoupdate | details last updated at |
      | tools | project | false              | {scenario time}         |

  Scenario: Market help shows the marketplace usage
    When the user runs "/claude:plugin market help"
    Then the result has these fields:
      | kind         | usage-info                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
      | severity     | info                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
      | needs reload | false                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
      | usage        | Usage: /claude:plugin marketplace <add\|remove\|rm\|list\|ls\|info\|update\|autoupdate\|noautoupdate> ...\n  add <source> [--scope user\|project] [--local]\n  remove <name> [--scope user\|project] [--local]   (alias: rm)\n  list [--scope user\|project]                      (alias: ls)\n  info <name> [--scope user\|project]\n  update [<name>] [--scope user\|project]\n  autoupdate [<name>] [--scope user\|project] [--local]\n  noautoupdate [<name>] [--scope user\|project] [--local] |

  Scenario: Help for the market topic shows the marketplace usage
    When the user runs "/claude:plugin help market"
    Then the result has these fields:
      | kind         | usage-info                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
      | severity     | info                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
      | needs reload | false                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
      | usage        | Usage: /claude:plugin marketplace <add\|remove\|rm\|list\|ls\|info\|update\|autoupdate\|noautoupdate> ...\n  add <source> [--scope user\|project] [--local]\n  remove <name> [--scope user\|project] [--local]   (alias: rm)\n  list [--scope user\|project]                      (alias: ls)\n  info <name> [--scope user\|project]\n  update [<name>] [--scope user\|project]\n  autoupdate [<name>] [--scope user\|project] [--local]\n  noautoupdate [<name>] [--scope user\|project] [--local] |

  Scenario: A market command without a subcommand shows the marketplace usage with a reason
    When the user runs "/claude:plugin market"
    Then the result has these fields:
      | kind         | usage-error                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
      | severity     | error                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
      | needs reload | false                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
      | message      | marketplace requires a subcommand.                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
      | usage        | Usage: /claude:plugin marketplace <add\|remove\|rm\|list\|ls\|info\|update\|autoupdate\|noautoupdate> ...\n  add <source> [--scope user\|project] [--local]\n  remove <name> [--scope user\|project] [--local]   (alias: rm)\n  list [--scope user\|project]                      (alias: ls)\n  info <name> [--scope user\|project]\n  update [<name>] [--scope user\|project]\n  autoupdate [<name>] [--scope user\|project] [--local]\n  noautoupdate [<name>] [--scope user\|project] [--local] |

  Scenario: Market exposes marketplace completions
    When the user requests plugin completions for "market "
    Then the plugin completion set for "market " contains these suggestions:
      | label        | value                   | description |
      | add          | "market add "           |             |
      | remove       | "market remove "        |             |
      | rm           | "market rm "            |             |
      | list         | "market list "          |             |
      | ls           | "market ls "            |             |
      | info         | "market info "          |             |
      | update       | "market update "        |             |
      | autoupdate   | "market autoupdate "    |             |
      | noautoupdate | "market noautoupdate "  |             |
      | help         | "market help "          |             |
    When the user requests plugin completions for "marketplace "
    Then the plugin completion set for "marketplace " contains these suggestions:
      | label        | value                        | description |
      | add          | "marketplace add "           |             |
      | remove       | "marketplace remove "        |             |
      | rm           | "marketplace rm "            |             |
      | list         | "marketplace list "          |             |
      | ls           | "marketplace ls "            |             |
      | info         | "marketplace info "          |             |
      | update       | "marketplace update "        |             |
      | autoupdate   | "marketplace autoupdate "    |             |
      | noautoupdate | "marketplace noautoupdate "  |             |
      | help         | "marketplace help "          |             |
