Feature: Marketplace usage errors

  Each marketplace subcommand rejects arguments it cannot use and shows its own usage line.
  The scenarios run the real extension in a headless Pi and read its JSON results.

  Scenario Outline: A marketplace subcommand without its required argument reports a missing argument
    When the user runs "/claude:plugin marketplace <arguments>"
    Then the result has these fields:
      | kind         | usage-error                |
      | severity     | error                      |
      | needs reload | false                      |
      | message      | Missing required argument. |
      | usage        | <usage>                    |

    Examples:
      | arguments | usage                                                                                   |
      | add       | Usage: /claude:plugin marketplace add <source> [--scope user\|project] [--local]        |
      | remove    | Usage: /claude:plugin marketplace <remove\|rm> <name> [--scope user\|project] [--local] |
      | info      | Usage: /claude:plugin marketplace info <name> [--scope user\|project]                   |

  Scenario Outline: A marketplace subcommand rejects more arguments than it takes
    When the user runs "/claude:plugin marketplace <arguments>"
    Then the result has these fields:
      | kind         | usage-error         |
      | severity     | error               |
      | needs reload | false               |
      | message      | Too many arguments. |
      | usage        | <usage>             |

    Examples:
      | arguments                | usage                                                                                     |
      | add tools extra          | Usage: /claude:plugin marketplace add <source> [--scope user\|project] [--local]          |
      | remove tools extra       | Usage: /claude:plugin marketplace <remove\|rm> <name> [--scope user\|project] [--local]   |
      | list tools               | Usage: /claude:plugin marketplace <list\|ls> [--scope user\|project]                      |
      | info tools extra         | Usage: /claude:plugin marketplace info <name> [--scope user\|project]                     |
      | update tools extra       | Usage: /claude:plugin marketplace update [<name>] [--scope user\|project]                 |
      | autoupdate tools extra   | Usage: /claude:plugin marketplace autoupdate [<name>] [--scope user\|project] [--local]   |
      | noautoupdate tools extra | Usage: /claude:plugin marketplace noautoupdate [<name>] [--scope user\|project] [--local] |
