Feature: Plugin info

  Info on a plugin shows what a marketplace offers under that name and where
  the plugin is installed. The scenarios run the real extension in a headless
  Pi and use a local marketplace in place of a published one.

  Scenario: Info on a plugin installed in both scopes shows its installation in each
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" is added to the user scope
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    When the user runs "/claude:plugin info demo@fixtures"
    Then the result has these fields:
      | kind         | plugin-info-cascade |
      | severity     | info                |
      | needs reload | false               |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace details autoupdate | plugin id     | plugin name | plugin status | plugin reasons | plugin scope | plugin version | plugin components resolved | plugin components skills |
      | fixtures         | project           | false                          | demo@fixtures | demo        | installed     |                | project      | 1.0.0          | true                       | demo-skill               |
      | fixtures         | user              | false                          | demo@fixtures | demo        | installed     |                | user         | 1.0.0          | true                       | demo-skill               |
