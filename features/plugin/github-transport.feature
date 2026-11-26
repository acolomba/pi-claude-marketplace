Feature: Plugin github transport

  Installing a plugin whose source is a github owner/repo picks ssh or https the way Claude Code's shell install does: https first only when no ssh setting of the user and no probe answer keeps the clone on ssh, and ssh only otherwise (D-SG-18).
  An ssh stand-in first on Pi's path answers the probe and serves the git host's repositories over ssh, and a CONNECT proxy tunnels git's github.com connections to the git host.
  The install's result names the transport of each github clone on the row of the plugin that cloned, as its clone note and clone url, with the url of each retry (D-SG-22).

  Background:
    Given the git repository "ghp" holds these plugins:
      | name | version | path |
      | ghp  | 1.0.0   |      |
    Given the marketplace "gits" is published as a dir source
    Given the marketplace "gits" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | ghp  | github      | ghp        | false  |

  Scenario: Installing a github plugin when the user's ssh authenticates to github.com clones it over ssh only
    Given the user's ssh authenticates to "github.com" as "acme"
    Given pi runs with github's requests routed to the git host
    Given the marketplace "gits" is added to the project scope
    When the user runs "/claude:plugin install ghp@gits --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id       | name | status    | reasons | scope   | version | clone note | clone url                   |
      | gits             | project           | ghp@gits | ghp  | installed |         | project | 1.0.0   | via-ssh    | git@github.com:acme/ghp.git |
    Then the user's ssh receives these launches:
      | argv                                                                                                                |
      | -T -o BatchMode=yes -o ConnectTimeout=2 -o StrictHostKeyChecking=yes git@github.com                                 |
      | -o BatchMode=yes -o StrictHostKeyChecking=yes -o SendEnv=GIT_PROTOCOL git@github.com git-upload-pack 'acme/ghp.git' |
    Then the git host receives no request

  Scenario: Installing a github plugin with no ssh setting and a denied ssh key clones it over https first
    Given the user's ssh is denied for "github.com"
    Given pi runs with github's requests routed to the git host
    Given the marketplace "gits" is added to the project scope
    When the user runs "/claude:plugin install ghp@gits --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id       | name | status    | reasons | scope   | version | clone note         | clone url                       |
      | gits             | project           | ghp@gits | ghp  | installed |         | project | 1.0.0   | ssh-not-configured | https://github.com/acme/ghp.git |
    Then the user's ssh receives these launches:
      | argv                                                                                |
      | -T -o BatchMode=yes -o ConnectTimeout=2 -o StrictHostKeyChecking=yes git@github.com |
      | -G git@github.com                                                                   |
    Then the git host receives these requests:
      | method | path                                            | status |
      | GET    | /acme/ghp.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/ghp.git/git-upload-pack                   | 200    |
      | POST   | /acme/ghp.git/git-upload-pack                   | 200    |

  Scenario Outline: The user's <variable> keeps a github plugin install on ssh without the probe
    Given the user's ssh authenticates to "github.com" as "acme"
    Given pi runs with github's requests routed to the git host and the environment variable "<variable>" set to "<value>"
    Given the marketplace "gits" is added to the project scope
    When the user runs "/claude:plugin install ghp@gits --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id       | name | status    | reasons | scope   | version | clone note | clone url                   |
      | gits             | project           | ghp@gits | ghp  | installed |         | project | 1.0.0   | via-ssh    | git@github.com:acme/ghp.git |
    Then the user's ssh receives these launches:
      | argv                                                                                                                |
      | -o BatchMode=yes -o StrictHostKeyChecking=yes -o SendEnv=GIT_PROTOCOL git@github.com git-upload-pack 'acme/ghp.git' |
    Then the git host receives no request

    Examples:
      | variable        | value |
      | GIT_SSH_COMMAND | ssh   |
      | GIT_SSH_COMMAND |       |
      | GIT_SSH         | ssh   |

  Scenario: The user's core.sshCommand keeps a github plugin install on ssh without the probe
    Given the user's ssh authenticates to "github.com" as "acme"
    Given the user's git config sets "core.sshCommand" to "ssh"
    Given pi runs with github's requests routed to the git host
    Given the marketplace "gits" is added to the project scope
    When the user runs "/claude:plugin install ghp@gits --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id       | name | status    | reasons | scope   | version | clone note | clone url                   |
      | gits             | project           | ghp@gits | ghp  | installed |         | project | 1.0.0   | via-ssh    | git@github.com:acme/ghp.git |
    Then the user's ssh receives these launches:
      | argv                                                                                                                |
      | -o BatchMode=yes -o StrictHostKeyChecking=yes -o SendEnv=GIT_PROTOCOL git@github.com git-upload-pack 'acme/ghp.git' |
    Then the git host receives no request

  Scenario: A probe that never answers keeps a github plugin install on ssh
    Given the user's ssh never answers for "github.com"
    Given pi runs with github's requests routed to the git host
    Given the marketplace "gits" is added to the project scope
    When the user runs "/claude:plugin install ghp@gits --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id       | name | status    | reasons | scope   | version | clone note | clone url                   |
      | gits             | project           | ghp@gits | ghp  | installed |         | project | 1.0.0   | via-ssh    | git@github.com:acme/ghp.git |
    Then the user's ssh receives these launches:
      | argv                                                                                                                |
      | -T -o BatchMode=yes -o ConnectTimeout=2 -o StrictHostKeyChecking=yes git@github.com                                 |
      | -o BatchMode=yes -o StrictHostKeyChecking=yes -o SendEnv=GIT_PROTOCOL git@github.com git-upload-pack 'acme/ghp.git' |
    Then the git host receives no request

  Scenario: An ssh config that sends github.com through a proxy keeps a github plugin install on ssh
    Given the user's ssh is denied for "github.com" and its config names the proxy "proxycommand nc %h %p"
    Given pi runs with github's requests routed to the git host
    Given the marketplace "gits" is added to the project scope
    When the user runs "/claude:plugin install ghp@gits --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id       | name | status | reasons                 | scope   | leaks | rollback partial | clone note | clone url                   |
      | gits             | project           | ghp@gits | ghp  | failed | authentication required | project |       |                  | via-ssh    | git@github.com:acme/ghp.git |
    Then the user's ssh receives these launches:
      | argv                                                                                                                |
      | -T -o BatchMode=yes -o ConnectTimeout=2 -o StrictHostKeyChecking=yes git@github.com                                 |
      | -G git@github.com                                                                                                   |
      | -o BatchMode=yes -o StrictHostKeyChecking=yes -o SendEnv=GIT_PROTOCOL git@github.com git-upload-pack 'acme/ghp.git' |
    Then the git host receives no request
    Then the project scope has no installed plugins

  Scenario: A user insteadOf that rewrites the github ssh address keeps the install on the user's rewrite
    Given the user's git config sets "url.https://github.com/.insteadOf" to "git@github.com:"
    Given pi runs with github's requests routed to the git host
    Given the marketplace "gits" is added to the project scope
    When the user runs "/claude:plugin install ghp@gits --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id       | name | status    | reasons | scope   | version | clone note | clone url                   |
      | gits             | project           | ghp@gits | ghp  | installed |         | project | 1.0.0   | via-ssh    | git@github.com:acme/ghp.git |
    Then the user's ssh receives no launch
    Then the git host receives these requests:
      | method | path                                            | status |
      | GET    | /acme/ghp.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/ghp.git/git-upload-pack                   | 200    |
      | POST   | /acme/ghp.git/git-upload-pack                   | 200    |

  Scenario: With CLAUDE_CODE_PLUGIN_PREFER_HTTPS set, a github plugin installs over https with no probe
    Given the user's ssh authenticates to "github.com" as "acme"
    Given pi runs with github's requests routed to the git host and the environment variable "CLAUDE_CODE_PLUGIN_PREFER_HTTPS" set to "1"
    Given the marketplace "gits" is added to the project scope
    When the user runs "/claude:plugin install ghp@gits --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id       | name | status    | reasons | scope   | version | clone note | clone url                       |
      | gits             | project           | ghp@gits | ghp  | installed |         | project | 1.0.0   | via-https  | https://github.com/acme/ghp.git |
    Then the user's ssh receives no launch
    Then the git host receives these requests:
      | method | path                                            | status |
      | GET    | /acme/ghp.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/ghp.git/git-upload-pack                   | 200    |
      | POST   | /acme/ghp.git/git-upload-pack                   | 200    |

  Scenario: A github plugin install that fails over https and over ssh reports both attempts
    Given the user's ssh is denied for "github.com"
    Given the git host answers 404 for the plugin "ghp"
    Given pi runs with github's requests routed to the git host
    Given the marketplace "gits" is added to the project scope
    When the user runs "/claude:plugin install ghp@gits --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id       | name | status | reasons                 | scope   | leaks | rollback partial | cause chain                                                                                                                                                                                                                                                                                                                                                                                                                                     | cause truncated | clone note         | clone retries               | clone url                       |
      | gits             | project           | ghp@gits | ghp  | failed | authentication required | project |       |                  | git clone --depth failed: repository-not-found, exit code 128\nThe retry over SSH failed too: git clone --depth failed: ssh-auth, exit code 128\nCheck the repository and ref in the marketplace entry and that github.com can be reached. If the repository is private, add an SSH key to your GitHub account or set up a git credential helper for https://github.com. Then install again., git clone --depth failed: ssh-auth, exit code 128 | false           | ssh-not-configured | git@github.com:acme/ghp.git | https://github.com/acme/ghp.git |
    Then the user's ssh receives these launches:
      | argv                                                                                                                |
      | -T -o BatchMode=yes -o ConnectTimeout=2 -o StrictHostKeyChecking=yes git@github.com                                 |
      | -G git@github.com                                                                                                   |
      | -o BatchMode=yes -o StrictHostKeyChecking=yes -o SendEnv=GIT_PROTOCOL git@github.com git-upload-pack 'acme/ghp.git' |
    Then the git host receives these requests:
      | method | path                                            | status |
      | GET    | /acme/ghp.git/info/refs?service=git-upload-pack | 404    |
    Then the project scope has no installed plugins
    Then the project scope holds no git clones

  Scenario: A github plugin whose repository is not an owner/repo pair is refused before any probe or clone
    Given the marketplace "gits" publishes this manifest:
      """
      {
        "name": "gits",
        "owner": { "name": "features" },
        "plugins": [
          { "name": "ghp", "source": { "source": "github", "repo": "evil:x/ghp" }, "version": "1.0.0" }
        ]
      }
      """
    Given the user's ssh is denied for "github.com"
    Given pi runs with github's requests routed to the git host
    Given the marketplace "gits" is added to the project scope
    When the user runs "/claude:plugin install ghp@gits --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id       | name | status | reasons            | scope   | leaks | rollback partial | cause chain                                                              | cause truncated |
      | gits             | project           | ghp@gits | ghp  | failed | unsupported source | project |       |                  | Invalid GitHub repository format: evil:x/ghp. Expected format: owner/repo | false           |
    Then the user's ssh receives no launch
    Then the git host receives no request
    Then the project scope has no installed plugins

  Scenario: Installing a github plugin with a github dependency probes once
    Given the git repository "ghd" holds these plugins:
      | name | version | path |
      | ghd  | 1.0.0   |      |
    Given the marketplace "gits" offers these plugins from git repositories:
      | name | source kind | repository | pinned | dependencies |
      | ghp  | github      | ghp        | false  | ghd          |
      | ghd  | github      | ghd        | false  |              |
    Given the user's ssh is denied for "github.com"
    Given pi runs with github's requests routed to the git host
    Given the marketplace "gits" is added to the project scope
    When the user runs "/claude:plugin install ghp@gits --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id       | name     | status    | reasons | scope   | version | clone note         | clone url                       |
      | gits             | project           | ghd@gits | ghd@gits | installed |         | project | 1.0.0   | ssh-not-configured | https://github.com/acme/ghd.git |
      | gits             | project           | ghp@gits | ghp      | installed |         | project | 1.0.0   | ssh-not-configured | https://github.com/acme/ghp.git |
    Then the user's ssh receives these launches:
      | argv                                                                                |
      | -T -o BatchMode=yes -o ConnectTimeout=2 -o StrictHostKeyChecking=yes git@github.com |
      | -G git@github.com                                                                   |
    Then the git host receives these requests:
      | method | path                                            | status |
      | GET    | /acme/ghd.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/ghd.git/git-upload-pack                   | 200    |
      | POST   | /acme/ghd.git/git-upload-pack                   | 200    |
      | GET    | /acme/ghp.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/ghp.git/git-upload-pack                   | 200    |
      | POST   | /acme/ghp.git/git-upload-pack                   | 200    |

  Scenario: A constrained github dependency lists its release tags over ssh
    Given the git repository "ghd" holds these plugins:
      | name | version | path |
      | ghd  | 1.0.0   |      |
    Given the git repository "ghd" has a revision only the tag "ghd--v2.0.0" reaches, holding these plugins:
      | name | version | path |
      | ghd  | 2.0.0   |      |
    Given the marketplace "gits" offers these plugins from git repositories:
      | name | source kind | repository | pinned | dependencies |
      | ghp  | github      | ghp        | false  | ghd@^2.0.0   |
      | ghd  | github      | ghd        | false  |              |
    Given the user's ssh authenticates to "github.com" as "acme"
    Given pi runs with github's requests routed to the git host
    Given the marketplace "gits" is added to the project scope
    When the user runs "/claude:plugin install ghp@gits --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id       | name     | status    | reasons | scope   | version                | clone note | clone url                   |
      | gits             | project           | ghd@gits | ghd@gits | installed |         | project | 2.0.0-{ghd revision 2} | via-ssh    | git@github.com:acme/ghd.git |
      | gits             | project           | ghp@gits | ghp      | installed |         | project | 1.0.0                  | via-ssh    | git@github.com:acme/ghp.git |
    Then the user's ssh receives these launches:
      | argv                                                                                                                |
      | -o BatchMode=yes -o StrictHostKeyChecking=yes -o SendEnv=GIT_PROTOCOL git@github.com git-upload-pack 'acme/ghd.git' |
      | -T -o BatchMode=yes -o ConnectTimeout=2 -o StrictHostKeyChecking=yes git@github.com                                 |
      | -o BatchMode=yes -o StrictHostKeyChecking=yes -o SendEnv=GIT_PROTOCOL git@github.com git-upload-pack 'acme/ghd.git' |
      | -o BatchMode=yes -o StrictHostKeyChecking=yes -o SendEnv=GIT_PROTOCOL git@github.com git-upload-pack 'acme/ghd.git' |
      | -o BatchMode=yes -o StrictHostKeyChecking=yes -o SendEnv=GIT_PROTOCOL git@github.com git-upload-pack 'acme/ghp.git' |
    Then the git host receives no request
    Then the installation record of the project scope holds these plugins:
      | id       | version                | enabled |
      | ghd@gits | 2.0.0-{ghd revision 2} | true    |
      | ghp@gits | 1.0.0                  | true    |

  Scenario: A path-source dependency of a github marketplace reads the marketplace's tags over ssh
    Given the marketplace "tools" is published as a github source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name      | version | dependencies     |
      | app       | 1.0.0   | formatter@^1.0.0 |
      | formatter | 1.0.0   |                  |
    Given the marketplace "tools" tags its current commit "formatter--v1.0.0"
    Given the marketplace "tools" offers these plugins with dependencies:
      | name      | version | dependencies     |
      | app       | 1.1.0   | formatter@^1.0.0 |
      | formatter | 2.0.0   |                  |
    Given the user's ssh authenticates to "github.com" as "acme"
    Given pi runs with github's requests routed to the git host
    Given the marketplace "tools" is added to the project scope
    When the user runs "/claude:plugin install app@tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id              | name            | status    | reasons | scope   | version                                  |
      | tools            | project           | app@tools       | app             | installed |         | project | 1.1.0                                    |
      | tools            | project           | formatter@tools | formatter@tools | installed |         | project | 1.0.0-{tools revision formatter--v1.0.0} |
    Then the user's ssh receives these launches:
      | argv                                                                                                                 |
      | -o BatchMode=yes -o StrictHostKeyChecking=yes -o SendEnv=GIT_PROTOCOL git@github.com git-upload-pack 'acme/tools.git' |
      | -o BatchMode=yes -o StrictHostKeyChecking=yes -o SendEnv=GIT_PROTOCOL git@github.com git-upload-pack 'acme/tools.git' |
    Then the git host receives no request

  Scenario: For a user with no ssh key, a constrained path-source dependency of a github marketplace installs the current copy
    Given the marketplace "tools" is published as a github source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name      | version | dependencies     |
      | app       | 1.0.0   | formatter@^1.0.0 |
      | formatter | 1.0.0   |                  |
    Given the marketplace "tools" tags its current commit "formatter--v1.0.0"
    Given the marketplace "tools" offers these plugins with dependencies:
      | name      | version | dependencies     |
      | app       | 1.1.0   | formatter@^1.0.0 |
      | formatter | 2.0.0   |                  |
    Given the user's ssh is denied for "github.com"
    Given pi runs with github's requests routed to the git host
    Given the marketplace "tools" is added to the project scope
    When the user runs "/claude:plugin install app@tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id              | name            | status    | reasons                 | scope   | version |
      | tools            | project           | app@tools       | app             | installed |                         | project | 1.1.0   |
      | tools            | project           | formatter@tools | formatter@tools | installed | dependency current copy | project | 2.0.0   |
    Then the user's ssh receives these launches:
      | argv                                                                                                                 |
      | -o BatchMode=yes -o StrictHostKeyChecking=yes -o SendEnv=GIT_PROTOCOL git@github.com git-upload-pack 'acme/tools.git' |
    Then the git host receives no request

  Scenario: For a user with no ssh key, a constrained github dependency still installs at its release tag
    Given the git repository "ghd" holds these plugins:
      | name | version | path |
      | ghd  | 1.0.0   |      |
    Given the git repository "ghd" has a revision only the tag "ghd--v2.0.0" reaches, holding these plugins:
      | name | version | path |
      | ghd  | 2.0.0   |      |
    Given the marketplace "gits" offers these plugins from git repositories:
      | name | source kind | repository | pinned | dependencies |
      | ghp  | github      | ghp        | false  | ghd@^2.0.0   |
      | ghd  | github      | ghd        | false  |              |
    Given the user's ssh is denied for "github.com"
    Given pi runs with github's requests routed to the git host
    Given the marketplace "gits" is added to the project scope
    When the user runs "/claude:plugin install ghp@gits --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id       | name     | status    | reasons | scope   | version                | clone note         | clone url                       |
      | gits             | project           | ghd@gits | ghd@gits | installed |         | project | 2.0.0-{ghd revision 2} | ssh-not-configured | https://github.com/acme/ghd.git |
      | gits             | project           | ghp@gits | ghp      | installed |         | project | 1.0.0                  | ssh-not-configured | https://github.com/acme/ghp.git |
    Then the user's ssh receives these launches:
      | argv                                                                                                                |
      | -o BatchMode=yes -o StrictHostKeyChecking=yes -o SendEnv=GIT_PROTOCOL git@github.com git-upload-pack 'acme/ghd.git' |
      | -T -o BatchMode=yes -o ConnectTimeout=2 -o StrictHostKeyChecking=yes git@github.com                                 |
      | -G git@github.com                                                                                                   |
    Then the git host receives these requests:
      | method | path                                            | status |
      | GET    | /acme/ghd.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/ghd.git/git-upload-pack                   | 200    |
      | GET    | /acme/ghd.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/ghd.git/git-upload-pack                   | 200    |
      | POST   | /acme/ghd.git/git-upload-pack                   | 200    |
      | GET    | /acme/ghd.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/ghd.git/git-upload-pack                   | 200    |
      | POST   | /acme/ghd.git/git-upload-pack                   | 200    |
      | GET    | /acme/ghp.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/ghp.git/git-upload-pack                   | 200    |
      | POST   | /acme/ghp.git/git-upload-pack                   | 200    |
    Then the installation record of the project scope holds these plugins:
      | id       | version                | enabled |
      | ghd@gits | 2.0.0-{ghd revision 2} | true    |
      | ghp@gits | 1.0.0                  | true    |

  Scenario: With CLAUDE_CODE_PLUGIN_PREFER_HTTPS set, a constrained github dependency lists its tags over https
    Given the git repository "ghd" holds these plugins:
      | name | version | path |
      | ghd  | 1.0.0   |      |
    Given the git repository "ghd" has a revision only the tag "ghd--v2.0.0" reaches, holding these plugins:
      | name | version | path |
      | ghd  | 2.0.0   |      |
    Given the marketplace "gits" offers these plugins from git repositories:
      | name | source kind | repository | pinned | dependencies |
      | ghp  | github      | ghp        | false  | ghd@^2.0.0   |
      | ghd  | github      | ghd        | false  |              |
    Given the user's ssh authenticates to "github.com" as "acme"
    Given pi runs with github's requests routed to the git host and the environment variable "CLAUDE_CODE_PLUGIN_PREFER_HTTPS" set to "1"
    Given the marketplace "gits" is added to the project scope
    When the user runs "/claude:plugin install ghp@gits --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id       | name     | status    | reasons | scope   | version                | clone note | clone url                       |
      | gits             | project           | ghd@gits | ghd@gits | installed |         | project | 2.0.0-{ghd revision 2} | via-https  | https://github.com/acme/ghd.git |
      | gits             | project           | ghp@gits | ghp      | installed |         | project | 1.0.0                  | via-https  | https://github.com/acme/ghp.git |
    Then the user's ssh receives no launch
    Then the git host receives these requests:
      | method | path                                            | status |
      | GET    | /acme/ghd.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/ghd.git/git-upload-pack                   | 200    |
      | GET    | /acme/ghd.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/ghd.git/git-upload-pack                   | 200    |
      | POST   | /acme/ghd.git/git-upload-pack                   | 200    |
      | GET    | /acme/ghd.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/ghd.git/git-upload-pack                   | 200    |
      | POST   | /acme/ghd.git/git-upload-pack                   | 200    |
      | GET    | /acme/ghp.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/ghp.git/git-upload-pack                   | 200    |
      | POST   | /acme/ghp.git/git-upload-pack                   | 200    |
    Then the installation record of the project scope holds these plugins:
      | id       | version                | enabled |
      | ghd@gits | 2.0.0-{ghd revision 2} | true    |
      | ghp@gits | 1.0.0                  | true    |
