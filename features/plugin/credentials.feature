Feature: Plugin credentials

  Installing a plugin from a private git source authenticates git only with what the machine holds,
  such as the user's git credential helpers, and asks the user for nothing (SG-AUTH-01, SG-AUTH-03).
  The scenarios run against the run's https git host, the ssh stand-in, and a profile Pi whose
  github.com requests are routed to the git host.

  Scenario: Installing a plugin from a private GitHub source with a stored credential clones it and asks for nothing
    Given the git repository "ghp" holds these plugins:
      | name | version | path |
      | ghp  | 1.0.0   |      |
    Given the marketplace "gits" is published as a dir source
    Given the marketplace "gits" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | ghp  | github      | ghp        | false  |
    Given the git host requires the user "x-access-token" with the password "stand-in-access-token" for the plugin "ghp"
    Given the user's ssh is denied for "github.com"
    Given the user has stored a credential for github.com with the user "x-access-token" and the password "stand-in-access-token"
    Given pi runs with github's requests routed to the git host
    Given the marketplace "gits" is added to the project scope
    When the user runs "/claude:plugin install ghp@gits --scope project"
    Then the command reports these results:
      | kind    | severity | needs reload |
      | cascade | info     | true         |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id       | name | status    | reasons | scope   | version | clone note         | clone url                       |
      | gits             | project           | ghp@gits | ghp  | installed |         | project | 1.0.0   | ssh-not-configured | https://github.com/acme/ghp.git |
    Then no result of the command contains "stand-in-access-token"
    Then the git host receives these requests:
      | method | path                                            | status |
      | GET    | /acme/ghp.git/info/refs?service=git-upload-pack | 401    |
      | GET    | /acme/ghp.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/ghp.git/git-upload-pack                   | 200    |
      | POST   | /acme/ghp.git/git-upload-pack                   | 200    |
    Then pi routes these github requests:
      | method  | url            | routed to |
      | CONNECT | github.com:443 | git host  |
    Then the user's git credential store holds these credentials:
      | protocol | host       | user           | password              |
      | https    | github.com | x-access-token | stand-in-access-token |

  Scenario: Installing a plugin from a private GitHub source with no stored credential fails as authentication required and shows no device code
    Given the git repository "ghp" holds these plugins:
      | name | version | path |
      | ghp  | 1.0.0   |      |
    Given the marketplace "gits" is published as a dir source
    Given the marketplace "gits" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | ghp  | github      | ghp        | false  |
    Given the git host requires the user "x-access-token" with the password "stand-in-access-token" for the plugin "ghp"
    Given the user's ssh is denied for "github.com"
    Given pi runs with github's requests routed to the git host
    Given the marketplace "gits" is added to the project scope
    When the user runs "/claude:plugin install ghp@gits --scope project"
    Then the command reports these results:
      | kind    | severity | needs reload | summary                        |
      | cascade | error    | false        | A plugin operation has failed. |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id       | name | status | reasons                 | scope   | leaks | rollback partial | cause chain                                                                                                                                                                                                                                                                                                                                                                                                                           | cause truncated | clone note         | clone url                       | clone retries               |
      | gits             | project           | ghp@gits | ghp  | failed | authentication required | project |       |                  | git clone --depth failed: https-auth, exit code 128\nThe retry over SSH failed too: git clone --depth failed: ssh-auth, exit code 128\nCheck the repository and ref in the marketplace entry and that github.com can be reached. If the repository is private, add an SSH key to your GitHub account or set up a git credential helper for https://github.com. Then install again., git clone --depth failed: ssh-auth, exit code 128 | false           | ssh-not-configured | https://github.com/acme/ghp.git | git@github.com:acme/ghp.git |
    Then the git host receives these requests:
      | method | path                                            | status |
      | GET    | /acme/ghp.git/info/refs?service=git-upload-pack | 401    |
    Then pi routes these github requests:
      | method  | url            | routed to |
      | CONNECT | github.com:443 | git host  |
    Then the installation record of the project scope holds no plugins

  Scenario: Installing a pinned GitHub plugin whose clone is already cached makes no request
    Given the git repository "ghp" holds these plugins:
      | name | version | path |
      | ghp  | 1.0.0   |      |
    Given the marketplace "gits" is published as a dir source
    Given the marketplace "gits" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | ghp  | github      | ghp        | true   |
    Given the git host requires the user "x-access-token" with the password "stand-in-access-token" for the plugin "ghp"
    Given the user's ssh is denied for "github.com"
    Given pi runs with github's requests routed to the git host
    Given the marketplace "gits" is added to the project scope
    Given the user has stored a credential for github.com with the user "x-access-token" and the password "stand-in-access-token"
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

  Scenario: Updating a plugin from a private GitHub source uses the stored credential and asks for nothing
    Given the git repository "ghp" holds these plugins:
      | name | version | path |
      | ghp  | 1.0.0   |      |
    Given the marketplace "gits" is published as a dir source
    Given the marketplace "gits" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | ghp  | github      | ghp        | false  |
    Given the git host requires the user "x-access-token" with the password "stand-in-access-token" for the plugin "ghp"
    Given the user's ssh is denied for "github.com"
    Given the user has stored a credential for github.com with the user "x-access-token" and the password "stand-in-access-token"
    Given pi runs with github's requests routed to the git host
    Given the marketplace "gits" is added to the project scope
    Given the user has run "/claude:plugin install ghp@gits --scope project"
    Given the git repository "ghp" holds these plugins:
      | name | version | path |
      | ghp  | 2.0.0   |      |
    When the user runs "/claude:plugin update ghp@gits --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id       | name | status  | reasons | scope   | from  | to    | clone note         | clone url                       |
      | gits             | project           | ghp@gits | ghp  | updated |         | project | 1.0.0 | 2.0.0 | ssh-not-configured | https://github.com/acme/ghp.git |
    Then no result of the command contains "stand-in-access-token"
    Then the git host receives these requests:
      | method | path                                            | status |
      | GET    | /acme/ghp.git/info/refs?service=git-upload-pack | 401    |
      | GET    | /acme/ghp.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/ghp.git/git-upload-pack                   | 200    |
      | GET    | /acme/ghp.git/info/refs?service=git-upload-pack | 401    |
      | GET    | /acme/ghp.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/ghp.git/git-upload-pack                   | 200    |
      | POST   | /acme/ghp.git/git-upload-pack                   | 200    |
    Then the user's ssh receives these launches:
      | argv                                                                                |
      | -T -o BatchMode=yes -o ConnectTimeout=2 -o StrictHostKeyChecking=yes git@github.com |
      | -G git@github.com                                                                   |
    Then pi routes these github requests:
      | method  | url            | routed to |
      | CONNECT | github.com:443 | git host  |
      | CONNECT | github.com:443 | git host  |
    Then the user's git credential store holds these credentials:
      | protocol | host       | user           | password              |
      | https    | github.com | x-access-token | stand-in-access-token |

  Scenario: With only GITHUB_TOKEN and GH_TOKEN set, installing a plugin from a private GitHub source fails as authentication required and no request carries either token
    Given the git repository "ghp" holds these plugins:
      | name | version | path |
      | ghp  | 1.0.0   |      |
    Given the marketplace "gits" is published as a dir source
    Given the marketplace "gits" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | ghp  | github      | ghp        | false  |
    Given the git host requires the user "x-access-token" with the password "stand-in-access-token" for the plugin "ghp"
    Given the user's ssh is denied for "github.com"
    Given pi runs with github's requests routed to the git host and these environment variables:
      | name         | value                  |
      | GITHUB_TOKEN | env-github-token-value |
      | GH_TOKEN     | env-gh-token-value     |
    Given the marketplace "gits" is added to the project scope
    When the user runs "/claude:plugin install ghp@gits --scope project"
    Then the command reports these results:
      | kind    | severity | needs reload | summary                        |
      | cascade | error    | false        | A plugin operation has failed. |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id       | name | status | reasons                 | scope   | leaks | rollback partial | cause chain                                                                                                                                                                                                                                                                                                                                                                                                                           | cause truncated | clone note         | clone url                       | clone retries               |
      | gits             | project           | ghp@gits | ghp  | failed | authentication required | project |       |                  | git clone --depth failed: https-auth, exit code 128\nThe retry over SSH failed too: git clone --depth failed: ssh-auth, exit code 128\nCheck the repository and ref in the marketplace entry and that github.com can be reached. If the repository is private, add an SSH key to your GitHub account or set up a git credential helper for https://github.com. Then install again., git clone --depth failed: ssh-auth, exit code 128 | false           | ssh-not-configured | https://github.com/acme/ghp.git | git@github.com:acme/ghp.git |
    Then no result of the command contains "env-github-token-value"
    Then no result of the command contains "env-gh-token-value"
    Then no request the git host received carries "env-github-token-value"
    Then no request the git host received carries "env-gh-token-value"
    Then the git host receives these requests:
      | method | path                                            | status |
      | GET    | /acme/ghp.git/info/refs?service=git-upload-pack | 401    |
    Then the user's ssh receives these launches:
      | argv                                                                                                               |
      | -T -o BatchMode=yes -o ConnectTimeout=2 -o StrictHostKeyChecking=yes git@github.com                                |
      | -G git@github.com                                                                                                  |
      | -o BatchMode=yes -o StrictHostKeyChecking=yes -o SendEnv=GIT_PROTOCOL git@github.com git-upload-pack 'acme/ghp.git' |
    Then pi routes these github requests:
      | method  | url            | routed to |
      | CONNECT | github.com:443 | git host  |
    Then the installation record of the project scope holds no plugins
