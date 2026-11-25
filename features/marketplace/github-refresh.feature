Feature: Marketplace github refresh

  Updating a GitHub marketplace lists and clones the source it was declared with, in the order the marketplace probe picks: ssh first only when the user's ssh authenticates to github.com (SG-SSH-02, SG-SSH-06).
  An ssh stand-in first on Pi's path answers the probe and serves the git host's repositories over ssh, and a CONNECT proxy tunnels git's github.com connections to the git host.

  Scenario: Updating a github marketplace when the user's ssh authenticates refreshes it over ssh
    Given the marketplace "tools" is published as a github source
    Given the user's ssh authenticates to "github.com" as "acme"
    Given pi runs with github's requests routed to the git host
    Given the user has run "/claude:plugin marketplace add acme/tools --scope user"
    Given the marketplace "tools" has the description "Tools after the update"
    When the user runs "/claude:plugin marketplace update tools --scope user"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | marketplace status |
      | tools            | user              | updated            |
    Then the user's ssh receives these launches:
      | argv                                                                                                                 |
      | -T -o BatchMode=yes -o ConnectTimeout=2 -o StrictHostKeyChecking=yes git@github.com                                  |
      | -o BatchMode=yes -o StrictHostKeyChecking=yes -o SendEnv=GIT_PROTOCOL git@github.com git-upload-pack 'acme/tools.git' |
      | -T -o BatchMode=yes -o ConnectTimeout=2 -o StrictHostKeyChecking=yes git@github.com                                  |
      | -o BatchMode=yes -o StrictHostKeyChecking=yes -o SendEnv=GIT_PROTOCOL git@github.com git-upload-pack 'acme/tools.git' |
    Then the git host receives no request
