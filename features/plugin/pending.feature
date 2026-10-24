Feature: Plugin pending

  Pending lists what the next session would change to bring a scope in line
  with the configs a user edits by hand. The scenarios run the real extension
  in a headless Pi and use a local marketplace in place of a published one.

  Background:
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name  | version |
      | demo  | 1.0.0   |
      | alpha | 1.0.0   |
      | beta  | 1.0.0   |
      | gamma | 1.0.0   |

  Scenario: Pending lists the marketplace add and the install that a marketplace and a plugin declared by hand in the base config would cause
    Given a config in scope project and layer base, with these marketplaces:
      | name     | source                       | autoupdate |
      | fixtures | {home}/marketplaces/fixtures |            |
    Given a config in scope project and layer base, with these plugins:
      | marketplace | plugin | enabled |
      | fixtures    | demo   |         |
    When the user runs "/claude:plugin pending --scope project"
    Then the result has these fields:
      | kind                | cascade           |
      | severity            | info              |
      | needs reload        | false             |
      | needs apply         | true              |
      | tally label         | Reconcile pending |
      | tally failures      | 0                 |
      | tally warnings      | 0                 |
      | tally success count | 2                 |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace status | id            | name | status       | reasons | scope   |
      | fixtures         | project           | will add           | demo@fixtures | demo | will install |         | project |

  Scenario: Pending lists the marketplace add and the install that a marketplace and a plugin declared by hand in the local config would cause
    Given a config in scope project and layer local, with these marketplaces:
      | name     | source                       | autoupdate |
      | fixtures | {home}/marketplaces/fixtures |            |
    Given a config in scope project and layer local, with these plugins:
      | marketplace | plugin | enabled |
      | fixtures    | demo   |         |
    When the user runs "/claude:plugin pending --scope project"
    Then the result has these fields:
      | kind                | cascade           |
      | severity            | info              |
      | needs reload        | false             |
      | needs apply         | true              |
      | tally label         | Reconcile pending |
      | tally failures      | 0                 |
      | tally warnings      | 0                 |
      | tally success count | 2                 |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace status | id            | name | status       | reasons | scope   |
      | fixtures         | project           | will add           | demo@fixtures | demo | will install |         | project |

  Scenario: Pending lists a marketplace that a config declares by hand with no plugin
    Given a config in scope project and layer base, with these marketplaces:
      | name     | source                       | autoupdate |
      | fixtures | {home}/marketplaces/fixtures |            |
    When the user runs "/claude:plugin pending --scope project"
    Then the result has these fields:
      | kind                | cascade           |
      | severity            | info              |
      | needs reload        | false             |
      | needs apply         | true              |
      | tally label         | Reconcile pending |
      | tally failures      | 0                 |
      | tally warnings      | 0                 |
      | tally success count | 1                 |
    Then the result lists these marketplaces:
      | name     | scope   | status   |
      | fixtures | project | will add |

  Scenario: Pending reports nothing when the configs and the records agree
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    When the user runs "/claude:plugin pending --scope project"
    Then the result has these fields:
      | kind         | reconcile-pending-empty |
      | severity     | info                    |
      | needs reload | false                   |

  Scenario: Pending lists the install, uninstall, disable, and enable that one hand edit of the base config would cause
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has run "/claude:plugin install beta@fixtures --scope project"
    Given the user has run "/claude:plugin install gamma@fixtures --scope project"
    Given the user has run "/claude:plugin disable gamma@fixtures --scope project"
    Given a config in scope project and layer base, with these plugins:
      | marketplace | plugin | enabled |
      | fixtures    | alpha  |         |
      | fixtures    | beta   | false   |
      | fixtures    | gamma  | true    |
    When the user runs "/claude:plugin pending --scope project"
    Then the result has these fields:
      | kind                | cascade           |
      | severity            | info              |
      | needs reload        | false             |
      | needs apply         | true              |
      | tally label         | Reconcile pending |
      | tally failures      | 0                 |
      | tally warnings      | 0                 |
      | tally success count | 4                 |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id             | name  | status         | reasons | scope   | version |
      | fixtures         | project           | alpha@fixtures | alpha | will install   |         | project |         |
      | fixtures         | project           | demo@fixtures  | demo  | will uninstall |         | project | 1.0.0   |
      | fixtures         | project           | beta@fixtures  | beta  | will disable   |         | project |         |
      | fixtures         | project           | gamma@fixtures | gamma | will enable    |         | project |         |

  Scenario: Pending lists the marketplace remove and an uninstall with its version for each plugin of a marketplace the base config no longer declares
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has run "/claude:plugin install alpha@fixtures --scope project"
    Given a config in scope project and layer base, with this text:
      """
      {}
      """
    When the user runs "/claude:plugin pending --scope project"
    Then the result has these fields:
      | kind                | cascade           |
      | severity            | info              |
      | needs reload        | false             |
      | needs apply         | true              |
      | tally label         | Reconcile pending |
      | tally failures      | 0                 |
      | tally warnings      | 0                 |
      | tally success count | 3                 |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace status | id             | name  | status         | reasons | scope   | version |
      | fixtures         | project           | will remove        | demo@fixtures  | demo  | will uninstall |         | project | 1.0.0   |
      | fixtures         | project           | will remove        | alpha@fixtures | alpha | will uninstall |         | project | 1.0.0   |

  Scenario: Pending with --scope user lists only the changes of the user scope
    Given the marketplace "fixtures" is added to the project scope
    Given the marketplace "fixtures" is added to the user scope
    Given a config in scope project and layer base, with these plugins:
      | marketplace | plugin | enabled |
      | fixtures    | demo   |         |
    Given a config in scope user and layer base, with these plugins:
      | marketplace | plugin | enabled |
      | fixtures    | alpha  |         |
    When the user runs "/claude:plugin pending --scope user"
    Then the result has these fields:
      | kind                | cascade           |
      | severity            | info              |
      | needs reload        | false             |
      | needs apply         | true              |
      | tally label         | Reconcile pending |
      | tally failures      | 0                 |
      | tally warnings      | 0                 |
      | tally success count | 1                 |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id             | name  | status       | reasons | scope |
      | fixtures         | user              | alpha@fixtures | alpha | will install |         | user  |

  Scenario: Pending with --scope project lists only the changes of the project scope
    Given the marketplace "fixtures" is added to the project scope
    Given the marketplace "fixtures" is added to the user scope
    Given a config in scope project and layer base, with these plugins:
      | marketplace | plugin | enabled |
      | fixtures    | demo   |         |
    Given a config in scope user and layer base, with these plugins:
      | marketplace | plugin | enabled |
      | fixtures    | alpha  |         |
    When the user runs "/claude:plugin pending --scope project"
    Then the result has these fields:
      | kind                | cascade           |
      | severity            | info              |
      | needs reload        | false             |
      | needs apply         | true              |
      | tally label         | Reconcile pending |
      | tally failures      | 0                 |
      | tally warnings      | 0                 |
      | tally success count | 1                 |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status       | reasons | scope   |
      | fixtures         | project           | demo@fixtures | demo | will install |         | project |

  Scenario: Pending lists the disable of a plugin that an update left needing a newer version of its dependency
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib          |
      | lib  | 1.0.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install app@tools --scope project"
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 2.0.0   | lib@^2.0.0   |
      | lib  | 1.0.0   |              |
    Given the user has run "/claude:plugin update app@tools --scope project"
    When the user runs "/claude:plugin pending --scope project"
    Then the result has these fields:
      | kind                | cascade           |
      | severity            | info              |
      | needs reload        | false             |
      | needs apply         | true              |
      | tally label         | Reconcile pending |
      | tally failures      | 0                 |
      | tally warnings      | 0                 |
      | tally success count | 1                 |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name | status       | reasons | scope   |
      | tools            | project           | app@tools | app  | will disable |         | project |
