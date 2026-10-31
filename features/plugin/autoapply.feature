Feature: Plugin autoapply

  When autoapply is on, a new session applies its configs and marketplaces.
  /claude:plugin autoapply shows or changes that setting.

  Scenario: A new session installs the plugins a project config declares when the config turns autoapply on
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

  Scenario: A new session clones and installs a git-source plugin that a project config declares when autoapply is on
    Given the git repository "ghp" holds these plugins:
      | name | version | path |
      | ghp  | 1.0.0   |      |
    Given the marketplace "gits" is published as a dir source
    Given the marketplace "gits" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | ghp  | github      | ghp        | false  |
    Given a config in scope project and layer base, with this text:
      """
      { "autoapply": true }
      """
    Given the marketplace "gits" is added to the project scope
    Given a config in scope project and layer base, with these plugins:
      | marketplace | plugin | enabled |
      | gits        | ghp    |         |
    When the user starts a new pi session
    Then the session reports these results:
      | kind                      | severity | needs reload | tally label | tally failures | tally warnings | tally success count |
      | reconcile-applied-cascade | info     | true         | Reconcile   | 0              | 0              | 1                   |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id       | name | status    | reasons | scope   | version |
      | gits             | project           | ghp@gits | ghp  | installed |         | project | 1.0.0   |
    Then the git host receives these requests:
      | method | path                                            | status |
      | GET    | /acme/ghp.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/ghp.git/git-upload-pack                   | 200    |
    Then the session offers these skills:
      | command          | description           |
      | /skill:ghp-skill | A skill of ghp 1.0.0. |

  Scenario: Autoapply in the user config applies the plugins a project config declares
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given a config in scope user and layer base, with this text:
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
    Then the session offers these skills:
      | command           | description            |
      | /skill:demo-skill | A skill of demo 1.0.0. |

  Scenario: A project local config that turns autoapply off overrides a base config that turns it on
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
    Given a config in scope project and layer local, with this text:
      """
      { "autoapply": false }
      """
    When the user starts a new pi session
    Then the session reports these results:
      | kind    | severity | needs reload | needs apply | tally label       | tally failures | tally warnings | tally success count |
      | cascade | info     | false        | true        | Reconcile pending | 0              | 0              | 1                   |
      | cascade | info     | false        | true        | Reconcile pending | 0              | 0              | 1                   |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status       | reasons | scope   |
      | fixtures         | project           | demo@fixtures | demo | will install |         | project |
      | fixtures         | project           | demo@fixtures | demo | will install |         | project |
    Then the project scope has no installed plugins
    Then the session offers no skills

  Scenario: A project config that turns autoapply off overrides a user config that turns it on
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given a config in scope user and layer base, with this text:
      """
      { "autoapply": true }
      """
    Given a config in scope project and layer base, with this text:
      """
      { "autoapply": false }
      """
    Given the marketplace "fixtures" is added to the project scope
    Given a config in scope project and layer base, with these plugins:
      | marketplace | plugin | enabled |
      | fixtures    | demo   |         |
    When the user starts a new pi session
    Then the session reports these results:
      | kind    | severity | needs reload | needs apply | tally label       | tally failures | tally warnings | tally success count |
      | cascade | info     | false        | true        | Reconcile pending | 0              | 0              | 1                   |
      | cascade | info     | false        | true        | Reconcile pending | 0              | 0              | 1                   |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status       | reasons | scope   |
      | fixtures         | project           | demo@fixtures | demo | will install |         | project |
      | fixtures         | project           | demo@fixtures | demo | will install |         | project |
    Then the project scope has no installed plugins
    Then the session offers no skills

  Scenario: A project local config that turns autoapply on overrides a user config that turns it off
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given a config in scope user and layer base, with this text:
      """
      { "autoapply": false }
      """
    Given the marketplace "fixtures" is added to the project scope
    Given a config in scope project and layer base, with these plugins:
      | marketplace | plugin | enabled |
      | fixtures    | demo   |         |
    Given a config in scope project and layer local, with this text:
      """
      { "autoapply": true }
      """
    When the user starts a new pi session
    Then the session reports these results:
      | kind                      | severity | needs reload | tally label | tally failures | tally warnings | tally success count |
      | reconcile-applied-cascade | info     | true         | Reconcile   | 0              | 0              | 1                   |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | installed |         | project | 1.0.0   |
    Then the session offers these skills:
      | command           | description            |
      | /skill:demo-skill | A skill of demo 1.0.0. |

  Scenario: A config that turns autoapply off keeps a new session read-only
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given a config in scope project and layer base, with this text:
      """
      { "autoapply": false }
      """
    Given the marketplace "fixtures" is added to the project scope
    Given a config in scope project and layer base, with these plugins:
      | marketplace | plugin | enabled |
      | fixtures    | demo   |         |
    When the user starts a new pi session
    Then the session reports these results:
      | kind    | severity | needs reload | needs apply | tally label       | tally failures | tally warnings | tally success count |
      | cascade | info     | false        | true        | Reconcile pending | 0              | 0              | 1                   |
      | cascade | info     | false        | true        | Reconcile pending | 0              | 0              | 1                   |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status       | reasons | scope   |
      | fixtures         | project           | demo@fixtures | demo | will install |         | project |
      | fixtures         | project           | demo@fixtures | demo | will install |         | project |
    Then the project scope has no installed plugins
    Then the session offers no skills

  Scenario: A config whose autoapply is not a boolean is reported as invalid and keeps a new session read-only
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
    Given a config in scope project and layer local, with this text:
      """
      { "autoapply": "yes" }
      """
    When the user starts a new pi session
    Then the session reports these results:
      | kind    | severity | needs reload | summary                      | tally label       | tally failures | tally warnings |
      | cascade | error    | false        | Some operations have failed. | Reconcile pending | 2              | 0              |
      | cascade | error    | false        | Some operations have failed. | Reconcile pending | 2              | 0              |
    Then the results list these marketplaces and plugins:
      | marketplace name          | marketplace scope | marketplace status | marketplace reasons | id                                                  | name                      | status | reasons          | scope   | cause chain                                           | cause truncated | leaks | rollback partial |
      | claude-plugins.local.json | project           | failed             | invalid manifest    | claude-plugins.local.json@claude-plugins.local.json | claude-plugins.local.json | failed | invalid manifest | project | schema validation failed: /autoapply: must be boolean | false           |       |                  |
      | claude-plugins.local.json | project           | failed             | invalid manifest    | claude-plugins.local.json@claude-plugins.local.json | claude-plugins.local.json | failed | invalid manifest | project | schema validation failed: /autoapply: must be boolean | false           |       |                  |
    Then the project scope has no installed plugins
    Then the session offers no skills

  Scenario: A failed install during an autoapply session is reported and stays pending
    Given the git repository "ghp" holds these plugins:
      | name | version | path |
      | ghp  | 1.0.0   |      |
    Given the marketplace "gits" is published as a dir source
    Given the marketplace "gits" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | ghp  | github      | ghp        | false  |
    Given a config in scope project and layer base, with this text:
      """
      { "autoapply": true }
      """
    Given the marketplace "gits" is added to the project scope
    Given a config in scope project and layer base, with these plugins:
      | marketplace | plugin | enabled |
      | gits        | ghp    |         |
    Given the git host answers 404 for the plugin "ghp"
    When the user starts a new pi session
    Then the session reports these results:
      | kind                      | severity | needs reload | summary                        | tally label | tally failures | tally warnings |
      | reconcile-applied-cascade | error    | false        | A plugin operation has failed. | Reconcile   | 1              | 0              |
      | reconcile-applied-cascade | error    | false        | A plugin operation has failed. | Reconcile   | 1              | 0              |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id       | name | status | reasons        | scope   | leaks | rollback partial |
      | gits             | project           | ghp@gits | ghp  | failed | source missing | project |       |                  |
      | gits             | project           | ghp@gits | ghp  | failed | source missing | project |       |                  |
    Then the project scope has no installed plugins
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
      | marketplace name | marketplace scope | id       | name | status       | reasons | scope   |
      | gits             | project           | ghp@gits | ghp  | will install |         | project |

  Scenario: An autoapply session that an invalid GitHub base address stops reports the install it made before stopping
    Given pi runs with the github base address "http://example.invalid"
    Given the git repository "ghp" holds these plugins:
      | name | version | path |
      | ghp  | 1.0.0   |      |
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | ghp  | github      | ghp        | false  |
    Given a config in scope project and layer base, with this text:
      """
      { "autoapply": true }
      """
    Given the marketplace "fixtures" is added to the project scope
    Given a config in scope project and layer base, with these plugins:
      | marketplace | plugin | enabled |
      | fixtures    | demo   |         |
      | fixtures    | ghp    |         |
    When the user starts a new pi session
    Then the session reports these results:
      | kind                      | severity | needs reload | needs apply | cause message                                                     | tally label       | tally failures | tally warnings | tally success count |
      | reconcile-applied-cascade | info     | true         |             |                                                                   | Reconcile         | 0              | 0              | 1                   |
      | reconcile-aborted         | error    | false        |             | PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL must use the https scheme. |                   |                |                |                     |
      | cascade                   | info     | false        | true        |                                                                   | Reconcile pending | 0              | 0              | 1                   |
      | reconcile-aborted         | error    | false        |             | PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL must use the https scheme. |                   |                |                |                     |
      | cascade                   | info     | false        | true        |                                                                   | Reconcile pending | 0              | 0              | 1                   |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status       | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | installed    |         | project | 1.0.0   |
      | fixtures         | project           | ghp@fixtures  | ghp  | will install |         | project |         |
      | fixtures         | project           | ghp@fixtures  | ghp  | will install |         | project |         |
    Then the installation record of the project scope holds these plugins:
      | id            | version | enabled |
      | demo@fixtures | 1.0.0   | true    |

  Scenario: An autoapply session moves an installed plugin to the version a marketplace update brought
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.1.0   |
    Given the user has run "/claude:plugin marketplace update fixtures --scope project"
    Given a config in scope project and layer local, with this text:
      """
      { "autoapply": true }
      """
    When the user starts a new pi session
    Then the session reports these results:
      | kind                      | severity | needs reload | tally label | tally failures | tally warnings | tally success count |
      | reconcile-applied-cascade | info     | true         | Reconcile   | 0              | 0              | 1                   |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status  | reasons | scope   | from  | to    |
      | fixtures         | project           | demo@fixtures | demo | updated |         | project | 1.0.0 | 1.1.0 |
    Then the installation record of the project scope holds these plugins:
      | id            | version | enabled |
      | demo@fixtures | 1.1.0   | true    |
    Then the session offers these skills:
      | command           | description            |
      | /skill:demo-skill | A skill of demo 1.1.0. |

  Scenario: Autoapply with no config that sets it shows the default and every config file
    When the user runs "/claude:plugin autoapply"
    Then the result has these fields:
      | kind         | autoapply-status                                                                                                                                                                                            |
      | severity     | info                                                                                                                                                                                                        |
      | needs reload | false                                                                                                                                                                                                       |
      | enabled      | false                                                                                                                                                                                                       |
      | files        | [{"scope":"user","file":"claude-plugins.json"},{"scope":"user","file":"claude-plugins.local.json"},{"scope":"project","file":"claude-plugins.json"},{"scope":"project","file":"claude-plugins.local.json"}] |

  Scenario Outline: Autoapply shows the value of the most specific config that sets it
    Given a config in scope user and layer base, with this text:
      """
      { "autoapply": true }
      """
    Given a config in scope <scope> and layer <layer>, with this text:
      """
      { "autoapply": <value> }
      """
    When the user runs "/claude:plugin autoapply"
    Then the result has these fields:
      | kind         | autoapply-status |
      | severity     | info             |
      | needs reload | false            |
      | enabled      | <enabled>        |
      | source scope | <scope>          |
      | source file  | <file>           |
      | files        | <files>          |

    Examples:
      | scope   | layer | value | enabled | file                      | files                                                                                                                                                                                                                                  |
      | user    | local | false | false   | claude-plugins.local.json | [{"scope":"user","file":"claude-plugins.json","value":true},{"scope":"user","file":"claude-plugins.local.json","value":false},{"scope":"project","file":"claude-plugins.json"},{"scope":"project","file":"claude-plugins.local.json"}] |
      | project | base  | false | false   | claude-plugins.json       | [{"scope":"user","file":"claude-plugins.json","value":true},{"scope":"user","file":"claude-plugins.local.json"},{"scope":"project","file":"claude-plugins.json","value":false},{"scope":"project","file":"claude-plugins.local.json"}] |
      | project | local | true  | true    | claude-plugins.local.json | [{"scope":"user","file":"claude-plugins.json","value":true},{"scope":"user","file":"claude-plugins.local.json"},{"scope":"project","file":"claude-plugins.json"},{"scope":"project","file":"claude-plugins.local.json","value":true}]  |

  Scenario Outline: Autoapply with a scope or layer filter lists only those config files and still shows the effective value
    Given a config in scope user and layer local, with this text:
      """
      { "autoapply": true }
      """
    Given a config in scope project and layer base, with this text:
      """
      { "autoapply": false }
      """
    When the user runs "/claude:plugin autoapply <filter>"
    Then the result has these fields:
      | kind         | autoapply-status    |
      | severity     | info                |
      | needs reload | false               |
      | enabled      | false               |
      | source scope | project             |
      | source file  | claude-plugins.json |
      | files        | <files>             |

    Examples:
      | filter                  | files                                                                                                                     |
      | --scope user            | [{"scope":"user","file":"claude-plugins.json"},{"scope":"user","file":"claude-plugins.local.json","value":true}]          |
      | --scope project         | [{"scope":"project","file":"claude-plugins.json","value":false},{"scope":"project","file":"claude-plugins.local.json"}]   |
      | --local                 | [{"scope":"user","file":"claude-plugins.local.json","value":true},{"scope":"project","file":"claude-plugins.local.json"}] |
      | --scope project --local | [{"scope":"project","file":"claude-plugins.local.json"}]                                                                  |

  Scenario: Autoapply with an invalid config reports the config as the load does and shows no value
    Given a config in scope project and layer base, with this text:
      """
      { "autoapply": true }
      """
    Given a config in scope user and layer local, with this text:
      """
      { "autoapply": "yes" }
      """
    When the user runs "/claude:plugin autoapply"
    Then the result has these fields:
      | kind           | cascade                      |
      | severity       | error                        |
      | needs reload   | false                        |
      | summary        | Some operations have failed. |
      | tally label    | Reconcile pending            |
      | tally failures | 2                            |
      | tally warnings | 0                            |
    Then the result lists these plugins:
      | marketplace name          | marketplace scope | marketplace status | marketplace reasons | id                                                  | name                      | status | reasons          | scope | cause chain                                           | cause truncated | leaks | rollback partial |
      | claude-plugins.local.json | user              | failed             | invalid manifest    | claude-plugins.local.json@claude-plugins.local.json | claude-plugins.local.json | failed | invalid manifest | user  | schema validation failed: /autoapply: must be boolean | false           |       |                  |

  Scenario: Autoapply on with no scope or layer writes the user base config
    When the user runs "/claude:plugin autoapply on"
    Then the result has these fields:
      | kind         | autoapply-status                                             |
      | severity     | info                                                         |
      | needs reload | false                                                        |
      | enabled      | true                                                         |
      | source scope | user                                                         |
      | source file  | claude-plugins.json                                          |
      | files        | [{"scope":"user","file":"claude-plugins.json","value":true}] |
      | set scope    | user                                                         |
      | set file     | claude-plugins.json                                          |
      | set value    | true                                                         |
    Then the "claude-plugins.json" file of the user scope sets autoapply to on and holds nothing else

  Scenario Outline: Autoapply on or off writes the config of the chosen scope and layer
    When the user runs "/claude:plugin autoapply <setting> <flags>"
    Then the result has these fields:
      | kind         | autoapply-status                                      |
      | severity     | info                                                  |
      | needs reload | false                                                 |
      | enabled      | <value>                                               |
      | source scope | <scope>                                               |
      | source file  | <file>                                                |
      | files        | [{"scope":"<scope>","file":"<file>","value":<value>}] |
      | set scope    | <scope>                                               |
      | set file     | <file>                                                |
      | set value    | <value>                                               |
    Then the "<file>" file of the <scope> scope sets autoapply to <setting> and holds nothing else

    Examples:
      | setting | flags                   | scope   | file                      | value |
      | off     | --local                 | user    | claude-plugins.local.json | false |
      | on      | --scope project         | project | claude-plugins.json       | true  |
      | on      | --scope project --local | project | claude-plugins.local.json | true  |

  Scenario: Autoapply off in the project config turns off the autoapply that a user config turns on
    Given a config in scope user and layer base, with this text:
      """
      { "autoapply": true }
      """
    When the user runs "/claude:plugin autoapply off --scope project"
    Then the result has these fields:
      | kind         | autoapply-status                                                 |
      | severity     | info                                                             |
      | needs reload | false                                                            |
      | enabled      | false                                                            |
      | source scope | project                                                          |
      | source file  | claude-plugins.json                                              |
      | files        | [{"scope":"project","file":"claude-plugins.json","value":false}] |
      | set scope    | project                                                          |
      | set file     | claude-plugins.json                                              |
      | set value    | false                                                            |

  Scenario: Autoapply on in a config that a more specific config overrides shows the value still in effect
    Given a config in scope project and layer base, with this text:
      """
      { "autoapply": false }
      """
    When the user runs "/claude:plugin autoapply on"
    Then the result has these fields:
      | kind         | autoapply-status                                             |
      | severity     | info                                                         |
      | needs reload | false                                                        |
      | enabled      | false                                                        |
      | source scope | project                                                      |
      | source file  | claude-plugins.json                                          |
      | files        | [{"scope":"user","file":"claude-plugins.json","value":true}] |
      | set scope    | user                                                         |
      | set file     | claude-plugins.json                                          |
      | set value    | true                                                         |

  Scenario: Autoapply on keeps the plugins the config it writes declares
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    When the user runs "/claude:plugin autoapply on --scope project"
    Then the result has these fields:
      | kind         | autoapply-status                                                |
      | severity     | info                                                            |
      | needs reload | false                                                           |
      | enabled      | true                                                            |
      | source scope | project                                                         |
      | source file  | claude-plugins.json                                             |
      | files        | [{"scope":"project","file":"claude-plugins.json","value":true}] |
      | set scope    | project                                                         |
      | set file     | claude-plugins.json                                             |
      | set value    | true                                                            |
    Then the "claude-plugins.json" file of the project scope declares these plugins:
      | id            |
      | demo@fixtures |

  Scenario: Autoapply refuses to write a config that is not valid and reports it as the load does
    Given a config in scope user and layer base, with this text:
      """
      { "autoapply": 1 }
      """
    When the user runs "/claude:plugin autoapply on"
    Then the result has these fields:
      | kind           | cascade                      |
      | severity       | error                        |
      | needs reload   | false                        |
      | summary        | Some operations have failed. |
      | tally label    | Reconcile pending            |
      | tally failures | 2                            |
      | tally warnings | 0                            |
    Then the result lists these plugins:
      | marketplace name    | marketplace scope | marketplace status | marketplace reasons | id                                      | name                | status | reasons          | scope | cause chain                                           | cause truncated | leaks | rollback partial |
      | claude-plugins.json | user              | failed             | invalid manifest    | claude-plugins.json@claude-plugins.json | claude-plugins.json | failed | invalid manifest | user  | schema validation failed: /autoapply: must be boolean | false           |       |                  |
    Then the "claude-plugins.json" file of the user scope holds this text:
      """
      { "autoapply": 1 }
      """

  Scenario Outline: Autoapply rejects an argument other than on or off
    When the user runs "/claude:plugin autoapply <arguments>"
    Then the result has these fields:
      | kind         | usage-error                                                                 |
      | severity     | error                                                                       |
      | needs reload | false                                                                       |
      | message      | <message>                                                                   |
      | usage        | Usage: /claude:plugin autoapply [on\|off] [--scope user\|project] [--local] |

    Examples:
      | arguments | message                  |
      | true      | Unknown argument "true". |
      | on off    | Too many arguments.      |
      | --bogus   | Unknown flag: "--bogus". |

  Scenario: Autoapply on writes nothing while another config is invalid and reports that config as the load does
    Given a config in scope project and layer local, with this text:
      """
      { "autoapply": "yes" }
      """
    When the user runs "/claude:plugin autoapply on --scope project"
    Then the result has these fields:
      | kind           | cascade                      |
      | severity       | error                        |
      | needs reload   | false                        |
      | summary        | Some operations have failed. |
      | tally label    | Reconcile pending            |
      | tally failures | 2                            |
      | tally warnings | 0                            |
    Then the result lists these plugins:
      | marketplace name          | marketplace scope | marketplace status | marketplace reasons | id                                                  | name                      | status | reasons          | scope   | cause chain                                           | cause truncated | leaks | rollback partial |
      | claude-plugins.local.json | project           | failed             | invalid manifest    | claude-plugins.local.json@claude-plugins.local.json | claude-plugins.local.json | failed | invalid manifest | project | schema validation failed: /autoapply: must be boolean | false           |       |                  |
    Then the "claude-plugins.json" file of the project scope does not exist

  Scenario: Autoapply on changes the setting and installs nothing until the next load
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" is added to the project scope
    Given a config in scope project and layer base, with these plugins:
      | marketplace | plugin | enabled |
      | fixtures    | demo   |         |
    When the user runs "/claude:plugin autoapply on --scope project"
    Then the result has these fields:
      | kind         | autoapply-status                                                |
      | severity     | info                                                            |
      | needs reload | false                                                           |
      | enabled      | true                                                            |
      | source scope | project                                                         |
      | source file  | claude-plugins.json                                             |
      | files        | [{"scope":"project","file":"claude-plugins.json","value":true}] |
      | set scope    | project                                                         |
      | set file     | claude-plugins.json                                             |
      | set value    | true                                                            |
    Then the project scope has no installed plugins
    When the user starts a new pi session
    Then the session reports these results:
      | kind                      | severity | needs reload | tally label | tally failures | tally warnings | tally success count |
      | reconcile-applied-cascade | info     | true         | Reconcile   | 0              | 0              | 1                   |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | installed |         | project | 1.0.0   |
