Feature: Marketplace credentials

  The extension authenticates git only with what the machine holds, an ssh key or agent and the
  user's git credential helpers, and keeps no token of its own (SG-AUTH-01, SG-AUTH-02, SG-AUTH-03).
  The scenarios run against the run's https git host, the ssh stand-in, and a profile Pi whose
  github.com requests are routed to the git host.

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
    Then the user's ssh receives no launch
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
    Given the marketplace "tools" is published as a github source
    Given the git host requires the user "x-access-token" with the password "stand-in-access-token" for the marketplace "tools"
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
