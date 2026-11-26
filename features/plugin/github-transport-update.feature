Feature: Plugin github transport update

  Updating or reinstalling a plugin whose source is a github owner/repo picks ssh or https the way installing it does, with one probe for the whole command, and the dependency moves of an update follow the same choice (D-SG-19).
  An ssh stand-in first on Pi's path answers the probe and serves the git host's repositories over ssh, and a CONNECT proxy tunnels git's github.com connections to the git host.
  Each row names the transport of the clone its plugin ran, and the marketplace's block names the re-clone of the marketplace refresh an update runs first (D-SG-22). A fetch, an info with --fetch, and an enable name the clone they ran the same way. When the clone of a dependency an enable re-enables fails, the enabled plugin's failed row names that clone, labelled with the dependency.

  Background:
    Given the git repository "ghp" holds these plugins:
      | name | version | path |
      | ghp  | 1.0.0   |      |
    Given the marketplace "gits" is published as a dir source
    Given the marketplace "gits" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | ghp  | github      | ghp        | false  |

  Scenario: Updating a github plugin with no ssh setting refreshes it over https first
    Given the user's ssh is denied for "github.com"
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
    Then the user's ssh receives these launches:
      | argv                                                                                |
      | -T -o BatchMode=yes -o ConnectTimeout=2 -o StrictHostKeyChecking=yes git@github.com |
      | -G git@github.com                                                                   |
    Then the git host receives these requests:
      | method | path                                            | status |
      | GET    | /acme/ghp.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/ghp.git/git-upload-pack                   | 200    |
      | GET    | /acme/ghp.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/ghp.git/git-upload-pack                   | 200    |
      | POST   | /acme/ghp.git/git-upload-pack                   | 200    |

  Scenario: Updating a github plugin whose clone is gone and whose repository has not moved names the clone on its up-to-date row
    Given the user's ssh is denied for "github.com"
    Given pi runs with github's requests routed to the git host
    Given the marketplace "gits" is added to the project scope
    Given the user has run "/claude:plugin install ghp@gits --scope project"
    Given the cached clones of git plugins in the project scope are deleted
    When the user runs "/claude:plugin update ghp@gits --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id       | name | status  | reasons    | scope   | clone note         | clone url                       |
      | gits             | project           | ghp@gits | ghp  | skipped | up-to-date | project | ssh-not-configured | https://github.com/acme/ghp.git |

  @builtin-only
  Scenario: Updating a github plugin to a revision that adds an sse server names the clone on its partially-upgradable row, under Pi's built-in MCP (MREC-06)
    Given the user's ssh is denied for "github.com"
    Given pi runs with github's requests routed to the git host
    Given the marketplace "gits" is added to the project scope
    Given the user has run "/claude:plugin install ghp@gits --scope project"
    Given the git repository "ghp" holds these plugins:
      | name | version | path |
      | ghp  | 1.1.0   |      |
    Given the git repository "ghp" adds this .mcp.json to the plugin "ghp":
      """
      {"mcpServers": {"events": {"type": "sse", "url": "http://127.0.0.1:9/sse"}}}
      """
    When the user runs "/claude:plugin update ghp@gits --scope project"
    Then the result has these fields:
      | kind         | cascade                             |
      | severity     | warning                             |
      | needs reload | false                               |
      | summary      | A plugin operation needs attention. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id       | name | status               | reasons         | hint           | scope   | version | clone note         | clone url                       |
      | gits             | project           | ghp@gits | ghp  | partially-upgradable | unsupported mcp | partial-update | project | 1.0.0   | ssh-not-configured | https://github.com/acme/ghp.git |
    Then the installation record of the project scope holds these plugins:
      | id       | version | enabled |
      | ghp@gits | 1.0.0   | true    |

  Scenario: Updating a github plugin when the user's ssh authenticates refreshes it over ssh
    Given the user's ssh authenticates to "github.com" as "acme"
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
      | marketplace name | marketplace scope | id       | name | status  | reasons | scope   | from  | to    | clone note | clone url                   |
      | gits             | project           | ghp@gits | ghp  | updated |         | project | 1.0.0 | 2.0.0 | via-ssh    | git@github.com:acme/ghp.git |
    Then the user's ssh receives these launches:
      | argv                                                                                                                |
      | -T -o BatchMode=yes -o ConnectTimeout=2 -o StrictHostKeyChecking=yes git@github.com                                 |
      | -o BatchMode=yes -o StrictHostKeyChecking=yes -o SendEnv=GIT_PROTOCOL git@github.com git-upload-pack 'acme/ghp.git' |
      | -o BatchMode=yes -o StrictHostKeyChecking=yes -o SendEnv=GIT_PROTOCOL git@github.com git-upload-pack 'acme/ghp.git' |
    Then the git host receives no request

  Scenario: An update that moves a github dependency probes once
    Given the git repository "ghd" holds these plugins:
      | name | version | path |
      | ghd  | 1.0.0   |      |
    Given the git repository "ghp" holds these plugins:
      | name | version | path | dependencies |
      | ghp  | 1.0.0   |      | ghd          |
    Given the marketplace "gits" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | ghp  | github      | ghp        | false  |
      | ghd  | github      | ghd        | false  |
    Given the user's ssh authenticates to "github.com" as "acme"
    Given pi runs with github's requests routed to the git host
    Given the marketplace "gits" is added to the project scope
    Given the user has run "/claude:plugin install ghp@gits --scope project"
    Given the git repository "ghd" holds these plugins:
      | name | version | path |
      | ghd  | 2.0.0   |      |
    Given the git repository "ghp" holds these plugins:
      | name | version | path | dependencies |
      | ghp  | 2.0.0   |      | ghd@^2.0.0   |
    When the user runs "/claude:plugin update ghp@gits --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id       | name     | status  | reasons | scope   | from  | to    | cause chain                                                          | cause truncated | leaks | rollback partial | clone note | clone url                   |
      | gits             | project           | ghp@gits | ghp      | updated |         | project | 1.0.0 | 2.0.0 |                                                                      |                 |       |                  | via-ssh    | git@github.com:acme/ghp.git |
      | gits             | project           | ghd@gits | ghd@gits | updated |         | project | 1.0.0 | 2.0.0 | constrained to the combined range (^2.0.0) -- required by "ghp@gits" | false           |       |                  | via-ssh    | git@github.com:acme/ghd.git |
    Then the user's ssh receives these launches:
      | argv                                                                                                                |
      | -T -o BatchMode=yes -o ConnectTimeout=2 -o StrictHostKeyChecking=yes git@github.com                                 |
      | -o BatchMode=yes -o StrictHostKeyChecking=yes -o SendEnv=GIT_PROTOCOL git@github.com git-upload-pack 'acme/ghp.git' |
      | -o BatchMode=yes -o StrictHostKeyChecking=yes -o SendEnv=GIT_PROTOCOL git@github.com git-upload-pack 'acme/ghp.git' |
      | -o BatchMode=yes -o StrictHostKeyChecking=yes -o SendEnv=GIT_PROTOCOL git@github.com git-upload-pack 'acme/ghd.git' |
      | -o BatchMode=yes -o StrictHostKeyChecking=yes -o SendEnv=GIT_PROTOCOL git@github.com git-upload-pack 'acme/ghd.git' |
      | -o BatchMode=yes -o StrictHostKeyChecking=yes -o SendEnv=GIT_PROTOCOL git@github.com git-upload-pack 'acme/ghd.git' |
    Then the git host receives no request

  Scenario: A plugin update whose github marketplace moved names the transport of the marketplace's re-clone
    Given the marketplace "tools" is published as a github source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   |              |
    Given the user's ssh authenticates to "github.com" as "acme"
    Given pi runs with github's requests routed to the git host
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install app@tools --scope project"
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.1.0   |              |
    When the user runs "/claude:plugin update app@tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace clone note | marketplace clone url         | id        | name | status  | reasons | scope   | from  | to    |
      | tools            | project           | via-ssh                | git@github.com:acme/tools.git | app@tools | app  | updated |         | project | 1.0.0 | 1.1.0 |
    Then the git host receives no request

  Scenario: Updating every plugin when only the github marketplace moved names the marketplace's re-clone
    Given the marketplace "tools" is published as a github source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   |              |
    Given the user's ssh authenticates to "github.com" as "acme"
    Given pi runs with github's requests routed to the git host
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install app@tools --scope project"
    Given the marketplace "tools" has the description "Tools after the move"
    When the user runs "/claude:plugin update"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
      | no op        | true    |
    Then the result lists these marketplaces:
      | name  | scope   | clone note | clone url                     |
      | tools | project | via-ssh    | git@github.com:acme/tools.git |
    Then the git host receives no request

  Scenario: Updating every plugin re-clones a github plugin's gone clone at the same commit and names that clone
    Given the user's ssh is denied for "github.com"
    Given pi runs with github's requests routed to the git host
    Given the marketplace "gits" is added to the project scope
    Given the user has run "/claude:plugin install ghp@gits --scope project"
    Given the cached clones of git plugins in the project scope are deleted
    When the user runs "/claude:plugin update"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
      | no op        | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id       | name | status  | reasons    | scope   | clone note         | clone url                       |
      | gits             | project           | ghp@gits | ghp  | skipped | up-to-date | project | ssh-not-configured | https://github.com/acme/ghp.git |

  Scenario: Reinstalling a github plugin with no ssh setting clones it over https first
    Given the user's ssh is denied for "github.com"
    Given pi runs with github's requests routed to the git host
    Given the marketplace "gits" is added to the project scope
    Given the user has run "/claude:plugin install ghp@gits --scope project"
    Given the cached clones of git plugins in the project scope are deleted
    When the user runs "/claude:plugin reinstall ghp@gits --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id       | name | status      | reasons | scope   | version | clone note         | clone url                       |
      | gits             | project           | ghp@gits | ghp  | reinstalled |         | project | 1.0.0   | ssh-not-configured | https://github.com/acme/ghp.git |
    Then the user's ssh receives these launches:
      | argv                                                                                |
      | -T -o BatchMode=yes -o ConnectTimeout=2 -o StrictHostKeyChecking=yes git@github.com |
      | -G git@github.com                                                                   |
    Then the git host receives these requests:
      | method | path                                            | status |
      | GET    | /acme/ghp.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/ghp.git/git-upload-pack                   | 200    |
      | POST   | /acme/ghp.git/git-upload-pack                   | 200    |

  Scenario: Reinstalling a github plugin in both scopes names the clone only on the row of the scope that cloned it
    Given the user's ssh is denied for "github.com"
    Given pi runs with github's requests routed to the git host
    Given the marketplace "gits" is added to the project scope
    Given the marketplace "gits" is added to the user scope
    Given the user has run "/claude:plugin install ghp@gits --scope project"
    Given the user has run "/claude:plugin install ghp@gits --scope user"
    Given the cached clones of git plugins in the project scope are deleted
    When the user runs "/claude:plugin reinstall"
    Then the result has these fields:
      | kind                | cascade          |
      | severity            | info             |
      | needs reload        | true             |
      | tally failures      | 0                |
      | tally label         | Plugin reinstall |
      | tally success count | 2                |
      | tally warnings      | 0                |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id       | name | status      | reasons | scope   | version | clone note         | clone url                       |
      | gits             | project           | ghp@gits | ghp  | reinstalled |         | project | 1.0.0   | ssh-not-configured | https://github.com/acme/ghp.git |
      | gits             | user              | ghp@gits | ghp  | reinstalled |         | user    | 1.0.0   |                    |                                 |

  Scenario: Reinstalling a github plugin whose dependent holds its new revision names the clone on its skipped row
    Given the marketplace "gits" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | ghp@^1.0.0   |
    Given the marketplace "gits" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | ghp  | github      | ghp        | false  |
    Given the user's ssh is denied for "github.com"
    Given pi runs with github's requests routed to the git host
    Given the marketplace "gits" is added to the project scope
    Given the user has run "/claude:plugin install ghp@gits --scope project"
    Given the user has run "/claude:plugin install app@gits --scope project"
    Given the git repository "ghp" holds these plugins:
      | name | version | path |
      | ghp  | 2.0.0   |      |
    Given the cached clones of git plugins in the project scope are deleted
    When the user runs "/claude:plugin reinstall ghp@gits --scope project"
    Then the result has these fields:
      | kind         | cascade                             |
      | severity     | warning                             |
      | needs reload | false                               |
      | summary      | A plugin operation needs attention. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id       | name | status  | reasons              | scope   | cause chain                                                                                   | cause truncated | leaks | rollback partial | clone note         | clone url                       |
      | gits             | project           | ghp@gits | ghp  | skipped | dependents constrain | project | version 2.0.0 falls outside what the combined range admits (^1.0.0) -- required by "app@gits" | false           |       |                  | ssh-not-configured | https://github.com/acme/ghp.git |
    Then the installation record of the project scope holds these plugins:
      | id       | version | enabled |
      | app@gits | 1.0.0   | true    |
      | ghp@gits | 1.0.0   | true    |

  Scenario: Fetching a github plugin with no ssh setting clones it over https first
    Given the user's ssh is denied for "github.com"
    Given pi runs with github's requests routed to the git host
    Given the marketplace "gits" is added to the project scope
    When the user runs "/claude:plugin fetch ghp@gits --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id       | name | status    | reasons | version | clone note         | clone url                       |
      | gits             | project           | ghp@gits | ghp  | available |         | 1.0.0   | ssh-not-configured | https://github.com/acme/ghp.git |
    Then the user's ssh receives these launches:
      | argv                                                                                |
      | -T -o BatchMode=yes -o ConnectTimeout=2 -o StrictHostKeyChecking=yes git@github.com |
      | -G git@github.com                                                                   |
    Then the git host receives these requests:
      | method | path                                            | status |
      | GET    | /acme/ghp.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/ghp.git/git-upload-pack                   | 200    |
      | POST   | /acme/ghp.git/git-upload-pack                   | 200    |

  Scenario: Info with --fetch on a github plugin with no ssh setting clones it over https first
    Given the user's ssh is denied for "github.com"
    Given pi runs with github's requests routed to the git host
    Given the marketplace "gits" is added to the project scope
    When the user runs "/claude:plugin info ghp@gits --fetch"
    Then the result has these fields:
      | kind                           | plugin-info                     |
      | marketplace details autoupdate | false                           |
      | marketplace name               | gits                            |
      | marketplace scope              | project                         |
      | needs reload                   | false                           |
      | plugin clone note              | ssh-not-configured              |
      | plugin clone url               | https://github.com/acme/ghp.git |
      | plugin components resolved     | true                            |
      | plugin components skills       | ghp-skill                       |
      | plugin id                      | ghp@gits                        |
      | plugin name                    | ghp                             |
      | plugin reasons                 |                                 |
      | plugin status                  | available                       |
      | plugin version                 | 1.0.0                           |
      | severity                       | info                            |
    Then the user's ssh receives these launches:
      | argv                                                                                |
      | -T -o BatchMode=yes -o ConnectTimeout=2 -o StrictHostKeyChecking=yes git@github.com |
      | -G git@github.com                                                                   |
    Then the git host receives these requests:
      | method | path                                            | status |
      | GET    | /acme/ghp.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/ghp.git/git-upload-pack                   | 200    |
      | POST   | /acme/ghp.git/git-upload-pack                   | 200    |

  Scenario: Enabling a github plugin whose clone is gone falls back to https for a user with no ssh key
    Given the user's ssh is denied for "github.com"
    Given pi runs with github's requests routed to the git host
    Given the marketplace "gits" is added to the user scope
    Given the user has run "/claude:plugin install ghp@gits --scope user"
    Given the user has run "/claude:plugin disable ghp@gits --scope user"
    Given the cached clones of git plugins in the user scope are deleted
    When the user runs "/claude:plugin enable ghp@gits --scope user"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id       | name | status    | reasons | scope | version | clone note         | clone url                       |
      | gits             | user              | ghp@gits | ghp  | installed |         | user  | 1.0.0   | ssh-not-configured | https://github.com/acme/ghp.git |
    Then the installation record of the user scope holds these plugins:
      | id       | version | enabled |
      | ghp@gits | 1.0.0   | true    |
    Then the user's ssh receives these launches:
      | argv                                                                                |
      | -T -o BatchMode=yes -o ConnectTimeout=2 -o StrictHostKeyChecking=yes git@github.com |
      | -G git@github.com                                                                   |
    Then the git host receives these requests:
      | method | path                                            | status |
      | GET    | /acme/ghp.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/ghp.git/git-upload-pack                   | 200    |
      | POST   | /acme/ghp.git/git-upload-pack                   | 200    |
      | GET    | /acme/ghp.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/ghp.git/git-upload-pack                   | 200    |
      | POST   | /acme/ghp.git/git-upload-pack                   | 200    |

  Scenario: Enabling a plugin whose re-enabled github dependency cannot be cloned names that dependency's clone on the plugin's failed row
    Given the marketplace "gits" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | ghp          |
    Given the marketplace "gits" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | ghp  | github      | ghp        | false  |
    Given the user's ssh is denied for "github.com"
    Given pi runs with github's requests routed to the git host
    Given the marketplace "gits" is added to the project scope
    Given the user has run "/claude:plugin install app@gits --scope project"
    Given the user has run "/claude:plugin disable app@gits --scope project"
    Given the user has run "/claude:plugin disable ghp@gits --scope project"
    Given the cached clones of git plugins in the project scope are deleted
    Given the git host answers 404 for the plugin "ghp"
    When the user runs "/claude:plugin enable app@gits --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id       | name | status | reasons | scope   | version | cause chain                                                                                                                                                                                                                                                                                                                                                                                                                                     | cause truncated | leaks | rollback partial | clone note         | clone url                       | clone retries               | clone plugin |
      | gits             | project           | app@gits | app  | failed |         | project | 1.0.0   | git clone --depth failed: repository-not-found, exit code 128\nThe retry over SSH failed too: git clone --depth failed: ssh-auth, exit code 128\nCheck the repository and ref in the marketplace entry and that github.com can be reached. If the repository is private, add an SSH key to your GitHub account or set up a git credential helper for https://github.com. Then install again., git clone --depth failed: ssh-auth, exit code 128 | false           |       |                  | ssh-not-configured | https://github.com/acme/ghp.git | git@github.com:acme/ghp.git | ghp@gits     |
    Then the installation record of the project scope holds these plugins:
      | id       | version | enabled |
      | app@gits | 1.0.0   | false   |
      | ghp@gits | 1.0.0   | false   |

  Scenario: Enabling a github plugin whose installation record can be read but no longer saved names its clone on the failed row
    Given the user's ssh is denied for "github.com"
    Given pi runs with github's requests routed to the git host
    Given the marketplace "gits" is added to the project scope
    Given the user has run "/claude:plugin install ghp@gits --scope project"
    Given the user has run "/claude:plugin disable ghp@gits --scope project"
    Given the cached clones of git plugins in the project scope are deleted
    Given the installation record of the project scope can be read but no longer saved
    When the user runs "/claude:plugin enable ghp@gits --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id       | name | status | reasons | scope   | cause chain                      | cause truncated | leaks | rollback partial | clone note         | clone url                       |
      | gits             | project           | ghp@gits | ghp  | failed |         | project | {installation record save error} | false           |       |                  | ssh-not-configured | https://github.com/acme/ghp.git |
