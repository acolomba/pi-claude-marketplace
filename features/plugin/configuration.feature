Feature: Plugin configuration

  Each scope has a shared layer and a local layer, and a new session loads what
  the two layers declare once merged. The scenarios run the real extension in a
  headless Pi and use a local marketplace in place of a published one.

  Background:
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |

  Scenario: A plugin the shared layer disables stays disabled when the local layer declares it too
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has run "/claude:plugin disable demo@fixtures --scope project"
    Given the user has run "/claude:plugin install demo@fixtures --scope project --local"
    When the user starts a new pi session
    Then the session offers no skills

  Scenario: A plugin whose marketplace no layer declares keeps its dangling reference row
    Given a plugin configuration file in scope project and layer local, with these plugins:
      | marketplace | plugin | enabled |
      | fixtures    | demo   |         |
    When the user runs "/claude:plugin pending --scope project"
    Then the result has these fields:
      | kind           | cascade                      |
      | severity       | error                        |
      | needs reload   | false                        |
      | summary        | Some operations have failed. |
      | tally label    | Reconcile pending            |
      | tally failures | 2                            |
      | tally warnings | 0                            |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace status | marketplace reasons | id            | name | status | reasons            | scope   | leaks | rollback partial |
      | fixtures         | project           | failed             | dangling reference  | demo@fixtures | demo | failed | dangling reference | project |       |                  |
