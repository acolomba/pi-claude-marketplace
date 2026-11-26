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
