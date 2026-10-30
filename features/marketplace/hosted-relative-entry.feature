Feature: Marketplace hosted relative entry

  A hosted marketplace is one catalog file, so an entry that names a relative
  path has no plugin files behind it, and Pi refuses such an entry as Claude Code does.
  The run's loopback https git host serves the catalog file and records every request.

  Scenario Outline: Installing a plugin that a hosted catalog lists by a relative path fails as unavailable with an unsupported source
    Given the marketplace "tools" is published as a hosted source
    Given the marketplace "tools" publishes this manifest:
      """
      {"name":"tools","owner":{"name":"features"},"plugins":[{"name":"demo","source":"<entry source>","version":"1.0.0"}]}
      """
    Given the marketplace "tools" is added to the project scope
    When the user runs "/claude:plugin install demo@tools --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id         | name | status      | reasons            |
      | tools            | project           | demo@tools | demo | unavailable | unsupported source |
    Then the project scope has no installed plugins
    Then the "claude-plugins.json" file of the project scope declares no plugins
    Then the git host receives no request

    Examples:
      | entry source     |
      | ./plugins/demo   |
      | ./               |
      | ./.claude-plugin |

  Scenario: The plugin list shows the plugins a hosted catalog lists by a relative path as unavailable with an unsupported source
    Given the marketplace "tools" is published as a hosted source
    Given the marketplace "tools" publishes this manifest:
      """
      {"name":"tools","owner":{"name":"features"},"plugins":[{"name":"demo","source":"./plugins/demo","version":"1.0.0"},{"name":"root","source":"./","version":"1.0.0"}]}
      """
    Given the marketplace "tools" is added to the project scope
    When the user runs "/claude:plugin list --scope project"
    Then the result has these fields:
      | kind                | cascade     |
      | severity            | info        |
      | needs reload        | false       |
      | tally label         | Plugin list |
      | tally failures      | 0           |
      | tally warnings      | 0           |
      | tally success count | 2           |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id         | name | status      | reasons            | version |
      | tools            | project           | demo@tools | demo | unavailable | unsupported source | 1.0.0   |
      | tools            | project           | root@tools | root | unavailable | unsupported source | 1.0.0   |
    Then the git host receives no request

  Scenario: Info on a plugin that a hosted catalog lists by a relative path names it unavailable with an unsupported source
    Given the marketplace "tools" is published as a hosted source
    Given the marketplace "tools" publishes this manifest:
      """
      {"name":"tools","owner":{"name":"features"},"plugins":[{"name":"root","source":"./","version":"1.0.0"}]}
      """
    Given the marketplace "tools" is added to the project scope
    When the user runs "/claude:plugin info root@tools"
    Then the result has these fields:
      | kind                           | plugin-info        |
      | marketplace details autoupdate | false              |
      | marketplace name               | tools              |
      | marketplace scope              | project            |
      | needs reload                   | false              |
      | plugin components resolved     | true               |
      | plugin id                      | root@tools         |
      | plugin name                    | root               |
      | plugin reasons                 | unsupported source |
      | plugin status                  | unavailable        |
      | plugin version                 | 1.0.0              |
      | severity                       | info               |
    Then the git host receives no request

  Scenario: Updating a plugin that a hosted catalog now lists by a relative path skips it as no longer installable and keeps it installed
    Given the git repository "ghp" holds these plugins:
      | name | version | path |
      | ghp  | 1.0.0   |      |
    Given the marketplace "tools" is published as a hosted source
    Given the marketplace "tools" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | ghp  | url         | ghp        | false  |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install ghp@tools --scope project"
    Given the marketplace "tools" publishes this manifest:
      """
      {"name":"tools","owner":{"name":"features"},"plugins":[{"name":"ghp","source":"./","version":"2.0.0"}]}
      """
    Given the user has run "/claude:plugin marketplace update tools --scope project"
    When the user runs "/claude:plugin update ghp@tools --scope project"
    Then the result has these fields:
      | kind         | cascade                             |
      | severity     | warning                             |
      | needs reload | false                               |
      | summary      | A plugin operation needs attention. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name | status  | reasons               | scope   | version |
      | tools            | project           | ghp@tools | ghp  | skipped | no longer installable | project | 1.0.0   |
    Then the installation record of the project scope holds these plugins:
      | id        | version | enabled |
      | ghp@tools | 1.0.0   | true    |
    Then the git host receives no request

  Scenario: A hosted catalog that now lists an installed plugin by a relative path leaves nothing pending
    Given the git repository "ghp" holds these plugins:
      | name | version | path |
      | ghp  | 1.0.0   |      |
    Given the marketplace "tools" is published as a hosted source
    Given the marketplace "tools" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | ghp  | url         | ghp        | false  |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install ghp@tools --scope project"
    Given the marketplace "tools" publishes this manifest:
      """
      {"name":"tools","owner":{"name":"features"},"plugins":[{"name":"ghp","source":"./","version":"2.0.0"}]}
      """
    Given the user has run "/claude:plugin marketplace update tools --scope project"
    When the user runs "/claude:plugin pending --scope project"
    Then the result has these fields:
      | kind         | reconcile-pending-empty |
      | severity     | info                    |
      | needs reload | false                   |
    Then the git host receives no request
