Feature: Plugin reinstall

  Reinstalling a plugin builds its installed version again in place.
  The scenarios run the real extension in a headless Pi, read its JSON results,
  and use a local marketplace in place of a published one.

  Background:
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"

  Scenario: Reinstalling with --local a plugin only the shared layer declares fails as plugin declared in shared config
    When the user runs "/claude:plugin reinstall demo@fixtures --scope project --local"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status | reasons                          | scope   | cause chain                                                                                                                 | cause truncated | leaks | rollback partial |
      | fixtures         | project           | demo@fixtures | demo | failed | plugin declared in shared config | project | The plugin demo@fixtures is declared only in the shared layer (claude-plugins.json). Run the command again without --local. | false           |       |                  |
    Then the "claude-plugins.local.json" file of the project scope does not exist
    Then the "claude-plugins.json" file of the project scope declares these plugins:
      | id            |
      | demo@fixtures |
    When the user starts a new pi session
    Then the session offers these skills:
      | command           | description            |
      | /skill:demo-skill | A skill of demo 1.0.0. |

  Scenario: Reinstalling every plugin with --local reinstalls only the plugins the local layer declares
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
      | pp   | 1.0.0   |
    Given the user has run "/claude:plugin install pp@fixtures --scope project --local"
    When the user runs "/claude:plugin reinstall --scope project --local"
    Then the result has these fields:
      | kind                | cascade          |
      | severity            | info             |
      | needs reload        | true             |
      | tally label         | Plugin reinstall |
      | tally failures      | 0                |
      | tally warnings      | 0                |
      | tally success count | 1                |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id          | name | status      | reasons | scope   | version |
      | fixtures         | project           | pp@fixtures | pp   | reinstalled |         | project | 1.0.0   |

  Scenario: Reinstalling every plugin with --local also reinstalls the dependencies the local plugins need
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib          |
      | lib  | 1.0.0   |              |
      | svc  | 1.0.0   | core         |
      | core | 1.0.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install app@tools --scope project --local"
    Given the user has run "/claude:plugin install svc@tools --scope project"
    When the user runs "/claude:plugin reinstall --scope project --local"
    Then the result has these fields:
      | kind                | cascade          |
      | severity            | info             |
      | needs reload        | true             |
      | tally label         | Plugin reinstall |
      | tally failures      | 0                |
      | tally warnings      | 0                |
      | tally success count | 2                |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name | status      | reasons | scope   | version |
      | tools            | project           | app@tools | app  | reinstalled |         | project | 1.0.0   |
      | tools            | project           | lib@tools | lib  | reinstalled |         | project | 1.0.0   |

  Scenario: Reinstalling every plugin with --local fails and reinstalls nothing when the dependencies of a local plugin cannot be read
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
      | pp   | 1.0.0   |
    Given the user has run "/claude:plugin install pp@fixtures --scope project --local"
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib          |
      | lib  | 1.0.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install app@tools --scope project --local"
    Given the manifest of the marketplace "tools" has become invalid
    When the user runs "/claude:plugin reinstall --scope project --local"
    Then the result has these fields:
      | kind           | cascade                        |
      | severity       | error                          |
      | needs reload   | false                          |
      | summary        | A plugin operation has failed. |
      | tally label    | Plugin reinstall               |
      | tally failures | 1                              |
      | tally warnings | 0                              |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id                      | name        | status | reasons    | scope   | cause chain                                                                                         | cause truncated | leaks | rollback partial |
      | (reinstall)      | project           | (reinstall)@(reinstall) | (reinstall) | failed | unreadable | project | cannot read the dependencies of app@tools: marketplace.json schema invalid: /plugins: must be array | false           |       |                  |

  Scenario: Reinstalling a dependency declares nothing in the configuration
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib          |
      | lib  | 1.0.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install app@tools --scope project"
    When the user runs "/claude:plugin reinstall lib@tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name | status      | reasons | scope   | version |
      | tools            | project           | lib@tools | lib  | reinstalled |         | project | 1.0.0   |
    Then the "claude-plugins.json" file of the project scope declares these plugins:
      | id            |
      | demo@fixtures |
      | app@tools     |
    Then the "claude-plugins.local.json" file of the project scope does not exist

  Scenario: Reinstalling every plugin of a marketplace whose manifest became invalid shows no manifest text as a cause
    Given the manifest of the marketplace "fixtures" has become invalid
    When the user runs "/claude:plugin reinstall @fixtures --scope project"
    Then the result has these fields:
      | kind           | cascade                        |
      | severity       | error                          |
      | needs reload   | false                          |
      | summary        | A plugin operation has failed. |
      | tally label    | Plugin reinstall               |
      | tally failures | 1                              |
      | tally warnings | 0                              |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status | reasons    | scope   | leaks | rollback partial |
      | fixtures         | project           | demo@fixtures | demo | failed | unreadable | project |       |                  |
