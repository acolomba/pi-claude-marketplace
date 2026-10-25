Feature: Plugin usage errors

  Each plugin command rejects an unknown flag, surplus arguments, a bad --scope, or a malformed
  plugin reference or marketplace name, and shows its own usage line. The scenarios run the
  real extension in a headless Pi and read its JSON results.

  Scenario Outline: An empty plugin reference is rejected as an empty plugin name
    When the user runs "/claude:plugin <arguments>"
    Then the result has these fields:
      | kind         | usage-error                    |
      | severity     | error                          |
      | needs reload | false                          |
      | message      | Plugin name must not be empty. |
      | usage        | <usage>                        |

    Examples:
      | arguments       | usage                                                                                                                               |
      | uninstall ''    | Usage: /claude:plugin uninstall <plugin>@<marketplace> [--scope user\|project] [--keep-data] [--local] [--prune]                    |
      | uninstall '   ' | Usage: /claude:plugin uninstall <plugin>@<marketplace> [--scope user\|project] [--keep-data] [--local] [--prune]                    |
      | enable ''       | Usage: /claude:plugin enable <plugin>@<marketplace> [--scope user\|project] [--local]                                               |
      | disable ''      | Usage: /claude:plugin disable <plugin>@<marketplace> [--scope user\|project] [--local]                                              |
      | install ''      | Usage: /claude:plugin install <plugin>@<marketplace> [--scope user\|project] [--map-model] [--partial] [--local]                    |
      | install '   '   | Usage: /claude:plugin install <plugin>@<marketplace> [--scope user\|project] [--map-model] [--partial] [--local]                    |
      | info ''         | Usage: /claude:plugin info <plugin>@<marketplace> [--fetch] [--scope user\|project]                                                 |
      | update ''       | Usage: /claude:plugin update [<plugin>@<marketplace> \| @<marketplace>] [--scope user\|project] [--map-model] [--partial] [--local] |
      | fetch ''        | Usage: /claude:plugin fetch [<plugin>@<marketplace> \| @<marketplace>] [--scope user\|project]                                      |
      | reinstall ''    | Usage: /claude:plugin reinstall [<plugin>@<marketplace> \| @<marketplace>] [--scope user\|project] [--local]                        |

  Scenario: Listing the plugins of an empty marketplace name is rejected
    When the user runs "/claude:plugin list ''"
    Then the result has these fields:
      | kind         | usage-error                                                                                                                           |
      | severity     | error                                                                                                                                 |
      | needs reload | false                                                                                                                                 |
      | message      | Marketplace name must not be empty.                                                                                                   |
      | usage        | Usage: /claude:plugin list [<marketplace>] [--installed] [--available] [--unavailable] [--partial] [--remote] [--scope user\|project] |

  Scenario Outline: An @ with no marketplace name is rejected as an empty marketplace name
    When the user runs "/claude:plugin <arguments>"
    Then the result has these fields:
      | kind         | usage-error                         |
      | severity     | error                               |
      | needs reload | false                               |
      | message      | Marketplace name must not be empty. |
      | usage        | <usage>                             |

    Examples:
      | arguments        | usage                                                                                                                               |
      | update @         | Usage: /claude:plugin update [<plugin>@<marketplace> \| @<marketplace>] [--scope user\|project] [--map-model] [--partial] [--local] |
      | fetch @          | Usage: /claude:plugin fetch [<plugin>@<marketplace> \| @<marketplace>] [--scope user\|project]                                      |
      | reinstall @      | Usage: /claude:plugin reinstall [<plugin>@<marketplace> \| @<marketplace>] [--scope user\|project] [--local]                        |
      | reinstall '@   ' | Usage: /claude:plugin reinstall [<plugin>@<marketplace> \| @<marketplace>] [--scope user\|project] [--local]                        |

  Scenario Outline: A partly malformed plugin reference keeps the invalid reference message
    When the user runs "/claude:plugin <arguments>"
    Then the result has these fields:
      | kind         | usage-error |
      | severity     | error       |
      | needs reload | false       |
      | message      | <message>   |
      | usage        | <usage>     |

    Examples:
      | arguments            | message                                           | usage                                                                                                                               |
      | install @            | Invalid <plugin>@<marketplace> ref: "@".          | Usage: /claude:plugin install <plugin>@<marketplace> [--scope user\|project] [--map-model] [--partial] [--local]                    |
      | info @               | Invalid <plugin>@<marketplace> ref: "@".          | Usage: /claude:plugin info <plugin>@<marketplace> [--fetch] [--scope user\|project]                                                 |
      | uninstall @          | Invalid <plugin>@<marketplace> ref: "@".          | Usage: /claude:plugin uninstall <plugin>@<marketplace> [--scope user\|project] [--keep-data] [--local] [--prune]                    |
      | install ' @official' | Invalid <plugin>@<marketplace> ref: " @official". | Usage: /claude:plugin install <plugin>@<marketplace> [--scope user\|project] [--map-model] [--partial] [--local]                    |
      | update foo@          | Invalid <plugin>@<marketplace> ref: "foo@".       | Usage: /claude:plugin update [<plugin>@<marketplace> \| @<marketplace>] [--scope user\|project] [--map-model] [--partial] [--local] |
      | fetch foo@           | Invalid <plugin>@<marketplace> ref: "foo@".       | Usage: /claude:plugin fetch [<plugin>@<marketplace> \| @<marketplace>] [--scope user\|project]                                      |
      | reinstall foo@       | Invalid <plugin>@<marketplace> ref: "foo@".       | Usage: /claude:plugin reinstall [<plugin>@<marketplace> \| @<marketplace>] [--scope user\|project] [--local]                        |
      | update 'foo@  '      | Invalid <plugin>@<marketplace> ref: "foo@  ".     | Usage: /claude:plugin update [<plugin>@<marketplace> \| @<marketplace>] [--scope user\|project] [--map-model] [--partial] [--local] |

  Scenario Outline: A plugin subcommand rejects a flag it does not accept
    When the user runs "/claude:plugin <arguments>"
    Then the result has these fields:
      | kind         | usage-error             |
      | severity     | error                   |
      | needs reload | false                   |
      | message      | Unknown flag: "<flag>". |
      | usage        | <usage>                 |

    Examples:
      | arguments                      | flag        | usage                                                                                                                                 |
      | bootstrap --bogus              | --bogus     | Usage: /claude:plugin bootstrap                                                                                                       |
      | install notes@tools --bogus    | --bogus     | Usage: /claude:plugin install <plugin>@<marketplace> [--scope user\|project] [--map-model] [--partial] [--local]                      |
      | uninstall notes@tools --bogus  | --bogus     | Usage: /claude:plugin uninstall <plugin>@<marketplace> [--scope user\|project] [--keep-data] [--local] [--prune]                      |
      | prune --bogus                  | --bogus     | Usage: /claude:plugin prune [--scope user\|project] [--dry-run]                                                                       |
      | update notes@tools --bogus     | --bogus     | Usage: /claude:plugin update [<plugin>@<marketplace> \| @<marketplace>] [--scope user\|project] [--map-model] [--partial] [--local]   |
      | fetch notes@tools --bogus      | --bogus     | Usage: /claude:plugin fetch [<plugin>@<marketplace> \| @<marketplace>] [--scope user\|project]                                        |
      | reinstall notes@tools --bogus  | --bogus     | Usage: /claude:plugin reinstall [<plugin>@<marketplace> \| @<marketplace>] [--scope user\|project] [--local]                          |
      | list tools --bogus             | --bogus     | Usage: /claude:plugin list [<marketplace>] [--installed] [--available] [--unavailable] [--partial] [--remote] [--scope user\|project] |
      | ls tools --bogus               | --bogus     | Usage: /claude:plugin list [<marketplace>] [--installed] [--available] [--unavailable] [--partial] [--remote] [--scope user\|project] |
      | info notes@tools --bogus       | --bogus     | Usage: /claude:plugin info <plugin>@<marketplace> [--fetch] [--scope user\|project]                                                   |
      | pending --bogus                | --bogus     | Usage: /claude:plugin pending [--scope user\|project]                                                                                 |
      | apply --bogus                  | --bogus     | Usage: /claude:plugin apply [--scope user\|project]                                                                                   |
      | enable notes@tools --bogus     | --bogus     | Usage: /claude:plugin enable <plugin>@<marketplace> [--scope user\|project] [--local]                                                 |
      | disable notes@tools --bogus    | --bogus     | Usage: /claude:plugin disable <plugin>@<marketplace> [--scope user\|project] [--local]                                                |
      | import --bogus                 | --bogus     | Usage: /claude:plugin import [--scope user\|project]                                                                                  |
      | browse --bogus                 | --bogus     | Usage: /claude:plugin browse                                                                                                          |
      | help marketplace --bogus       | --bogus     | Usage: /claude:plugin help [marketplace]                                                                                              |
      | prune --local                  | --local     | Usage: /claude:plugin prune [--scope user\|project] [--dry-run]                                                                       |
      | fetch notes@tools --local      | --local     | Usage: /claude:plugin fetch [<plugin>@<marketplace> \| @<marketplace>] [--scope user\|project]                                        |
      | info notes@tools --local       | --local     | Usage: /claude:plugin info <plugin>@<marketplace> [--fetch] [--scope user\|project]                                                   |
      | list tools --local             | --local     | Usage: /claude:plugin list [<marketplace>] [--installed] [--available] [--unavailable] [--partial] [--remote] [--scope user\|project] |
      | pending --local                | --local     | Usage: /claude:plugin pending [--scope user\|project]                                                                                 |
      | apply --local                  | --local     | Usage: /claude:plugin apply [--scope user\|project]                                                                                   |
      | import --local                 | --local     | Usage: /claude:plugin import [--scope user\|project]                                                                                  |
      | enable notes@tools --keep-data | --keep-data | Usage: /claude:plugin enable <plugin>@<marketplace> [--scope user\|project] [--local]                                                 |
      | install notes@tools --dry-run  | --dry-run   | Usage: /claude:plugin install <plugin>@<marketplace> [--scope user\|project] [--map-model] [--partial] [--local]                      |
      | browse --scope user            | --scope     | Usage: /claude:plugin browse                                                                                                          |
      | help marketplace --scope user  | --scope     | Usage: /claude:plugin help [marketplace]                                                                                              |
      | list tools --bogus --other     | --bogus     | Usage: /claude:plugin list [<marketplace>] [--installed] [--available] [--unavailable] [--partial] [--remote] [--scope user\|project] |
      | bootstrap extra --bogus        | --bogus     | Usage: /claude:plugin bootstrap                                                                                                       |
      | import extra --bogus           | --bogus     | Usage: /claude:plugin import [--scope user\|project]                                                                                  |
      | browse extra --bogus           | --bogus     | Usage: /claude:plugin browse                                                                                                          |
      | pending extra --bogus          | --bogus     | Usage: /claude:plugin pending [--scope user\|project]                                                                                 |
      | apply extra --bogus            | --bogus     | Usage: /claude:plugin apply [--scope user\|project]                                                                                   |
      | help marketplace extra --bogus | --bogus     | Usage: /claude:plugin help [marketplace]                                                                                              |

  Scenario Outline: A plugin subcommand rejects more arguments than it takes
    When the user runs "/claude:plugin <arguments>"
    Then the result has these fields:
      | kind         | usage-error |
      | severity     | error       |
      | needs reload | false       |
      | message      | <message>   |
      | usage        | <usage>     |

    Examples:
      | arguments                      | message                                      | usage                                                                                                                                 |
      | bootstrap extra                | bootstrap takes no arguments.                | Usage: /claude:plugin bootstrap                                                                                                       |
      | install notes@tools extra      | Too many arguments.                          | Usage: /claude:plugin install <plugin>@<marketplace> [--scope user\|project] [--map-model] [--partial] [--local]                      |
      | uninstall notes@tools extra    | Too many arguments.                          | Usage: /claude:plugin uninstall <plugin>@<marketplace> [--scope user\|project] [--keep-data] [--local] [--prune]                      |
      | prune extra                    | Too many arguments.                          | Usage: /claude:plugin prune [--scope user\|project] [--dry-run]                                                                       |
      | update notes@tools extra       | Too many arguments.                          | Usage: /claude:plugin update [<plugin>@<marketplace> \| @<marketplace>] [--scope user\|project] [--map-model] [--partial] [--local]   |
      | fetch notes@tools extra        | Too many arguments.                          | Usage: /claude:plugin fetch [<plugin>@<marketplace> \| @<marketplace>] [--scope user\|project]                                        |
      | reinstall notes@tools extra    | Too many arguments.                          | Usage: /claude:plugin reinstall [<plugin>@<marketplace> \| @<marketplace>] [--scope user\|project] [--local]                          |
      | list tools extra               | Too many arguments.                          | Usage: /claude:plugin list [<marketplace>] [--installed] [--available] [--unavailable] [--partial] [--remote] [--scope user\|project] |
      | ls tools extra                 | Too many arguments.                          | Usage: /claude:plugin list [<marketplace>] [--installed] [--available] [--unavailable] [--partial] [--remote] [--scope user\|project] |
      | info notes@tools extra         | Too many arguments.                          | Usage: /claude:plugin info <plugin>@<marketplace> [--fetch] [--scope user\|project]                                                   |
      | pending extra                  | Too many arguments.                          | Usage: /claude:plugin pending [--scope user\|project]                                                                                 |
      | apply extra                    | Too many arguments.                          | Usage: /claude:plugin apply [--scope user\|project]                                                                                   |
      | enable notes@tools extra       | Too many arguments.                          | Usage: /claude:plugin enable <plugin>@<marketplace> [--scope user\|project] [--local]                                                 |
      | disable notes@tools extra      | Too many arguments.                          | Usage: /claude:plugin disable <plugin>@<marketplace> [--scope user\|project] [--local]                                                |
      | import extra                   | import does not accept positional arguments. | Usage: /claude:plugin import [--scope user\|project]                                                                                  |
      | browse extra                   | browse takes no arguments.                   | Usage: /claude:plugin browse                                                                                                          |
      | help marketplace extra         | Too many arguments.                          | Usage: /claude:plugin help [marketplace]                                                                                              |
      | install notes@tools extra more | Too many arguments.                          | Usage: /claude:plugin install <plugin>@<marketplace> [--scope user\|project] [--map-model] [--partial] [--local]                      |

  Scenario Outline: A plugin subcommand rejects a --scope value other than user or project in any position
    When the user runs "/claude:plugin <arguments>"
    Then the result has these fields:
      | kind         | usage-error                                                    |
      | severity     | error                                                          |
      | needs reload | false                                                          |
      | message      | Invalid --scope value: "<value>". Must be "user" or "project". |
      | usage        | <usage>                                                        |

    Examples:
      | arguments                          | value   | usage                                                                                                                                 |
      | bootstrap --scope bad              | bad     | Usage: /claude:plugin bootstrap                                                                                                       |
      | install --scope bad notes@tools    | bad     | Usage: /claude:plugin install <plugin>@<marketplace> [--scope user\|project] [--map-model] [--partial] [--local]                      |
      | install notes@tools --scope bad    | bad     | Usage: /claude:plugin install <plugin>@<marketplace> [--scope user\|project] [--map-model] [--partial] [--local]                      |
      | uninstall --scope bad notes@tools  | bad     | Usage: /claude:plugin uninstall <plugin>@<marketplace> [--scope user\|project] [--keep-data] [--local] [--prune]                      |
      | uninstall notes@tools --scope bad  | bad     | Usage: /claude:plugin uninstall <plugin>@<marketplace> [--scope user\|project] [--keep-data] [--local] [--prune]                      |
      | prune --scope bad                  | bad     | Usage: /claude:plugin prune [--scope user\|project] [--dry-run]                                                                       |
      | update --scope bad notes@tools     | bad     | Usage: /claude:plugin update [<plugin>@<marketplace> \| @<marketplace>] [--scope user\|project] [--map-model] [--partial] [--local]   |
      | update notes@tools --scope bad     | bad     | Usage: /claude:plugin update [<plugin>@<marketplace> \| @<marketplace>] [--scope user\|project] [--map-model] [--partial] [--local]   |
      | fetch --scope bad notes@tools      | bad     | Usage: /claude:plugin fetch [<plugin>@<marketplace> \| @<marketplace>] [--scope user\|project]                                        |
      | fetch notes@tools --scope bad      | bad     | Usage: /claude:plugin fetch [<plugin>@<marketplace> \| @<marketplace>] [--scope user\|project]                                        |
      | reinstall --scope bad notes@tools  | bad     | Usage: /claude:plugin reinstall [<plugin>@<marketplace> \| @<marketplace>] [--scope user\|project] [--local]                          |
      | reinstall notes@tools --scope bad  | bad     | Usage: /claude:plugin reinstall [<plugin>@<marketplace> \| @<marketplace>] [--scope user\|project] [--local]                          |
      | list --scope bad tools             | bad     | Usage: /claude:plugin list [<marketplace>] [--installed] [--available] [--unavailable] [--partial] [--remote] [--scope user\|project] |
      | list tools --scope bad             | bad     | Usage: /claude:plugin list [<marketplace>] [--installed] [--available] [--unavailable] [--partial] [--remote] [--scope user\|project] |
      | ls --scope bad tools               | bad     | Usage: /claude:plugin list [<marketplace>] [--installed] [--available] [--unavailable] [--partial] [--remote] [--scope user\|project] |
      | ls tools --scope bad               | bad     | Usage: /claude:plugin list [<marketplace>] [--installed] [--available] [--unavailable] [--partial] [--remote] [--scope user\|project] |
      | info --scope bad notes@tools       | bad     | Usage: /claude:plugin info <plugin>@<marketplace> [--fetch] [--scope user\|project]                                                   |
      | info notes@tools --scope bad       | bad     | Usage: /claude:plugin info <plugin>@<marketplace> [--fetch] [--scope user\|project]                                                   |
      | pending --scope bad                | bad     | Usage: /claude:plugin pending [--scope user\|project]                                                                                 |
      | apply --scope bad                  | bad     | Usage: /claude:plugin apply [--scope user\|project]                                                                                   |
      | enable --scope bad notes@tools     | bad     | Usage: /claude:plugin enable <plugin>@<marketplace> [--scope user\|project] [--local]                                                 |
      | enable notes@tools --scope bad     | bad     | Usage: /claude:plugin enable <plugin>@<marketplace> [--scope user\|project] [--local]                                                 |
      | disable --scope bad notes@tools    | bad     | Usage: /claude:plugin disable <plugin>@<marketplace> [--scope user\|project] [--local]                                                |
      | disable notes@tools --scope bad    | bad     | Usage: /claude:plugin disable <plugin>@<marketplace> [--scope user\|project] [--local]                                                |
      | import --scope bad                 | bad     | Usage: /claude:plugin import [--scope user\|project]                                                                                  |
      | enable --scope --local notes@tools | --local | Usage: /claude:plugin enable <plugin>@<marketplace> [--scope user\|project] [--local]                                                 |

  Scenario Outline: A plugin subcommand rejects a --scope flag with no value
    When the user runs "/claude:plugin <arguments>"
    Then the result has these fields:
      | kind         | usage-error                                    |
      | severity     | error                                          |
      | needs reload | false                                          |
      | message      | --scope requires a value: "user" or "project". |
      | usage        | <usage>                                        |

    Examples:
      | arguments                     | usage                                                                                                                                 |
      | bootstrap --scope             | Usage: /claude:plugin bootstrap                                                                                                       |
      | install notes@tools --scope   | Usage: /claude:plugin install <plugin>@<marketplace> [--scope user\|project] [--map-model] [--partial] [--local]                      |
      | uninstall notes@tools --scope | Usage: /claude:plugin uninstall <plugin>@<marketplace> [--scope user\|project] [--keep-data] [--local] [--prune]                      |
      | prune --scope                 | Usage: /claude:plugin prune [--scope user\|project] [--dry-run]                                                                       |
      | update notes@tools --scope    | Usage: /claude:plugin update [<plugin>@<marketplace> \| @<marketplace>] [--scope user\|project] [--map-model] [--partial] [--local]   |
      | fetch notes@tools --scope     | Usage: /claude:plugin fetch [<plugin>@<marketplace> \| @<marketplace>] [--scope user\|project]                                        |
      | reinstall notes@tools --scope | Usage: /claude:plugin reinstall [<plugin>@<marketplace> \| @<marketplace>] [--scope user\|project] [--local]                          |
      | list tools --scope            | Usage: /claude:plugin list [<marketplace>] [--installed] [--available] [--unavailable] [--partial] [--remote] [--scope user\|project] |
      | ls tools --scope              | Usage: /claude:plugin list [<marketplace>] [--installed] [--available] [--unavailable] [--partial] [--remote] [--scope user\|project] |
      | info notes@tools --scope      | Usage: /claude:plugin info <plugin>@<marketplace> [--fetch] [--scope user\|project]                                                   |
      | pending --scope               | Usage: /claude:plugin pending [--scope user\|project]                                                                                 |
      | apply --scope                 | Usage: /claude:plugin apply [--scope user\|project]                                                                                   |
      | enable notes@tools --scope    | Usage: /claude:plugin enable <plugin>@<marketplace> [--scope user\|project] [--local]                                                 |
      | disable notes@tools --scope   | Usage: /claude:plugin disable <plugin>@<marketplace> [--scope user\|project] [--local]                                                |
      | import --scope                | Usage: /claude:plugin import [--scope user\|project]                                                                                  |
