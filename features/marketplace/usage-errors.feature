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

  Scenario Outline: A marketplace subcommand rejects a flag it does not accept
    When the user runs "/claude:plugin marketplace <arguments>"
    Then the result has these fields:
      | kind         | usage-error |
      | severity     | error       |
      | needs reload | false       |
      | message      | <message>   |
      | usage        | <usage>     |

    Examples:
      | arguments                  | message                  | usage                                                                                     |
      | add tools --bogus          | Unknown flag: "--bogus". | Usage: /claude:plugin marketplace add <source> [--scope user\|project] [--local]          |
      | remove tools --bogus       | Unknown flag: "--bogus". | Usage: /claude:plugin marketplace <remove\|rm> <name> [--scope user\|project] [--local]   |
      | list --bogus               | Unknown flag: "--bogus". | Usage: /claude:plugin marketplace <list\|ls> [--scope user\|project]                      |
      | info tools --bogus         | Unknown flag: "--bogus". | Usage: /claude:plugin marketplace info <name> [--scope user\|project]                     |
      | update --bogus             | Unknown flag: "--bogus". | Usage: /claude:plugin marketplace update [<name>] [--scope user\|project]                 |
      | autoupdate --bogus         | Unknown flag: "--bogus". | Usage: /claude:plugin marketplace autoupdate [<name>] [--scope user\|project] [--local]   |
      | noautoupdate --bogus       | Unknown flag: "--bogus". | Usage: /claude:plugin marketplace noautoupdate [<name>] [--scope user\|project] [--local] |
      | list --local               | Unknown flag: "--local". | Usage: /claude:plugin marketplace <list\|ls> [--scope user\|project]                      |
      | info tools --local         | Unknown flag: "--local". | Usage: /claude:plugin marketplace info <name> [--scope user\|project]                     |
      | update --local             | Unknown flag: "--local". | Usage: /claude:plugin marketplace update [<name>] [--scope user\|project]                 |
      | list --bogus --other       | Unknown flag: "--bogus". | Usage: /claude:plugin marketplace <list\|ls> [--scope user\|project]                      |
      | autoupdate --bogus --other | Unknown flag: "--bogus". | Usage: /claude:plugin marketplace autoupdate [<name>] [--scope user\|project] [--local]   |

  Scenario Outline: A marketplace subcommand rejects a --scope value other than user or project in any position
    When the user runs "/claude:plugin marketplace <arguments>"
    Then the result has these fields:
      | kind         | usage-error                                                    |
      | severity     | error                                                          |
      | needs reload | false                                                          |
      | message      | Invalid --scope value: "<value>". Must be "user" or "project". |
      | usage        | <usage>                                                        |

    Examples:
      | arguments                    | value   | usage                                                                                     |
      | add --scope bad tools        | bad     | Usage: /claude:plugin marketplace add <source> [--scope user\|project] [--local]          |
      | add tools --scope bad        | bad     | Usage: /claude:plugin marketplace add <source> [--scope user\|project] [--local]          |
      | add --scope --local tools    | --local | Usage: /claude:plugin marketplace add <source> [--scope user\|project] [--local]          |
      | add --scope tools            | tools   | Usage: /claude:plugin marketplace add <source> [--scope user\|project] [--local]          |
      | remove tools --scope bad     | bad     | Usage: /claude:plugin marketplace <remove\|rm> <name> [--scope user\|project] [--local]   |
      | info --scope bad tools       | bad     | Usage: /claude:plugin marketplace info <name> [--scope user\|project]                     |
      | info tools --scope bad       | bad     | Usage: /claude:plugin marketplace info <name> [--scope user\|project]                     |
      | list --scope bad             | bad     | Usage: /claude:plugin marketplace <list\|ls> [--scope user\|project]                      |
      | update --scope bad tools     | bad     | Usage: /claude:plugin marketplace update [<name>] [--scope user\|project]                 |
      | update tools --scope bad     | bad     | Usage: /claude:plugin marketplace update [<name>] [--scope user\|project]                 |
      | autoupdate --scope bad tools | bad     | Usage: /claude:plugin marketplace autoupdate [<name>] [--scope user\|project] [--local]   |
      | autoupdate tools --scope bad | bad     | Usage: /claude:plugin marketplace autoupdate [<name>] [--scope user\|project] [--local]   |
      | autoupdate --scope --local   | --local | Usage: /claude:plugin marketplace autoupdate [<name>] [--scope user\|project] [--local]   |
      | noautoupdate --scope bad     | bad     | Usage: /claude:plugin marketplace noautoupdate [<name>] [--scope user\|project] [--local] |

  Scenario Outline: A marketplace subcommand rejects a --scope flag with no value
    When the user runs "/claude:plugin marketplace <arguments>"
    Then the result has these fields:
      | kind         | usage-error                                    |
      | severity     | error                                          |
      | needs reload | false                                          |
      | message      | --scope requires a value: "user" or "project". |
      | usage        | <usage>                                        |

    Examples:
      | arguments                | usage                                                                                     |
      | add tools --scope        | Usage: /claude:plugin marketplace add <source> [--scope user\|project] [--local]          |
      | remove tools --scope     | Usage: /claude:plugin marketplace <remove\|rm> <name> [--scope user\|project] [--local]   |
      | info tools --scope       | Usage: /claude:plugin marketplace info <name> [--scope user\|project]                     |
      | list --scope             | Usage: /claude:plugin marketplace <list\|ls> [--scope user\|project]                      |
      | update tools --scope     | Usage: /claude:plugin marketplace update [<name>] [--scope user\|project]                 |
      | autoupdate tools --scope | Usage: /claude:plugin marketplace autoupdate [<name>] [--scope user\|project] [--local]   |
      | noautoupdate --scope     | Usage: /claude:plugin marketplace noautoupdate [<name>] [--scope user\|project] [--local] |

  Scenario Outline: An empty marketplace argument is rejected with a message that names its field
    When the user runs "/claude:plugin marketplace <arguments>"
    Then the result has these fields:
      | kind         | usage-error |
      | severity     | error       |
      | needs reload | false       |
      | message      | <message>   |
      | usage        | <usage>     |

    Examples:
      | arguments       | message                             | usage                                                                                     |
      | add ''          | Source must not be empty.           | Usage: /claude:plugin marketplace add <source> [--scope user\|project] [--local]          |
      | add '   '       | Source must not be empty.           | Usage: /claude:plugin marketplace add <source> [--scope user\|project] [--local]          |
      | remove ''       | Marketplace name must not be empty. | Usage: /claude:plugin marketplace <remove\|rm> <name> [--scope user\|project] [--local]   |
      | info ''         | Marketplace name must not be empty. | Usage: /claude:plugin marketplace info <name> [--scope user\|project]                     |
      | update ''       | Marketplace name must not be empty. | Usage: /claude:plugin marketplace update [<name>] [--scope user\|project]                 |
      | update '   '    | Marketplace name must not be empty. | Usage: /claude:plugin marketplace update [<name>] [--scope user\|project]                 |
      | autoupdate ''   | Marketplace name must not be empty. | Usage: /claude:plugin marketplace autoupdate [<name>] [--scope user\|project] [--local]   |
      | noautoupdate '' | Marketplace name must not be empty. | Usage: /claude:plugin marketplace noautoupdate [<name>] [--scope user\|project] [--local] |
