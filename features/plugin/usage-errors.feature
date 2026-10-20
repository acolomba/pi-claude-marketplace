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
      | arguments       | usage                                                                                                            |
      | uninstall ''    | Usage: /claude:plugin uninstall <plugin>@<marketplace> [--scope user\|project] [--keep-data] [--local] [--prune] |
      | uninstall '   ' | Usage: /claude:plugin uninstall <plugin>@<marketplace> [--scope user\|project] [--keep-data] [--local] [--prune] |
      | enable ''       | Usage: /claude:plugin enable <plugin>@<marketplace> [--scope user\|project] [--local]                            |
      | disable ''      | Usage: /claude:plugin disable <plugin>@<marketplace> [--scope user\|project] [--local]                           |
