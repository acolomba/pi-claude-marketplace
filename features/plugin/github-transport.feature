Feature: Plugin github transport

  Installing a plugin whose source is a github owner/repo picks ssh or https the way Claude Code's shell install does: https first only when no ssh setting of the user and no probe answer keeps the clone on ssh, and ssh only otherwise (D-SG-18).
  An ssh stand-in first on Pi's path answers the probe and serves the git host's repositories over ssh, and a CONNECT proxy tunnels git's github.com connections to the git host.

  Scenario: Installing a github plugin when the user's ssh authenticates to github.com clones it over ssh only
    Given the git repository "ghp" holds these plugins:
      | name | version | path |
      | ghp  | 1.0.0   |      |
    Given the marketplace "gits" is published as a dir source
    Given the marketplace "gits" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | ghp  | github      | ghp        | false  |
    Given the user's ssh authenticates to "github.com" as "acme"
    Given pi runs with github's requests routed to the git host
    Given the marketplace "gits" is added to the project scope
    When the user runs "/claude:plugin install ghp@gits --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id       | name | status    | reasons | scope   | version |
      | gits             | project           | ghp@gits | ghp  | installed |         | project | 1.0.0   |
    Then the user's ssh receives these launches:
      | argv                                                                                                               |
      | -T -o BatchMode=yes -o ConnectTimeout=2 -o StrictHostKeyChecking=yes git@github.com                                |
      | -o BatchMode=yes -o StrictHostKeyChecking=yes -o SendEnv=GIT_PROTOCOL git@github.com git-upload-pack 'acme/ghp.git' |
    Then the git host receives no request
