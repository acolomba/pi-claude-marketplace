Feature: Marketplace credentials

  Git authenticates only with the user's ssh setup and git credential helpers, and the extension
  keeps no token of its own (SG-AUTH-01, SG-AUTH-02, SG-AUTH-03). The scenarios run against the https
  git host, the ssh stand-in, and a profile Pi whose github.com requests go to the git host.

  Scenario: With only GITHUB_TOKEN and GH_TOKEN set, adding a private url marketplace fails as authentication required and no request carries either token
    Given the marketplace "tools" is published as a url source
    Given the git host requires the user "alice" with the password "s3cret" for the marketplace "tools"
    Given pi runs with github's requests routed to the git host and these environment variables:
      | name         | value                  |
      | GITHUB_TOKEN | env-github-token-value |
      | GH_TOKEN     | env-gh-token-value     |
    When the user runs "/claude:plugin marketplace add https://{git host}/acme/tools.git --scope user"
    Then the result has these fields:
      | kind         | cascade                             |
      | severity     | error                               |
      | needs reload | false                               |
      | summary      | A marketplace operation has failed. |
    Then the result lists these marketplaces:
      | name                              | scope | status | reasons                 |
      | https://{git host}/acme/tools.git | user  | failed | authentication required |
    Then no result of the command contains "env-github-token-value"
    Then no result of the command contains "env-gh-token-value"
    Then no request the git host received carries "env-github-token-value"
    Then no request the git host received carries "env-gh-token-value"
    Then the git host receives these requests:
      | method | path                                              | status |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 401    |
    Then pi routes no github request
    Then the user's ssh receives no launch
    Then the user scope holds no marketplace record

  Scenario: Adding a private GitHub marketplace with no stored credential fails as authentication required and shows no device code
    Given the marketplace "tools" is published as a github source
    Given the git host requires the user "x-access-token" with the password "stand-in-access-token" for the marketplace "tools"
    Given the user's ssh is denied for "github.com"
    Given pi runs with github's requests routed to the git host
    When the user runs "/claude:plugin marketplace add acme/tools --scope user"
    Then the command reports these results:
      | kind    | severity | needs reload | summary                      |
      | cascade | error    | false        | Some operations have failed. |
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
    Then pi routes these github requests:
      | method  | url            | routed to |
      | CONNECT | github.com:443 | git host  |
    Then the user scope holds no marketplace record
    Then the user scope holds no marketplace checkout

  Scenario: Adding a private GitHub marketplace in pi's print mode with no stored credential prints nothing and leaves the scope as it was (MODE-04, JDOC-02)
    Given the marketplace "fixtures" is published as a url source
    Given the marketplace "fixtures" is added to the project scope
    Given the marketplace "tools" is published as a github source
    Given the git host requires the user "x-access-token" with the password "stand-in-access-token" for the marketplace "tools"
    Given the user's ssh is denied for "github.com"
    Given pi runs with github's requests routed to the git host
    Given the files of the project scope are remembered
    When the user runs "/claude:plugin marketplace add acme/tools --scope project" in pi's print mode
    Then pi's print mode exits with code 0 and prints nothing
    Then the git host receives these requests:
      | method | path                                              | status |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 401    |
    Then the user's ssh receives these launches:
      | argv                                                                                                                 |
      | -T -o BatchMode=yes -o ConnectTimeout=2 -o StrictHostKeyChecking=yes git@github.com                                  |
      | -o BatchMode=yes -o StrictHostKeyChecking=yes -o SendEnv=GIT_PROTOCOL git@github.com git-upload-pack 'acme/tools.git' |
    Then pi routes these github requests:
      | method  | url            | routed to |
      | CONNECT | github.com:443 | git host  |
    Then the files of the project scope are unchanged

  Scenario: With only GITHUB_TOKEN and GH_TOKEN set, adding a private GitHub marketplace fails as authentication required and no request carries either token
    Given the marketplace "tools" is published as a github source
    Given the git host requires the user "x-access-token" with the password "stand-in-access-token" for the marketplace "tools"
    Given the user's ssh is denied for "github.com"
    Given pi runs with github's requests routed to the git host and these environment variables:
      | name         | value                  |
      | GITHUB_TOKEN | env-github-token-value |
      | GH_TOKEN     | env-gh-token-value     |
    When the user runs "/claude:plugin marketplace add acme/tools --scope user"
    Then the command reports these results:
      | kind    | severity | needs reload | summary                      |
      | cascade | error    | false        | Some operations have failed. |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | marketplace status | id         | name       | status | reasons                 | scope | leaks | rollback partial | cause chain                                                                                                                                                                                                                                                                                               | cause truncated | marketplace clone note | marketplace clone url             | marketplace clone retries     |
      | acme/tools       | user              | failed             | acme/tools | acme/tools | failed | authentication required | user  |       |                  | Fetching the marketplace from GitHub failed on both attempts. HTTPS (https://github.com/acme/tools.git): git clone --depth failed: https-auth, exit code 128\n\nSSH (git@github.com:acme/tools.git): git clone --depth failed: ssh-auth, exit code 128, git clone --depth failed: ssh-auth, exit code 128 | false           | ssh-not-configured     | https://github.com/acme/tools.git | git@github.com:acme/tools.git |
    Then no result of the command contains "env-github-token-value"
    Then no result of the command contains "env-gh-token-value"
    Then no request the git host received carries "env-github-token-value"
    Then no request the git host received carries "env-gh-token-value"
    Then the git host receives these requests:
      | method | path                                              | status |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 401    |
    Then the user's ssh receives these launches:
      | argv                                                                                                                 |
      | -T -o BatchMode=yes -o ConnectTimeout=2 -o StrictHostKeyChecking=yes git@github.com                                  |
      | -o BatchMode=yes -o StrictHostKeyChecking=yes -o SendEnv=GIT_PROTOCOL git@github.com git-upload-pack 'acme/tools.git' |
    Then pi routes these github requests:
      | method  | url            | routed to |
      | CONNECT | github.com:443 | git host  |
    Then the user scope holds no marketplace record

  # The erase is git's own `store` helper reacting to the 401 for a
  # credential it sent, not the extension: the extension runs no
  # `git credential` command for a failure (D-SG-28).
  Scenario: Adding a GitHub marketplace whose host refuses the stored credential fails as authentication required, and git's store helper erases the credential (AUTH-07)
    Given the marketplace "tools" is published as a github source
    Given the git host requires the user "x-access-token" with the password "stand-in-access-token" for the marketplace "tools"
    Given the user's ssh is denied for "github.com"
    Given the user has stored a credential for github.com with the user "x-access-token" and the password "expired-token"
    Given pi runs with github's requests routed to the git host
    When the user runs "/claude:plugin marketplace add acme/tools --scope user"
    Then the result has these fields:
      | kind         | cascade                      |
      | severity     | error                        |
      | needs reload | false                        |
      | summary      | Some operations have failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace status | id         | name       | status | reasons                 | scope | leaks | rollback partial | cause chain                                                                                                                                                                                                                                                                                     | cause truncated | marketplace clone note | marketplace clone url             | marketplace clone retries     |
      | acme/tools       | user              | failed             | acme/tools | acme/tools | failed | authentication required | user  |       |                  | Fetching the marketplace from GitHub failed on both attempts. HTTPS (https://github.com/acme/tools.git): github.com rejected the stored credential\n\nSSH (git@github.com:acme/tools.git): git clone --depth failed: ssh-auth, exit code 128, git clone --depth failed: ssh-auth, exit code 128 | false           | ssh-not-configured     | https://github.com/acme/tools.git | git@github.com:acme/tools.git |
    Then no result of the command contains "expired-token"
    Then the git host receives these requests:
      | method | path                                              | status |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 401    |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 401    |
    Then the user's ssh receives these launches:
      | argv                                                                                                                 |
      | -T -o BatchMode=yes -o ConnectTimeout=2 -o StrictHostKeyChecking=yes git@github.com                                  |
      | -o BatchMode=yes -o StrictHostKeyChecking=yes -o SendEnv=GIT_PROTOCOL git@github.com git-upload-pack 'acme/tools.git' |
    Then pi routes these github requests:
      | method  | url            | routed to |
      | CONNECT | github.com:443 | git host  |
    Then the user's git credential store holds no credentials
    Then the "claude-plugins.json" file of the user scope does not exist
    Then the user scope holds no marketplace record
    Then the user scope holds no marketplace checkout

  # git runs the helper once to get the credential and once to erase the one
  # the host refused. A `git credential reject` of the extension's own would
  # run it to erase a second time (D-SG-28).
  Scenario: Adding a marketplace whose host refuses the credential helper's credential leaves the erase to git (SG-AUTH-03)
    Given the marketplace "tools" is published as a url source
    Given the git host requires the user "alice" with the password "s3cret" for the marketplace "tools"
    Given the user's git configuration names a credential helper that answers the user "alice" with the password "expired-token"
    When the user runs "/claude:plugin marketplace add https://{git host}/acme/tools.git --scope user"
    Then the result has these fields:
      | kind         | cascade                             |
      | severity     | error                               |
      | needs reload | false                               |
      | summary      | A marketplace operation has failed. |
    Then the result lists these marketplaces:
      | name                              | scope | status | reasons                 |
      | https://{git host}/acme/tools.git | user  | failed | authentication required |
    Then no result of the command contains "expired-token"
    Then the git host receives these requests:
      | method | path                                              | status |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 401    |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 401    |
    Then the credential helper has recorded these runs:
      | action |
      | get    |
      | erase  |
    Then the user scope holds no marketplace record

  Scenario: Adding a private GitHub marketplace with a stored credential clones it and asks for nothing
    Given the marketplace "tools" is published as a github source
    Given the git host requires the user "x-access-token" with the password "stand-in-access-token" for the marketplace "tools"
    Given the user's ssh is denied for "github.com"
    Given the user has stored a credential for github.com with the user "x-access-token" and the password "stand-in-access-token"
    Given pi runs with github's requests routed to the git host
    When the user runs "/claude:plugin marketplace add acme/tools --scope user"
    Then the command reports these results:
      | kind    | severity | needs reload |
      | cascade | info     | false        |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | marketplace status | marketplace clone note | marketplace clone url             |
      | tools            | user              | added              | ssh-not-configured     | https://github.com/acme/tools.git |
    Then no result of the command contains "stand-in-access-token"
    Then the git host receives these requests:
      | method | path                                              | status |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 401    |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/tools.git/git-upload-pack                   | 200    |
      | POST   | /acme/tools.git/git-upload-pack                   | 200    |
    Then the user's ssh receives these launches:
      | argv                                                                                |
      | -T -o BatchMode=yes -o ConnectTimeout=2 -o StrictHostKeyChecking=yes git@github.com |
    Then pi routes these github requests:
      | method  | url            | routed to |
      | CONNECT | github.com:443 | git host  |
    Then the user's git credential store holds these credentials:
      | protocol | host       | user           | password              |
      | https    | github.com | x-access-token | stand-in-access-token |

  Scenario: Updating a private GitHub marketplace uses the stored credential and asks for nothing
    Given the marketplace "tools" is published as a github source
    Given the git host requires the user "x-access-token" with the password "stand-in-access-token" for the marketplace "tools"
    Given the user's ssh is denied for "github.com"
    Given the user has stored a credential for github.com with the user "x-access-token" and the password "stand-in-access-token"
    Given pi runs with github's requests routed to the git host
    Given the user has run "/claude:plugin marketplace add acme/tools --scope user"
    When the user runs "/claude:plugin marketplace update tools --scope user"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope | status  | reasons    |
      | tools | user  | skipped | up-to-date |
    Then no result of the command contains "stand-in-access-token"
    Then the git host receives these requests:
      | method | path                                              | status |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 401    |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/tools.git/git-upload-pack                   | 200    |
    Then pi routes these github requests:
      | method  | url            | routed to |
      | CONNECT | github.com:443 | git host  |
    Then the user's git credential store holds these credentials:
      | protocol | host       | user           | password              |
      | https    | github.com | x-access-token | stand-in-access-token |

  # Git's own `store` helper erases a credential that a host refused with 401,
  # which is git's behavior and not the extension's. So the add fails on a
  # repository the git host answers 404 for: git never sends the credential,
  # and the entry it leaves proves the extension deletes nothing (D-SG-28).
  Scenario: A failed add that never sends the stored GitHub credential leaves it in the credential store
    Given the marketplace "extras" is published as a github source
    Given the git host answers 404 for the marketplace "extras"
    Given the user's ssh is denied for "github.com"
    Given the user has stored a credential for github.com with the user "x-access-token" and the password "stand-in-access-token"
    Given pi runs with github's requests routed to the git host
    When the user runs "/claude:plugin marketplace add acme/extras --scope user"
    Then the result has these fields:
      | kind         | cascade                      |
      | severity     | error                        |
      | needs reload | false                        |
      | summary      | Some operations have failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace status | id          | name        | status | reasons                 | scope | leaks | rollback partial | cause chain                                                                                                                                                                                                                                                                                                           | cause truncated | marketplace clone note | marketplace clone url              | marketplace clone retries      |
      | acme/extras      | user              | failed             | acme/extras | acme/extras | failed | authentication required | user  |       |                  | Fetching the marketplace from GitHub failed on both attempts. HTTPS (https://github.com/acme/extras.git): git clone --depth failed: repository-not-found, exit code 128\n\nSSH (git@github.com:acme/extras.git): git clone --depth failed: ssh-auth, exit code 128, git clone --depth failed: ssh-auth, exit code 128 | false           | ssh-not-configured     | https://github.com/acme/extras.git | git@github.com:acme/extras.git |
    Then no result of the command contains "stand-in-access-token"
    Then the git host receives these requests:
      | method | path                                               | status |
      | GET    | /acme/extras.git/info/refs?service=git-upload-pack | 404    |
    Then pi routes these github requests:
      | method  | url            | routed to |
      | CONNECT | github.com:443 | git host  |
    Then the user's git credential store holds these credentials:
      | protocol | host       | user           | password              |
      | https    | github.com | x-access-token | stand-in-access-token |
    Then the user scope holds no marketplace record

  Scenario: A terminal session sends the background update's GitHub requests to the git host
    Given the marketplace "tools" is published as a github source
    Given the user's ssh is denied for "github.com"
    Given pi runs with github's requests routed to the git host
    Given the user has run "/claude:plugin marketplace add acme/tools --scope user"
    Given the user has run "/claude:plugin marketplace autoupdate tools --scope user"
    Given the tui session starts with the environment variable "PI_CLAUDE_MARKETPLACE_AUTOUPDATE_DELAY_MS" set to "0"
    When the user sends the message "hello" in the tui session
    Then the tui session reports no notice
    Then the git host receives these requests:
      | method | path                                              | status |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/tools.git/git-upload-pack                   | 200    |
    Then pi routes these github requests:
      | method  | url            | routed to |
      | CONNECT | github.com:443 | git host  |

  Scenario: The background update of a private GitHub marketplace with no stored credential shows no notice and asks for nothing
    Given the marketplace "tools" is published as a github source
    Given the user's ssh is denied for "github.com"
    Given pi runs with github's requests routed to the git host
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
    Then pi routes these github requests:
      | method  | url            | routed to |
      | CONNECT | github.com:443 | git host  |
      | CONNECT | github.com:443 | git host  |

  Scenario: The background update of a private GitHub marketplace fetches with the stored GitHub credential
    Given the marketplace "tools" is published as a github source
    Given the user's ssh is denied for "github.com"
    Given pi runs with github's requests routed to the git host
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
    Then pi routes these github requests:
      | method  | url            | routed to |
      | CONNECT | github.com:443 | git host  |

  Scenario: Applying a config that declares a private GitHub marketplace in pi's print mode adds nothing and leaves no staged clone, and print mode shows nothing, a documented Pi gap (MODE-04, JDOC-02)
    Given the marketplace "tools" is published as a github source
    Given the git host requires the user "x-access-token" with the password "stand-in-access-token" for the marketplace "tools"
    Given the user's ssh is denied for "github.com"
    Given pi runs with github's requests routed to the git host
    Given a config in scope project and layer base, with these marketplaces:
      | name  | source     | autoupdate |
      | tools | acme/tools | false      |
    When the user runs "/claude:plugin apply --scope project" in pi's print mode
    Then pi's print mode exits with code 0 and prints nothing
    Then the git host receives these requests:
      | method | path                                              | status |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 401    |
    Then pi routes these github requests:
      | method  | url            | routed to |
      | CONNECT | github.com:443 | git host  |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name  | source     | autoupdate |
      | tools | acme/tools | false      |
    Then the project scope holds no marketplace record
    Then the project scope holds no marketplace checkout
    Then the project scope holds no git clones

  # AAP-02: a load is a run no command opened, so it never asks the user for
  # a credential (SG-AUTH-02).
  Scenario: A reload with autoapply on adds nothing for a private GitHub marketplace with no stored credential and asks for nothing
    Given the marketplace "tools" is published as a github source
    Given the git host requires the user "x-access-token" with the password "stand-in-access-token" for the marketplace "tools"
    Given the user's ssh is denied for "github.com"
    Given pi runs with github's requests routed to the git host
    Given a config in scope project and layer base, with this text:
      """
      { "autoapply": true }
      """
    Given a config in scope project and layer base, with these marketplaces:
      | name  | source     | autoupdate |
      | tools | acme/tools | false      |
    When the user reloads pi
    Then the session reports these results:
      | kind                      | severity | needs reload | summary                             | tally label | tally failures | tally warnings |
      | reconcile-applied-cascade | error    | false        | A marketplace operation has failed. | Reconcile   | 1              | 0              |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | marketplace status | marketplace reasons     | marketplace clone note | marketplace clone url             | marketplace clone retries     |
      | tools            | project           | failed             | authentication required | ssh-not-configured     | https://github.com/acme/tools.git | git@github.com:acme/tools.git |
    Then the git host receives these requests:
      | method | path                                              | status |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 401    |
    Then pi routes these github requests:
      | method  | url            | routed to |
      | CONNECT | github.com:443 | git host  |
    Then the project scope holds no marketplace record
