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
