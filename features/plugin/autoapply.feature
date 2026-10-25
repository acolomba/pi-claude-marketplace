Feature: Plugin autoapply

  A config that turns autoapply on makes a new session apply the configs and
  marketplaces itself, so a checked-out project needs no apply command. The
  scenarios run the real extension in a headless Pi with local marketplaces.

  Background:
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name  | version |
      | demo  | 1.0.0   |
      | alpha | 1.0.0   |

  Scenario: A new session installs the plugins a project config declares when the config turns autoapply on
    Given a config in scope project and layer base, with this text:
      """
      { "autoapply": true }
      """
    Given the marketplace "fixtures" is added to the project scope
    Given a config in scope project and layer base, with these plugins:
      | marketplace | plugin | enabled |
      | fixtures    | demo   |         |
    When the user starts a new pi session
    Then the session reports these results:
      | kind                      | severity | needs reload | tally label | tally failures | tally warnings | tally success count |
      | reconcile-applied-cascade | info     | true         | Reconcile   | 0              | 0              | 1                   |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | installed |         | project | 1.0.0   |
    Then the installation record of the project scope holds these plugins:
      | id            | version | enabled |
      | demo@fixtures | 1.0.0   | true    |
    Then the session offers these skills:
      | command           | description            |
      | /skill:demo-skill | A skill of demo 1.0.0. |
