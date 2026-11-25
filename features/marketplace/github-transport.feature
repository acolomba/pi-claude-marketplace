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
      | name  | scope | status | clone note | clone url                     |
      | tools | user  | added  | via-ssh    | git@github.com:acme/tools.git |
    Then the user's ssh receives these launches:
      | argv                                                                                                                 |
      | -T -o BatchMode=yes -o ConnectTimeout=2 -o StrictHostKeyChecking=yes git@github.com                                  |
      | -o BatchMode=yes -o StrictHostKeyChecking=yes -o SendEnv=GIT_PROTOCOL git@github.com git-upload-pack 'acme/tools.git' |
    Then the git host receives no request

  Scenario Outline: Adding a github marketplace when ssh is not configured clones it over https
    Given the marketplace "tools" is published as a github source
    Given the user's ssh <ssh state> for "github.com"
    Given pi runs with github's requests routed to the git host
    When the user runs "/claude:plugin marketplace add acme/tools --scope user"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope | status | clone note         | clone url                         |
      | tools | user  | added  | ssh-not-configured | https://github.com/acme/tools.git |
    Then the user's ssh receives these launches:
      | argv                                                                                |
      | -T -o BatchMode=yes -o ConnectTimeout=2 -o StrictHostKeyChecking=yes git@github.com |
    Then the git host receives these requests:
      | method | path                                              | status |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/tools.git/git-upload-pack                   | 200    |
      | POST   | /acme/tools.git/git-upload-pack                   | 200    |

    Examples:
      | ssh state                  |
      | is denied                  |
      | does not know the host key |
      | never answers              |

  Scenario: Adding a github marketplace whose ssh clone fails retries over https
    Given the marketplace "tools" is published as a github source
    Given the user's ssh authenticates to "github.com" as "acme" without access to its repositories
    Given pi runs with github's requests routed to the git host
    When the user runs "/claude:plugin marketplace add acme/tools --scope user"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope | status | clone note | clone url                     | clone retries                     |
      | tools | user  | added  | via-ssh    | git@github.com:acme/tools.git | https://github.com/acme/tools.git |
    Then the user's ssh receives these launches:
      | argv                                                                                                                 |
      | -T -o BatchMode=yes -o ConnectTimeout=2 -o StrictHostKeyChecking=yes git@github.com                                  |
      | -o BatchMode=yes -o StrictHostKeyChecking=yes -o SendEnv=GIT_PROTOCOL git@github.com git-upload-pack 'acme/tools.git' |
    Then the git host receives these requests:
      | method | path                                              | status |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/tools.git/git-upload-pack                   | 200    |
      | POST   | /acme/tools.git/git-upload-pack                   | 200    |

  Scenario: With CLAUDE_CODE_PLUGIN_PREFER_HTTPS set, adding a github marketplace clones it over https and runs no probe
    Given the marketplace "tools" is published as a github source
    Given the user's ssh authenticates to "github.com" as "acme"
    Given pi runs with github's requests routed to the git host and the environment variable "CLAUDE_CODE_PLUGIN_PREFER_HTTPS" set to "1"
    When the user runs "/claude:plugin marketplace add acme/tools --scope user"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope | status | clone note | clone url                         |
      | tools | user  | added  | via-https  | https://github.com/acme/tools.git |
    Then the user's ssh receives no launch
    Then the git host receives these requests:
      | method | path                                              | status |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/tools.git/git-upload-pack                   | 200    |
      | POST   | /acme/tools.git/git-upload-pack                   | 200    |

  Scenario: CLAUDE_CODE_REMOTE does not change how a github marketplace is cloned
    Given the marketplace "tools" is published as a github source
    Given the user's ssh authenticates to "github.com" as "acme"
    Given pi runs with github's requests routed to the git host and the environment variable "CLAUDE_CODE_REMOTE" set to "1"
    When the user runs "/claude:plugin marketplace add acme/tools --scope user"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope | status | clone note | clone url                     |
      | tools | user  | added  | via-ssh    | git@github.com:acme/tools.git |
    Then the user's ssh receives these launches:
      | argv                                                                                                                 |
      | -T -o BatchMode=yes -o ConnectTimeout=2 -o StrictHostKeyChecking=yes git@github.com                                  |
      | -o BatchMode=yes -o StrictHostKeyChecking=yes -o SendEnv=GIT_PROTOCOL git@github.com git-upload-pack 'acme/tools.git' |
    Then the git host receives no request

  Scenario: Adding a github marketplace whose https clone fails retries over ssh
    Given the marketplace "tools" is published as a github source
    Given the git host answers 404 for the marketplace "tools"
    Given the user's ssh never answers for "github.com"
    Given pi runs with github's requests routed to the git host
    When the user runs "/claude:plugin marketplace add acme/tools --scope user"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope | status | clone note         | clone url                         | clone retries                 |
      | tools | user  | added  | ssh-not-configured | https://github.com/acme/tools.git | git@github.com:acme/tools.git |
    Then the git host receives these requests:
      | method | path                                              | status |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 404    |
    Then the user's ssh receives these launches:
      | argv                                                                                                                 |
      | -T -o BatchMode=yes -o ConnectTimeout=2 -o StrictHostKeyChecking=yes git@github.com                                  |
      | -o BatchMode=yes -o StrictHostKeyChecking=yes -o SendEnv=GIT_PROTOCOL git@github.com git-upload-pack 'acme/tools.git' |

  Scenario: Adding a github marketplace that fails over both transports reports both attempts
    Given the marketplace "tools" is published as a github source
    Given the git host answers 404 for the marketplace "tools"
    Given the user's ssh is denied for "github.com"
    Given pi runs with github's requests routed to the git host
    When the user runs "/claude:plugin marketplace add acme/tools --scope user"
    Then the result has these fields:
      | kind         | cascade                      |
      | severity     | error                        |
      | needs reload | false                        |
      | summary      | Some operations have failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace status | id         | name       | status | reasons                 | scope | leaks | rollback partial | cause chain                                                                                                                                                                                                                                                                         | cause truncated | marketplace clone note | marketplace clone url             | marketplace clone retries     |
      | acme/tools       | user              | failed             | acme/tools | acme/tools | failed | authentication required | user  |       |                  | Fetching the marketplace from GitHub failed on both attempts. HTTPS (https://github.com/acme/tools.git): git clone --depth failed: repository-not-found, exit code 128\n\nSSH (git@github.com:acme/tools.git): git clone --depth failed: ssh-auth, exit code 128, git clone --depth failed: ssh-auth, exit code 128 | false           | ssh-not-configured     | https://github.com/acme/tools.git | git@github.com:acme/tools.git |
    Then the git host receives these requests:
      | method | path                                              | status |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 404    |
    Then the user's ssh receives these launches:
      | argv                                                                                                                 |
      | -T -o BatchMode=yes -o ConnectTimeout=2 -o StrictHostKeyChecking=yes git@github.com                                  |
      | -o BatchMode=yes -o StrictHostKeyChecking=yes -o SendEnv=GIT_PROTOCOL git@github.com git-upload-pack 'acme/tools.git' |
    Then the "claude-plugins.json" file of the user scope does not exist
    Then the user scope holds no marketplace record
    Then the user scope holds no marketplace checkout
    Then the user scope holds no git clones
