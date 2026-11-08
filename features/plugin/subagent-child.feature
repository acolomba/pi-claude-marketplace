Feature: Plugin subagent child

  A load in a pi-subagents background child changes nothing installed (D-MB-12). A profile Pi
  started with the runner's marker in its environment stands in for the child, and a local
  marketplace stands in for a published one.

  Scenario: A background child's load leaves a declared plugin pending while autoapply is on
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given a config in scope project and layer base, with this text:
      """
      { "autoapply": true }
      """
    Given the marketplace "fixtures" is added to the project scope
    Given a config in scope project and layer base, with these plugins:
      | marketplace | plugin | enabled |
      | fixtures    | demo   |         |
    Given pi runs with the scripted model as a pi-subagents background child
    When the user starts a new pi session
    Then the session reports these results:
      | kind    | severity | needs reload | needs apply | tally label       | tally failures | tally warnings | tally success count |
      | cascade | info     | false        | true        | Reconcile pending | 0              | 0              | 1                   |
      | cascade | info     | false        | true        | Reconcile pending | 0              | 0              | 1                   |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status       | reasons | scope   |
      | fixtures         | project           | demo@fixtures | demo | will install |         | project |
      | fixtures         | project           | demo@fixtures | demo | will install |         | project |
    Then the installation record of the project scope holds no plugins
