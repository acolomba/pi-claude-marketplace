Feature: Plugin partial install

  A plugin that ships a component Pi does not support is only partially available,
  and installing it without --partial must change nothing. The scenarios run the real
  extension in a headless Pi and use a local marketplace in place of a published one.

  Scenario: Installing a partially available plugin without --partial fails as partially available
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has an output style
    Given the marketplace "fixtures" is added to the project scope
    When the user runs "/claude:plugin install demo@fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status              | reasons               | hint            |
      | fixtures         | project           | demo@fixtures | demo | partially-available | unsupported component | partial-install |
    Then the project scope has no installed plugins
