Feature: Marketplace device flow

  A user with no stored GitHub credential signs in through GitHub's Device Flow when a command
  clones a private GitHub repository. Claude Code runs no Device Flow, and this extension runs git
  with its prompts turned off, so the sign-in is the project's own contract (AUTH-01, D-79-04,
  D-79-05, GHB-02, D-BG-1101). When a git command finds no credential for a host with a registered
  Device Flow, the extension runs the sign-in once and then runs the command again (D-SG-14).
  A loopback stand-in answers GitHub's sign-in endpoints, the run's git host serves GitHub's
  repositories, an in-process redirect sends Pi's github.com requests to them, and a proxy tunnels
  git's github.com connections to the git host. Both refuse every other host.
  A user who needs Device Flow has no SSH key on GitHub, so the user's ssh is denied for github.com:
  the ssh probe says ssh is not configured, the add clones over https first, and the sign-in runs
  inside that attempt. A sign-in that fails then retries over ssh, which GitHub refuses too.

  Background:
    Given the user's ssh is denied for "github.com"

  Scenario: Adding a private GitHub marketplace signs in through Device Flow and clones it
    Given the marketplace "tools" is published as a github source
    Given the git host requires the user "x-access-token" with the password "stand-in-access-token" for the marketplace "tools"
    Given github's sign-in answers its polls with these outcomes:
      | outcome               |
      | authorization_pending |
      | authorized            |
    Given the user's git keeps credentials in its credential store
    Given pi runs with github's requests routed to the stand-ins
    When the user runs "/claude:plugin marketplace add acme/tools --scope user"
    Then the command reports these results:
      | kind               | severity | needs reload | verification uri                | user code |
      | device-flow-prompt | info     | false        | https://github.com/login/device | WDJB-MJHT |
      | cascade            | info     | false        |                                 |           |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | marketplace status | marketplace clone note | marketplace clone url             |
      | tools            | user              | added              | ssh-not-configured     | https://github.com/acme/tools.git |
    Then no result of the command contains "stand-in-access-token"
    Then the git host receives these requests:
      | method | path                                              | status |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 401    |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 401    |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/tools.git/git-upload-pack                   | 200    |
      | POST   | /acme/tools.git/git-upload-pack                   | 200    |
    Then github's sign-in receives these requests:
      | method | path                      | form                                                                                                                      |
      | POST   | /login/device/code        | client_id=Ov23liNcyK08uGdU0mMl, scope=repo                                                                                |
      | POST   | /login/oauth/access_token | client_id=Ov23liNcyK08uGdU0mMl, device_code=stand-in-device-code, grant_type=urn:ietf:params:oauth:grant-type:device_code |
      | POST   | /login/oauth/access_token | client_id=Ov23liNcyK08uGdU0mMl, device_code=stand-in-device-code, grant_type=urn:ietf:params:oauth:grant-type:device_code |
    Then pi routes these github requests:
      | method  | url                                         | routed to |
      | CONNECT | github.com:443                              | git host  |
      | POST    | https://github.com/login/device/code        | sign-in   |
      | POST    | https://github.com/login/oauth/access_token | sign-in   |
      | POST    | https://github.com/login/oauth/access_token | sign-in   |
      | CONNECT | github.com:443                              | git host  |
    Then the user's git credential store holds these credentials:
      | protocol | host       | user           | password              |
      | https    | github.com | x-access-token | stand-in-access-token |

  Scenario: Updating a marketplace after a Device Flow sign-in uses the stored token without signing in again
    Given the marketplace "tools" is published as a github source
    Given the git host requires the user "x-access-token" with the password "stand-in-access-token" for the marketplace "tools"
    Given github's sign-in answers its polls with these outcomes:
      | outcome               |
      | authorization_pending |
      | authorized            |
    Given the user's git keeps credentials in its credential store
    Given pi runs with github's requests routed to the stand-ins
    Given the user has run "/claude:plugin marketplace add acme/tools --scope user"
    When the user runs "/claude:plugin marketplace update tools --scope user"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope | status  | reasons    |
      | tools | user  | skipped | up-to-date |
    Then the git host receives these requests:
      | method | path                                              | status |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 401    |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/tools.git/git-upload-pack                   | 200    |
    Then github's sign-in receives no request
    Then pi routes these github requests:
      | method  | url            | routed to |
      | CONNECT | github.com:443 | git host  |

  Scenario Outline: A sign-in that GitHub answers with <outcome> fails as authentication required and leaves nothing behind
    Given the marketplace "tools" is published as a github source
    Given the git host requires the user "x-access-token" with the password "stand-in-access-token" for the marketplace "tools"
    Given github's sign-in answers its polls with these outcomes:
      | outcome               |
      | authorization_pending |
      | <outcome>             |
    Given the user's git keeps credentials in its credential store
    Given pi runs with github's requests routed to the stand-ins
    When the user runs "/claude:plugin marketplace add acme/tools --scope user"
    Then the command reports these results:
      | kind               | severity | needs reload | verification uri                | user code | summary                      |
      | device-flow-prompt | info     | false        | https://github.com/login/device | WDJB-MJHT |                              |
      | cascade            | error    | false        |                                 |           | Some operations have failed. |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | marketplace status | id         | name       | status | reasons                 | scope | leaks | rollback partial | cause chain                                                                                                                                                                                                                                                                                               | cause truncated | marketplace clone note | marketplace clone url             | marketplace clone retries     |
      | acme/tools       | user              | failed             | acme/tools | acme/tools | failed | authentication required | user  |       |                  | Fetching the marketplace from GitHub failed on both attempts. HTTPS (https://github.com/acme/tools.git): git clone --depth failed: https-auth, exit code 128\n\nSSH (git@github.com:acme/tools.git): git clone --depth failed: ssh-auth, exit code 128, git clone --depth failed: ssh-auth, exit code 128 | false           | ssh-not-configured     | https://github.com/acme/tools.git | git@github.com:acme/tools.git |
    Then the git host receives these requests:
      | method | path                                              | status |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 401    |
    Then the user's ssh receives these launches:
      | argv                                                                                                                 |
      | -T -o BatchMode=yes -o ConnectTimeout=2 -o StrictHostKeyChecking=yes git@github.com                                  |
      | -o BatchMode=yes -o StrictHostKeyChecking=yes -o SendEnv=GIT_PROTOCOL git@github.com git-upload-pack 'acme/tools.git' |
    Then github's sign-in receives these requests:
      | method | path                      | form                                                                                                                      |
      | POST   | /login/device/code        | client_id=Ov23liNcyK08uGdU0mMl, scope=repo                                                                                |
      | POST   | /login/oauth/access_token | client_id=Ov23liNcyK08uGdU0mMl, device_code=stand-in-device-code, grant_type=urn:ietf:params:oauth:grant-type:device_code |
      | POST   | /login/oauth/access_token | client_id=Ov23liNcyK08uGdU0mMl, device_code=stand-in-device-code, grant_type=urn:ietf:params:oauth:grant-type:device_code |
    Then pi routes these github requests:
      | method  | url                                         | routed to |
      | CONNECT | github.com:443                              | git host  |
      | POST    | https://github.com/login/device/code        | sign-in   |
      | POST    | https://github.com/login/oauth/access_token | sign-in   |
      | POST    | https://github.com/login/oauth/access_token | sign-in   |
    Then the "claude-plugins.json" file of the user scope does not exist
    Then the user scope holds no marketplace record
    Then the user scope holds no marketplace checkout
    Then the user scope holds no git clones
    Then the user's git credential store holds no credentials

    Examples:
      | outcome       |
      | access_denied |
      | expired_token |

  Scenario: Installing a plugin from a private GitHub source with no cached clone signs in through Device Flow
    Given the git repository "ghp" holds these plugins:
      | name | version | path |
      | ghp  | 1.0.0   |      |
    Given the marketplace "gits" is published as a dir source
    Given the marketplace "gits" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | ghp  | github      | ghp        | false  |
    Given the git host requires the user "x-access-token" with the password "stand-in-access-token" for the plugin "ghp"
    Given github's sign-in answers its polls with these outcomes:
      | outcome               |
      | authorization_pending |
      | authorized            |
    Given pi runs with github's requests routed to the stand-ins
    Given the marketplace "gits" is added to the project scope
    When the user runs "/claude:plugin install ghp@gits --scope project"
    Then the command reports these results:
      | kind               | severity | needs reload | verification uri                | user code |
      | device-flow-prompt | info     | false        | https://github.com/login/device | WDJB-MJHT |
      | cascade            | info     | true         |                                 |           |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id       | name | status    | reasons | scope   | version |
      | gits             | project           | ghp@gits | ghp  | installed |         | project | 1.0.0   |
    Then the git host receives these requests:
      | method | path                                            | status |
      | GET    | /acme/ghp.git/info/refs?service=git-upload-pack | 401    |
      | GET    | /acme/ghp.git/info/refs?service=git-upload-pack | 401    |
      | GET    | /acme/ghp.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/ghp.git/git-upload-pack                   | 200    |
      | POST   | /acme/ghp.git/git-upload-pack                   | 200    |
    Then github's sign-in receives these requests:
      | method | path                      | form                                                                                                                      |
      | POST   | /login/device/code        | client_id=Ov23liNcyK08uGdU0mMl, scope=repo                                                                                |
      | POST   | /login/oauth/access_token | client_id=Ov23liNcyK08uGdU0mMl, device_code=stand-in-device-code, grant_type=urn:ietf:params:oauth:grant-type:device_code |
      | POST   | /login/oauth/access_token | client_id=Ov23liNcyK08uGdU0mMl, device_code=stand-in-device-code, grant_type=urn:ietf:params:oauth:grant-type:device_code |
    Then pi routes these github requests:
      | method  | url                                         | routed to |
      | CONNECT | github.com:443                              | git host  |
      | POST    | https://github.com/login/device/code        | sign-in   |
      | POST    | https://github.com/login/oauth/access_token | sign-in   |
      | POST    | https://github.com/login/oauth/access_token | sign-in   |
      | CONNECT | github.com:443                              | git host  |

  Scenario: Installing a pinned GitHub plugin whose clone is already cached makes no request and does not sign in
    Given the git repository "ghp" holds these plugins:
      | name | version | path |
      | ghp  | 1.0.0   |      |
    Given the marketplace "gits" is published as a dir source
    Given the marketplace "gits" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | ghp  | github      | ghp        | true   |
    Given the git host requires the user "x-access-token" with the password "stand-in-access-token" for the plugin "ghp"
    Given github's sign-in answers its polls with these outcomes:
      | outcome               |
      | authorization_pending |
      | authorized            |
    Given pi runs with github's requests routed to the stand-ins
    Given the marketplace "gits" is added to the project scope
    Given the user has run "/claude:plugin fetch ghp@gits --scope project"
    When the user runs "/claude:plugin install ghp@gits --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id       | name | status    | reasons | scope   | version |
      | gits             | project           | ghp@gits | ghp  | installed |         | project | 1.0.0   |
    Then the git host receives no request
    Then github's sign-in receives no request

  Scenario: A terminal session of a sign-in scenario sends the background update's GitHub requests to the git host
    Given the marketplace "tools" is published as a github source
    Given github's sign-in answers its polls with these outcomes:
      | outcome               |
      | authorization_pending |
    Given pi runs with github's requests routed to the stand-ins
    Given the user has run "/claude:plugin marketplace add acme/tools --scope user"
    Given the user has run "/claude:plugin marketplace autoupdate tools --scope user"
    Given the tui session starts with the environment variable "PI_CLAUDE_MARKETPLACE_AUTOUPDATE_DELAY_MS" set to "0"
    When the user sends the message "hello" in the tui session
    Then the tui session reports no notice
    Then the git host receives these requests:
      | method | path                                              | status |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/tools.git/git-upload-pack                   | 200    |
    Then github's sign-in receives no request
    Then pi routes these github requests:
      | method  | url            | routed to |
      | CONNECT | github.com:443 | git host  |

  Scenario: The background update of a private GitHub marketplace with no stored credential does not sign in
    Given the marketplace "tools" is published as a github source
    Given github's sign-in answers its polls with these outcomes:
      | outcome               |
      | authorization_pending |
    Given pi runs with github's requests routed to the stand-ins
    Given the user has run "/claude:plugin marketplace add acme/tools --scope user"
    Given the user has run "/claude:plugin marketplace autoupdate tools --scope user"
    Given the git host requires the user "x-access-token" with the password "stand-in-access-token" for the marketplace "tools"
    Given the tui session starts with the environment variable "PI_CLAUDE_MARKETPLACE_AUTOUPDATE_DELAY_MS" set to "0"
    When the user sends the message "hello" in the tui session
    Then the tui session reports no notice
    Then the git host receives these requests:
      | method | path                                              | status |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 401    |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 401    |
    Then github's sign-in receives no request
    Then pi routes these github requests:
      | method  | url            | routed to |
      | CONNECT | github.com:443 | git host  |
      | CONNECT | github.com:443 | git host  |

  Scenario: The background update of a private GitHub marketplace fetches with the stored GitHub credential
    Given the marketplace "tools" is published as a github source
    Given github's sign-in answers its polls with these outcomes:
      | outcome               |
      | authorization_pending |
    Given pi runs with github's requests routed to the stand-ins
    Given the user has run "/claude:plugin marketplace add acme/tools --scope user"
    Given the user has run "/claude:plugin marketplace autoupdate tools --scope user"
    Given the git host requires the user "x-access-token" with the password "stand-in-access-token" for the marketplace "tools"
    Given the user has stored a credential for github.com with the user "x-access-token" and the password "stand-in-access-token"
    Given the tui session starts with the environment variable "PI_CLAUDE_MARKETPLACE_AUTOUPDATE_DELAY_MS" set to "0"
    When the user sends the message "hello" in the tui session
    Then the tui session reports no notice
    Then the git host receives these requests:
      | method | path                                              | status |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 401    |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/tools.git/git-upload-pack                   | 200    |
    Then github's sign-in receives no request
    Then pi routes these github requests:
      | method  | url            | routed to |
      | CONNECT | github.com:443 | git host  |

  Scenario: Adding a GitHub marketplace whose host rejects the stored credential fails as authentication required and removes the credential (AUTH-07)
    Given the marketplace "tools" is published as a github source
    Given the git host requires the user "x-access-token" with the password "stand-in-access-token" for the marketplace "tools"
    Given github's sign-in answers its polls with these outcomes:
      | outcome               |
      | authorization_pending |
    Given the user has stored a credential for github.com with the user "x-access-token" and the password "expired-token"
    Given pi runs with github's requests routed to the stand-ins
    When the user runs "/claude:plugin marketplace add acme/tools --scope user"
    Then the result has these fields:
      | kind         | cascade                      |
      | severity     | error                        |
      | needs reload | false                        |
      | summary      | Some operations have failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace status | id         | name       | status | reasons                 | scope | leaks | rollback partial | cause chain                                                                                                                                                                                                                                                                                               | cause truncated | marketplace clone note | marketplace clone url             | marketplace clone retries     |
      | acme/tools       | user              | failed             | acme/tools | acme/tools | failed | authentication required | user  |       |                  | Fetching the marketplace from GitHub failed on both attempts. HTTPS (https://github.com/acme/tools.git): git clone --depth failed: https-auth, exit code 128\n\nSSH (git@github.com:acme/tools.git): git clone --depth failed: ssh-auth, exit code 128, git clone --depth failed: ssh-auth, exit code 128 | false           | ssh-not-configured     | https://github.com/acme/tools.git | git@github.com:acme/tools.git |
    Then no result of the command contains "expired-token"
    Then the git host receives these requests:
      | method | path                                              | status |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 401    |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 401    |
    Then the user's ssh receives these launches:
      | argv                                                                                                                 |
      | -T -o BatchMode=yes -o ConnectTimeout=2 -o StrictHostKeyChecking=yes git@github.com                                  |
      | -o BatchMode=yes -o StrictHostKeyChecking=yes -o SendEnv=GIT_PROTOCOL git@github.com git-upload-pack 'acme/tools.git' |
    Then github's sign-in receives no request
    Then pi routes these github requests:
      | method  | url            | routed to |
      | CONNECT | github.com:443 | git host  |
    Then the user's git credential store holds no credentials
    Then the "claude-plugins.json" file of the user scope does not exist
    Then the user scope holds no marketplace record
    Then the user scope holds no marketplace checkout

  Scenario: After the GitHub host rejected the stored credential, the next add signs in through Device Flow again (AUTH-07)
    Given the marketplace "tools" is published as a github source
    Given the git host requires the user "x-access-token" with the password "stand-in-access-token" for the marketplace "tools"
    Given github's sign-in answers its polls with these outcomes:
      | outcome               |
      | authorization_pending |
      | authorized            |
    Given the user has stored a credential for github.com with the user "x-access-token" and the password "expired-token"
    Given pi runs with github's requests routed to the stand-ins
    Given the user has run "/claude:plugin marketplace add acme/tools --scope user", which failed
    When the user runs "/claude:plugin marketplace add acme/tools --scope user"
    Then the command reports these results:
      | kind               | severity | needs reload | verification uri                | user code |
      | device-flow-prompt | info     | false        | https://github.com/login/device | WDJB-MJHT |
      | cascade            | info     | false        |                                 |           |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | marketplace status | marketplace clone note | marketplace clone url             |
      | tools            | user              | added              | ssh-not-configured     | https://github.com/acme/tools.git |
    Then no result of the command contains "expired-token"
    Then no result of the command contains "stand-in-access-token"
    Then the git host receives these requests:
      | method | path                                              | status |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 401    |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 401    |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/tools.git/git-upload-pack                   | 200    |
      | POST   | /acme/tools.git/git-upload-pack                   | 200    |
    Then github's sign-in receives these requests:
      | method | path                      | form                                                                                                                      |
      | POST   | /login/device/code        | client_id=Ov23liNcyK08uGdU0mMl, scope=repo                                                                                |
      | POST   | /login/oauth/access_token | client_id=Ov23liNcyK08uGdU0mMl, device_code=stand-in-device-code, grant_type=urn:ietf:params:oauth:grant-type:device_code |
      | POST   | /login/oauth/access_token | client_id=Ov23liNcyK08uGdU0mMl, device_code=stand-in-device-code, grant_type=urn:ietf:params:oauth:grant-type:device_code |
    Then pi routes these github requests:
      | method  | url                                         | routed to |
      | CONNECT | github.com:443                              | git host  |
      | POST    | https://github.com/login/device/code        | sign-in   |
      | POST    | https://github.com/login/oauth/access_token | sign-in   |
      | POST    | https://github.com/login/oauth/access_token | sign-in   |
      | CONNECT | github.com:443                              | git host  |
    Then the user's git credential store holds these credentials:
      | protocol | host       | user           | password              |
      | https    | github.com | x-access-token | stand-in-access-token |

  Scenario: Adding a private GitHub marketplace in pi's print mode refuses with the remedy and leaves the scope as it was (MODE-04)
    Given the marketplace "fixtures" is published as a url source
    Given the marketplace "fixtures" is added to the project scope
    Given the marketplace "tools" is published as a github source
    Given the git host requires the user "x-access-token" with the password "stand-in-access-token" for the marketplace "tools"
    Given github's sign-in answers its polls with these outcomes:
      | outcome               |
      | authorization_pending |
    Given pi runs with github's requests routed to the stand-ins
    Given the files of the project scope are remembered
    When the user runs "/claude:plugin marketplace add acme/tools --scope project" in pi's print mode
    Then pi's print mode exits with code 0 and prints this error:
      """
      Extension error (command:claude:plugin): Device-flow authentication is unavailable in print mode. Retry with --mode json or interactive Pi.
      """
    Then the git host receives these requests:
      | method | path                                              | status |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 401    |
    Then github's sign-in receives no request
    Then pi routes these github requests:
      | method  | url            | routed to |
      | CONNECT | github.com:443 | git host  |
    Then the files of the project scope are unchanged

  Scenario: Applying a config that declares a private GitHub marketplace in pi's print mode adds nothing and leaves no staged clone, and print mode shows nothing, a documented Pi gap (MODE-04, JDOC-02)
    Given the marketplace "tools" is published as a github source
    Given the git host requires the user "x-access-token" with the password "stand-in-access-token" for the marketplace "tools"
    Given github's sign-in answers its polls with these outcomes:
      | outcome               |
      | authorization_pending |
    Given pi runs with github's requests routed to the stand-ins
    Given a config in scope project and layer base, with these marketplaces:
      | name  | source     | autoupdate |
      | tools | acme/tools | false      |
    When the user runs "/claude:plugin apply --scope project" in pi's print mode
    Then pi's print mode exits with code 0 and prints nothing
    Then the git host receives these requests:
      | method | path                                              | status |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 401    |
    Then github's sign-in receives no request
    Then pi routes these github requests:
      | method  | url            | routed to |
      | CONNECT | github.com:443 | git host  |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name  | source     | autoupdate |
      | tools | acme/tools | false      |
    Then the project scope holds no marketplace record
    Then the project scope holds no marketplace checkout
    Then the project scope holds no git clones
