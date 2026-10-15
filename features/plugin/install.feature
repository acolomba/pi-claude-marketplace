Feature: Plugin install

  Installing a plugin from an added marketplace materializes it in the chosen scope.
  The scenarios run the real extension in a headless Pi, read its JSON results,
  and use a local marketplace in place of a published one.

  Background:
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" is added to the project scope

  Scenario: Installing a plugin reports it installed in the chosen scope
    When the user runs "/claude:plugin install demo@fixtures --scope project"
    Then the result has these fields:
      | severity     | info |
      | needs reload | true |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | installed |         | project | 1.0.0   |

  Scenario: A new session offers the skills of the installed plugin
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    When the user starts a new pi session
    Then the session offers these skills:
      | command           | description            |
      | /skill:demo-skill | A skill of demo 1.0.0. |

  Scenario: The plugin list shows the installed plugin
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    When the user runs "/claude:plugin list --scope project"
    Then the result has these fields:
      | severity            | info        |
      | needs reload        | false       |
      | tally label         | Plugin list |
      | tally failures      | 0           |
      | tally warnings      | 0           |
      | tally success count | 1           |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | installed |         | project | 1.0.0   |

  Scenario: Installing a plugin the marketplace does not offer fails as not in manifest
    When the user runs "/claude:plugin install missing@fixtures --scope project"
    Then the result has these fields:
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id               | name    | status | reasons         | scope   | cause chain                                           | cause truncated | leaks | rollback partial |
      | fixtures         | project           | missing@fixtures | missing | failed | not in manifest | project | Plugin "missing" not found in marketplace "fixtures". | false           |       |                  |

  Scenario: Installing a plugin that is already installed fails as already installed
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    When the user runs "/claude:plugin install demo@fixtures --scope project"
    Then the result has these fields:
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status | reasons           | scope   | cause chain                                                   | cause truncated | leaks | rollback partial |
      | fixtures         | project           | demo@fixtures | demo | failed | already installed | project | Plugin "demo" is already installed in marketplace "fixtures". | false           |       |                  |
