Feature: Marketplace update

  Updating a marketplace refreshes its manifest from its source.
  The scenarios run the real extension in a headless Pi and use local
  marketplaces in place of published ones.

  Scenario: A bare update reports one result per marketplace of both scopes, project first
    Given the marketplace "beta" is published as a dir source
    Given the marketplace "alpha" is published as a dir source
    Given the marketplace "gamma" is published as a dir source
    Given the marketplace "beta" is added to the user scope
    Given the marketplace "alpha" is added to the project scope
    Given the marketplace "gamma" is added to the project scope
    When the user runs "/claude:plugin marketplace update"
    Then the command reports these results:
      | kind    | severity | needs reload | tally label        | tally failures | tally warnings | tally success count |
      | cascade | info     | false        | Marketplace update | 0              | 0              | 1                   |
      | cascade | info     | false        | Marketplace update | 0              | 0              | 1                   |
      | cascade | info     | false        | Marketplace update | 0              | 0              | 1                   |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | marketplace status | marketplace reasons |
      | alpha            | project           | skipped            | up-to-date          |
      | gamma            | project           | skipped            | up-to-date          |
      | beta             | user              | skipped            | up-to-date          |
