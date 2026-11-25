Feature: Marketplace github transport

  Adding a GitHub marketplace by owner/repo picks ssh or https the way Claude Code does: ssh first only when the user's ssh authenticates to github.com (SG-SSH-02).
  An ssh stand-in first on Pi's path answers the probe and serves the git host's repositories over ssh, and a CONNECT proxy tunnels git's github.com connections to the git host.

  Scenario: Adding a github marketplace when the user's ssh authenticates to github.com clones it over ssh
    Given the marketplace "tools" is published as a github source
    Given the user's ssh authenticates to "github.com" as "acme"
    Given pi runs with github's requests routed to the git host
    When the user runs "/claude:plugin marketplace add acme/tools --scope user"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope | status |
      | tools | user  | added  |
    Then the user's ssh receives these launches:
      | argv                                                                                                                 |
      | -T -o BatchMode=yes -o ConnectTimeout=2 -o StrictHostKeyChecking=yes git@github.com                                  |
      | -o BatchMode=yes -o StrictHostKeyChecking=yes -o SendEnv=GIT_PROTOCOL git@github.com git-upload-pack 'acme/tools.git' |
    Then the git host receives no request
