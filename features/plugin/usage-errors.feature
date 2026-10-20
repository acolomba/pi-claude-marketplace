Feature: Plugin usage errors

  Each plugin command rejects an empty or malformed reference and shows its own usage line.
  The scenarios run the real extension in a headless Pi and read its JSON results.

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
      | arguments      | message                                     | usage                                                                                                                               |
      | install @      | Invalid <plugin>@<marketplace> ref: "@".    | Usage: /claude:plugin install <plugin>@<marketplace> [--scope user\|project] [--map-model] [--partial] [--local]                    |
      | info @         | Invalid <plugin>@<marketplace> ref: "@".    | Usage: /claude:plugin info <plugin>@<marketplace> [--fetch] [--scope user\|project]                                                 |
      | uninstall @    | Invalid <plugin>@<marketplace> ref: "@".    | Usage: /claude:plugin uninstall <plugin>@<marketplace> [--scope user\|project] [--keep-data] [--local] [--prune]                    |
      | update foo@    | Invalid <plugin>@<marketplace> ref: "foo@". | Usage: /claude:plugin update [<plugin>@<marketplace> \| @<marketplace>] [--scope user\|project] [--map-model] [--partial] [--local] |
      | fetch foo@     | Invalid <plugin>@<marketplace> ref: "foo@". | Usage: /claude:plugin fetch [<plugin>@<marketplace> \| @<marketplace>] [--scope user\|project]                                      |
      | reinstall foo@ | Invalid <plugin>@<marketplace> ref: "foo@". | Usage: /claude:plugin reinstall [<plugin>@<marketplace> \| @<marketplace>] [--scope user\|project] [--local]                        |
