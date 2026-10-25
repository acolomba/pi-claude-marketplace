Feature: Plugin autoapply

  A config that turns autoapply on makes a new session apply the configs and
  marketplaces itself, so a checked-out project needs no apply command. The
  scenarios run the real extension in a headless Pi with local marketplaces
  and a loopback https git host.

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
      | method | path                                       | status |
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

  Scenario: A config whose autoapply is not a boolean is reported as invalid and changes nothing
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
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
