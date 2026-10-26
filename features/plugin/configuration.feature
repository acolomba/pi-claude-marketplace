Feature: Plugin configuration

  Each scope has a base layer and a local layer, and a new session loads what
  the two layers declare once merged. The scenarios run the real extension in a
  headless Pi and use a local marketplace in place of a published one.

  Background:
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |

  Scenario: A plugin the base layer disables stays disabled when the local layer declares it too
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has run "/claude:plugin disable demo@fixtures --scope project"
    Given the user has run "/claude:plugin install demo@fixtures --scope project --local"
    When the user starts a new pi session
    Then the session offers no skills
    Then the "claude-plugins.json" file of the project scope declares these plugins:
      | id            | enabled |
      | demo@fixtures | false   |
    Then the "claude-plugins.local.json" file of the project scope declares these plugins:
      | id            |
      | demo@fixtures |

  Scenario: A plugin the local layer enables is enabled although the base layer disables it
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has run "/claude:plugin disable demo@fixtures --scope project"
    Given the user has run "/claude:plugin install demo@fixtures --scope project --local"
    Given the user has run "/claude:plugin enable demo@fixtures --scope project --local"
    When the user starts a new pi session
    Then the "claude-plugins.json" file of the project scope declares these plugins:
      | id            | enabled |
      | demo@fixtures | false   |
    Then the "claude-plugins.local.json" file of the project scope declares these plugins:
      | id            | enabled |
      | demo@fixtures | true    |
    Then the session offers these skills:
      | command           | description            |
      | /skill:demo-skill | A skill of demo 1.0.0. |

  Scenario: A plugin whose marketplace no layer declares keeps its dangling reference row
    Given a config in scope project and layer local, with these plugins:
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

  Scenario: A local layer that declares a plugin without its marketplace is reported as an invalid config
    Given the marketplace "fixtures" is added to the project scope
    Given a config in scope project and layer local, with these plugins:
      | marketplace | plugin | enabled |
      | fixtures    | demo   |         |
    When the user runs "/claude:plugin pending --scope project"
    Then the result has these fields:
      | kind           | cascade                        |
      | severity       | error                          |
      | needs reload   | false                          |
      | summary        | A plugin operation has failed. |
      | tally label    | Reconcile pending              |
      | tally failures | 1                              |
      | tally warnings | 0                              |
    Then the result lists these plugins:
      | marketplace name          | marketplace scope | id                                                  | name                      | status | reasons          | scope   | cause chain                                                                                                                                                                                                                                                                                             | cause truncated | leaks | rollback partial |
      | claude-plugins.local.json | project           | claude-plugins.local.json@claude-plugins.local.json | claude-plugins.local.json | failed | invalid manifest | project | The local config (claude-plugins.local.json) declares demo@fixtures, but only the base config (claude-plugins.json) declares its marketplace. Run /claude:plugin marketplace add <source> --local --scope project with the source the base config declares, or remove the plugin from the local config. | false           |       |                  |

  Scenario: A new session does not install a plugin whose local layer lacks its marketplace
    Given the marketplace "fixtures" is added to the project scope
    Given a config in scope project and layer local, with these plugins:
      | marketplace | plugin | enabled |
      | fixtures    | demo   |         |
    When the user starts a new pi session
    Then the session reports these results:
      | kind    | severity | needs reload | summary                        | tally label       | tally failures | tally warnings |
      | cascade | error    | false        | A plugin operation has failed. | Reconcile pending | 1              | 0              |
      | cascade | error    | false        | A plugin operation has failed. | Reconcile pending | 1              | 0              |
    Then the results list these marketplaces and plugins:
      | marketplace name          | marketplace scope | id                                                  | name                      | status | reasons          | scope   | cause chain                                                                                                                                                                                                                                                                                             | cause truncated | leaks | rollback partial |
      | claude-plugins.local.json | project           | claude-plugins.local.json@claude-plugins.local.json | claude-plugins.local.json | failed | invalid manifest | project | The local config (claude-plugins.local.json) declares demo@fixtures, but only the base config (claude-plugins.json) declares its marketplace. Run /claude:plugin marketplace add <source> --local --scope project with the source the base config declares, or remove the plugin from the local config. | false           |       |                  |
      | claude-plugins.local.json | project           | claude-plugins.local.json@claude-plugins.local.json | claude-plugins.local.json | failed | invalid manifest | project | The local config (claude-plugins.local.json) declares demo@fixtures, but only the base config (claude-plugins.json) declares its marketplace. Run /claude:plugin marketplace add <source> --local --scope project with the source the base config declares, or remove the plugin from the local config. | false           |       |                  |
    Then the session offers no skills
    Then the "claude-plugins.local.json" file of the project scope declares these plugins:
      | id            |
      | demo@fixtures |
    Then the "claude-plugins.local.json" file of the project scope declares no marketplaces

  Scenario: A base layer that declares a plugin without its marketplace is reported as an invalid config
    Given the user has run "/claude:plugin marketplace add {home}/marketplaces/fixtures --scope project --local"
    Given a config in scope project and layer base, with these plugins:
      | marketplace | plugin | enabled |
      | fixtures    | demo   |         |
    When the user runs "/claude:plugin pending --scope project"
    Then the result has these fields:
      | kind           | cascade                        |
      | severity       | error                          |
      | needs reload   | false                          |
      | summary        | A plugin operation has failed. |
      | tally label    | Reconcile pending              |
      | tally failures | 1                              |
      | tally warnings | 0                              |
    Then the result lists these plugins:
      | marketplace name    | marketplace scope | id                                      | name                | status | reasons          | scope   | cause chain                                                                                                                                                                                                                                                                                     | cause truncated | leaks | rollback partial |
      | claude-plugins.json | project           | claude-plugins.json@claude-plugins.json | claude-plugins.json | failed | invalid manifest | project | The base config (claude-plugins.json) declares demo@fixtures, but only the local config (claude-plugins.local.json) declares its marketplace. Run /claude:plugin marketplace add <source> --scope project with the source the local config declares, or remove the plugin from the base config. | false           |       |                  |
