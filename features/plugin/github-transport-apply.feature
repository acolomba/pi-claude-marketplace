Feature: Plugin github transport apply

  Applying a config, or importing a Claude Code config, that declares plugins whose source is a github owner/repo picks ssh or https the way installing them does, with one probe for the whole run, and the run's enables and catalog moves follow the same choice (D-SG-18, D-SG-19).
  An ssh stand-in first on Pi's path answers the probe and serves the git host's repositories over ssh, and a CONNECT proxy tunnels git's github.com connections to the git host.
  Each row names the transport of the clone its plugin ran (D-SG-22).

  Background:
    Given the git repository "ghp" holds these plugins:
      | name | version | path |
      | ghp  | 1.0.0   |      |
    Given the git repository "ghq" holds these plugins:
      | name | version | path |
      | ghq  | 1.0.0   |      |
    Given the marketplace "gits" is published as a dir source
    Given the marketplace "gits" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | ghp  | github      | ghp        | false  |
      | ghq  | github      | ghq        | false  |

  Scenario: Applying a config that declares two github plugins probes once
    Given the user's ssh is denied for "github.com"
    Given pi runs with github's requests routed to the git host
    Given the marketplace "gits" is added to the project scope
    Given a config in scope project and layer base, with these plugins:
      | marketplace | plugin | enabled |
      | gits        | ghp    |         |
      | gits        | ghq    |         |
    When the user runs "/claude:plugin apply --scope project"
    Then the result has these fields:
      | kind                | reconcile-applied-cascade |
      | severity            | info                      |
      | needs reload        | true                      |
      | tally label         | Reconcile                 |
      | tally failures      | 0                         |
      | tally warnings      | 0                         |
      | tally success count | 2                         |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id       | name | status    | reasons | scope   | version | clone note         | clone url                       |
      | gits             | project           | ghp@gits | ghp  | installed |         | project | 1.0.0   | ssh-not-configured | https://github.com/acme/ghp.git |
      | gits             | project           | ghq@gits | ghq  | installed |         | project | 1.0.0   | ssh-not-configured | https://github.com/acme/ghq.git |
    Then the user's ssh receives these launches:
      | argv                                                                                |
      | -T -o BatchMode=yes -o ConnectTimeout=2 -o StrictHostKeyChecking=yes git@github.com |
      | -G git@github.com                                                                   |

  Scenario: Applying a config that moves a github plugin to a newer catalog entry reuses the run's probe
    Given the marketplace "gits" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | ghp  | github      | ghp        | true   |
      | ghq  | github      | ghq        | true   |
    Given the user's ssh is denied for "github.com"
    Given pi runs with github's requests routed to the git host
    Given the marketplace "gits" is added to the project scope
    Given the user has run "/claude:plugin install ghp@gits --scope project"
    Given the user has run "/claude:plugin install ghq@gits --scope project"
    Given the git repository "ghp" holds these plugins:
      | name | version | path |
      | ghp  | 2.0.0   |      |
    Given the git repository "ghq" holds these plugins:
      | name | version | path |
      | ghq  | 2.0.0   |      |
    Given the marketplace "gits" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | ghp  | github      | ghp        | true   |
      | ghq  | github      | ghq        | true   |
    Given the user has run "/claude:plugin marketplace update gits --scope project"
    When the user runs "/claude:plugin apply --scope project"
    Then the result has these fields:
      | kind                | reconcile-applied-cascade |
      | severity            | info                      |
      | needs reload        | true                      |
      | tally label         | Reconcile                 |
      | tally failures      | 0                         |
      | tally warnings      | 0                         |
      | tally success count | 2                         |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id       | name | status  | reasons | scope   | from  | to    | clone note         | clone url                       |
      | gits             | project           | ghp@gits | ghp  | updated |         | project | 1.0.0 | 2.0.0 | ssh-not-configured | https://github.com/acme/ghp.git |
      | gits             | project           | ghq@gits | ghq  | updated |         | project | 1.0.0 | 2.0.0 | ssh-not-configured | https://github.com/acme/ghq.git |
    Then the user's ssh receives these launches:
      | argv                                                                                |
      | -T -o BatchMode=yes -o ConnectTimeout=2 -o StrictHostKeyChecking=yes git@github.com |
      | -G git@github.com                                                                   |

  Scenario: Applying a config that installs one github plugin and re-enables another whose clone is gone probes once
    Given the user's ssh is denied for "github.com"
    Given pi runs with github's requests routed to the git host
    Given the marketplace "gits" is added to the project scope
    Given the user has run "/claude:plugin install ghp@gits --scope project"
    Given the user has run "/claude:plugin disable ghp@gits --scope project"
    Given the cached clones of git plugins in the project scope are deleted
    Given a config in scope project and layer base, with these plugins:
      | marketplace | plugin | enabled |
      | gits        | ghp    | true    |
      | gits        | ghq    |         |
    When the user runs "/claude:plugin apply --scope project"
    Then the result has these fields:
      | kind                | reconcile-applied-cascade |
      | severity            | info                      |
      | needs reload        | true                      |
      | tally label         | Reconcile                 |
      | tally failures      | 0                         |
      | tally warnings      | 0                         |
      | tally success count | 2                         |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id       | name | status    | reasons | scope   | version | clone note         | clone url                       |
      | gits             | project           | ghq@gits | ghq  | installed |         | project | 1.0.0   | ssh-not-configured | https://github.com/acme/ghq.git |
      | gits             | project           | ghp@gits | ghp  | installed |         | project | 1.0.0   | ssh-not-configured | https://github.com/acme/ghp.git |
    Then the installation record of the project scope holds these plugins:
      | id       | version | enabled |
      | ghp@gits | 1.0.0   | true    |
      | ghq@gits | 1.0.0   | true    |
    Then the user's ssh receives these launches:
      | argv                                                                                |
      | -T -o BatchMode=yes -o ConnectTimeout=2 -o StrictHostKeyChecking=yes git@github.com |
      | -G git@github.com                                                                   |

  Scenario: Importing a Claude Code config with two github plugins probes once
    Given the user's ssh is denied for "github.com"
    Given pi runs with github's requests routed to the git host
    Given the claude code settings file of the user scope holds this text:
      """
      {
        "enabledPlugins": { "ghp@gits": true, "ghq@gits": true },
        "extraKnownMarketplaces": {
          "gits": {
            "source": { "source": "directory", "path": "{home}/marketplaces/gits" }
          }
        }
      }
      """
    When the user runs "/claude:plugin import --scope user"
    Then the result has these fields:
      | kind                | cascade |
      | severity            | info    |
      | needs reload        | true    |
      | tally label         | Import  |
      | tally failures      | 0       |
      | tally warnings      | 0       |
      | tally success count | 3       |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace status | id       | name | version | status    | reasons | scope | clone note         | clone url                       |
      | gits             | user              | added              | ghp@gits | ghp  | 1.0.0   | installed |         | user  | ssh-not-configured | https://github.com/acme/ghp.git |
      | gits             | user              | added              | ghq@gits | ghq  | 1.0.0   | installed |         | user  | ssh-not-configured | https://github.com/acme/ghq.git |
    Then the user's ssh receives these launches:
      | argv                                                                                |
      | -T -o BatchMode=yes -o ConnectTimeout=2 -o StrictHostKeyChecking=yes git@github.com |
      | -G git@github.com                                                                   |
