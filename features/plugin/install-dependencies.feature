Feature: Plugin install dependencies

  Installing a plugin also installs the plugins it declares as dependencies.
  The scenarios run the real extension in a headless Pi and use a local
  marketplace in place of a published one.

  Scenario: Installing a plugin whose dependency carries a version constraint installs the dependency too
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib@^1.0.0   |
      | lib  | 1.2.0   |              |
    Given the marketplace "tools" is added to the project scope
    When the user runs "/claude:plugin install app@tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name      | status    | reasons                 | scope   | version |
      | tools            | project           | app@tools | app       | installed |                         | project | 1.0.0   |
      | tools            | project           | lib@tools | lib@tools | installed | dependency current copy | project | 1.2.0   |
    When the user starts a new pi session
    Then the session offers these skills:
      | command          | description           |
      | /skill:app-skill | A skill of app 1.0.0. |
      | /skill:lib-skill | A skill of lib 1.2.0. |
