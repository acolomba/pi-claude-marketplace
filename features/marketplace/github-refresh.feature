Feature: Marketplace github refresh

  Updating a GitHub marketplace lists and clones the source it was declared with, in the order the marketplace probe picks: ssh first only when the user's ssh authenticates to github.com (SG-SSH-02, SG-SSH-06).
  An ssh stand-in first on Pi's path answers the probe and serves the git host's repositories over ssh, and a CONNECT proxy tunnels git's github.com connections to the git host.
  A refresh that re-clones names the clone's transport and its retries on the marketplace's result; a current refresh clones nothing and names no clone (D-SG-22).

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
      | marketplace name | marketplace scope | marketplace status | marketplace clone note | marketplace clone url         |
      | tools            | user              | updated            | via-ssh                | git@github.com:acme/tools.git |
    Then the user's ssh receives these launches:
      | argv                                                                                                                 |
      | -T -o BatchMode=yes -o ConnectTimeout=2 -o StrictHostKeyChecking=yes git@github.com                                  |
      | -o BatchMode=yes -o StrictHostKeyChecking=yes -o SendEnv=GIT_PROTOCOL git@github.com git-upload-pack 'acme/tools.git' |
      | -T -o BatchMode=yes -o ConnectTimeout=2 -o StrictHostKeyChecking=yes git@github.com                                  |
      | -o BatchMode=yes -o StrictHostKeyChecking=yes -o SendEnv=GIT_PROTOCOL git@github.com git-upload-pack 'acme/tools.git' |
    Then the git host receives no request

  Scenario: A github marketplace refresh whose ssh check finds no repository retries over https
    Given the marketplace "tools" is published as a github source
    Given the user's ssh authenticates to "github.com" as "acme" without access to its repositories
    Given pi runs with github's requests routed to the git host
    Given the user has run "/claude:plugin marketplace add acme/tools --scope user"
    Given the marketplace "tools" has the description "Tools after the update"
    When the user runs "/claude:plugin marketplace update tools --scope user"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | marketplace status | marketplace clone note | marketplace clone url         | marketplace clone retries         |
      | tools            | user              | updated            | via-ssh                | git@github.com:acme/tools.git | https://github.com/acme/tools.git |
    Then the user's ssh receives these launches:
      | argv                                                                                                                 |
      | -T -o BatchMode=yes -o ConnectTimeout=2 -o StrictHostKeyChecking=yes git@github.com                                  |
      | -o BatchMode=yes -o StrictHostKeyChecking=yes -o SendEnv=GIT_PROTOCOL git@github.com git-upload-pack 'acme/tools.git' |
      | -T -o BatchMode=yes -o ConnectTimeout=2 -o StrictHostKeyChecking=yes git@github.com                                  |
      | -o BatchMode=yes -o StrictHostKeyChecking=yes -o SendEnv=GIT_PROTOCOL git@github.com git-upload-pack 'acme/tools.git' |
    Then the git host receives these requests:
      | method | path                                              | status |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/tools.git/git-upload-pack                   | 200    |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/tools.git/git-upload-pack                   | 200    |
      | POST   | /acme/tools.git/git-upload-pack                   | 200    |

  Scenario: A github marketplace refresh that fails over both transports reports both attempts
    Given the marketplace "tools" is published as a github source
    Given the user's ssh is denied for "github.com"
    Given pi runs with github's requests routed to the git host
    Given the user has run "/claude:plugin marketplace add acme/tools --scope user"
    Given the git host answers 404 for the marketplace "tools"
    When the user runs "/claude:plugin marketplace update tools --scope user"
    Then the result has these fields:
      | kind         | cascade                      |
      | severity     | error                        |
      | needs reload | false                        |
      | summary      | Some operations have failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace status | id    | name  | status | reasons                 | scope | leaks | rollback partial | cause chain                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | cause truncated | marketplace clone note | marketplace clone url             | marketplace clone retries     |
      | tools            | user              | failed             | tools | tools | failed | authentication required | user  |       |                  | Failed to update marketplace "tools"., Fetching the marketplace from GitHub failed on both attempts. HTTPS (https://github.com/acme/tools.git): git clone --depth failed: repository-not-found, exit code 128\n\nSSH (git@github.com:acme/tools.git): git clone --depth failed: ssh-auth, exit code 128, no credential was obtained for github.com; store one with: printf 'protocol=https\\nhost=github.com\\nusername=<user>\\npassword=<token>\\n\\n' \| git credential approve, git clone --depth failed: ssh-auth, exit code 128 | false           | ssh-not-configured     | https://github.com/acme/tools.git | git@github.com:acme/tools.git |
    Then the git host receives these requests:
      | method | path                                              | status |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 404    |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 404    |

  Scenario: A github marketplace added over https refreshes over ssh once the user's ssh authenticates
    Given the marketplace "tools" is published as a github source
    Given pi runs with github's requests routed to the git host
    Given the user has run "/claude:plugin marketplace add acme/tools --scope user"
    Given the user's ssh authenticates to "github.com" as "acme"
    Given the marketplace "tools" has the description "Tools after the update"
    When the user runs "/claude:plugin marketplace update tools --scope user"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | marketplace status | marketplace clone note | marketplace clone url         |
      | tools            | user              | updated            | via-ssh                | git@github.com:acme/tools.git |
    Then the user's ssh receives these launches:
      | argv                                                                                                                 |
      | -T -o BatchMode=yes -o ConnectTimeout=2 -o StrictHostKeyChecking=yes git@github.com                                  |
      | -o BatchMode=yes -o StrictHostKeyChecking=yes -o SendEnv=GIT_PROTOCOL git@github.com git-upload-pack 'acme/tools.git' |
      | -T -o BatchMode=yes -o ConnectTimeout=2 -o StrictHostKeyChecking=yes git@github.com                                  |
      | -o BatchMode=yes -o StrictHostKeyChecking=yes -o SendEnv=GIT_PROTOCOL git@github.com git-upload-pack 'acme/tools.git' |
    Then the git host receives no request

  Scenario: With CLAUDE_CODE_PLUGIN_PREFER_HTTPS set, a github marketplace refreshes over https with no probe
    Given the marketplace "tools" is published as a github source
    Given the user's ssh authenticates to "github.com" as "acme"
    Given pi runs with github's requests routed to the git host and the environment variable "CLAUDE_CODE_PLUGIN_PREFER_HTTPS" set to "1"
    Given the user has run "/claude:plugin marketplace add acme/tools --scope user"
    Given the marketplace "tools" has the description "Tools after the update"
    When the user runs "/claude:plugin marketplace update tools --scope user"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | marketplace status | marketplace clone note | marketplace clone url             |
      | tools            | user              | updated            | via-https              | https://github.com/acme/tools.git |
    Then the user's ssh receives no launch
    Then the git host receives these requests:
      | method | path                                              | status |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/tools.git/git-upload-pack                   | 200    |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/tools.git/git-upload-pack                   | 200    |
      | POST   | /acme/tools.git/git-upload-pack                   | 200    |

  Scenario: A current github marketplace refresh clones nothing
    Given the marketplace "tools" is published as a github source
    Given the user's ssh authenticates to "github.com" as "acme"
    Given pi runs with github's requests routed to the git host
    Given the user has run "/claude:plugin marketplace add acme/tools --scope user"
    When the user runs "/claude:plugin marketplace update tools --scope user"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | marketplace status | marketplace reasons |
      | tools            | user              | skipped            | up-to-date          |
    Then the user's ssh receives these launches:
      | argv                                                                                                                 |
      | -T -o BatchMode=yes -o ConnectTimeout=2 -o StrictHostKeyChecking=yes git@github.com                                  |
      | -o BatchMode=yes -o StrictHostKeyChecking=yes -o SendEnv=GIT_PROTOCOL git@github.com git-upload-pack 'acme/tools.git' |
    Then the git host receives no request
