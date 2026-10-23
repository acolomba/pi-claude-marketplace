Feature: Plugin reconcile

  A new session brings a scope in line with the configs a user edits by hand
  and reports what it changed. The scenarios run the real extension in a
  headless Pi and use a local marketplace in place of a published one.

  Scenario: A new session installs a plugin that a config declares by hand and reports it
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" is added to the project scope
    Given a config in scope project and layer base, with these plugins:
      | marketplace | plugin | enabled |
      | fixtures    | demo   |         |
    When the user starts a new pi session
    Then the result has these fields:
      | kind                | reconcile-applied-cascade |
      | severity            | info                      |
      | needs reload        | false                     |
      | tally label         | Reconcile                 |
      | tally failures      | 0                         |
      | tally warnings      | 0                         |
      | tally success count | 1                         |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope   |
      | fixtures         | project           | demo@fixtures | demo | installed |         | project |
    Then the session offers these skills:
      | command           | description            |
      | /skill:demo-skill | A skill of demo 1.0.0. |
