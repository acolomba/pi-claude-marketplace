Feature: Plugin disable

  Disabling a plugin acts on the layer the command names and keeps the plugin installed.
  The scenarios run the real extension in a headless Pi, read its JSON results,
  and use a local marketplace in place of a published one.

  Background:
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" is added to the project scope

  Scenario: Disabling with --local a plugin only the shared layer declares fails as plugin declared in shared config
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    When the user runs "/claude:plugin disable demo@fixtures --scope project --local"
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

  Scenario: Disabling without --local a plugin the local layer enables fails as enabled in local layer
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has run "/claude:plugin install demo@fixtures --scope project --local"
    Given the user has run "/claude:plugin disable demo@fixtures --scope project --local"
    Given the user has run "/claude:plugin enable demo@fixtures --scope project --local"
    When the user runs "/claude:plugin disable demo@fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status | reasons                | scope   | cause chain                                       | cause truncated | leaks | rollback partial |
      | fixtures         | project           | demo@fixtures | demo | failed | enabled in local layer | project | Run the command again with --local to disable it. | false           |       |                  |
    Then the "claude-plugins.local.json" file of the project scope declares these plugins:
      | id            | enabled |
      | demo@fixtures | true    |
    Then the "claude-plugins.json" file of the project scope declares these plugins:
      | id            |
      | demo@fixtures |
    When the user starts a new pi session
    Then the session offers these skills:
      | command           | description            |
      | /skill:demo-skill | A skill of demo 1.0.0. |
