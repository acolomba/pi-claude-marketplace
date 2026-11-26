Feature: Marketplace url source

  A url source is an https git URL that Pi clones the marketplace from.
  The scenarios run the real extension in a headless Pi against a loopback
  https git host that records every request it receives.

  Scenario: Adding a url marketplace clones it from the git host
    Given the marketplace "tools" is published as a url source
    When the user runs "/claude:plugin marketplace add https://{git host}/acme/tools.git --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope   | status |
      | tools | project | added  |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name  | source                            |
      | tools | https://{git host}/acme/tools.git |
    Then the git host receives these requests:
      | method | path                                              | status |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/tools.git/git-upload-pack                   | 200    |
      | POST   | /acme/tools.git/git-upload-pack                   | 200    |

  Scenario: Adding a github url marketplace whose url holds a token shows the url redacted in its clone line
    Given the marketplace "tools" is published as a github source
    When the user runs "/claude:plugin marketplace add https://x-access-token:tok123secret@github.com/acme/tools.git --scope project" in pi's terminal
    Then pi's terminal shows this result of the command:
      """
      ● tools [project] (added)
        Cloning via HTTPS: https://***@github.com/acme/tools.git
      """
    Then the git host receives these requests:
      | method | path                                              | status |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/tools.git/git-upload-pack                   | 200    |
      | POST   | /acme/tools.git/git-upload-pack                   | 200    |

  Scenario: Adding a marketplace from an http:// github address names its clone as http
    Given the marketplace "tools" is published as a github source
    When the user runs "/claude:plugin marketplace add http://github.com/acme/tools.git --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope   | status | clone note | clone url                        |
      | tools | project | added  | via-http   | http://github.com/acme/tools.git |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name  | source                           |
      | tools | http://github.com/acme/tools.git |

  Scenario: Adding a url marketplace outside github ignores an invalid github base address
    Given pi runs with the github base address "http://example.invalid"
    Given the marketplace "tools" is published as a url source
    When the user runs "/claude:plugin marketplace add https://{git host}/acme/tools.git --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope   | status |
      | tools | project | added  |
    Then the git host receives these requests:
      | method | path                                              | status |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/tools.git/git-upload-pack                   | 200    |
      | POST   | /acme/tools.git/git-upload-pack                   | 200    |

  Scenario: A url source is cloned at exactly the url typed
    Given the marketplace "tools" is published as a url source
    When the user runs "/claude:plugin marketplace add https://{git host}/acme/tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope   | status |
      | tools | project | added  |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name  | source                        |
      | tools | https://{git host}/acme/tools |
    Then the git host receives these requests:
      | method | path                                          | status |
      | GET    | /acme/tools/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/tools/git-upload-pack                   | 200    |
      | POST   | /acme/tools/git-upload-pack                   | 200    |

  Scenario: Adding a url marketplace at a ref clones that ref
    Given the marketplace "tools" is published as a url source
    Given the marketplace "tools" has the description "Tools for formatting"
    Given the branch "stable" of the marketplace "tools" has the description "Stable tools"
    When the user runs "/claude:plugin marketplace add https://{git host}/acme/tools.git#stable --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope   | status |
      | tools | project | added  |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name  | source                                   |
      | tools | https://{git host}/acme/tools.git#stable |
    Then the git host receives these requests:
      | method | path                                              | status |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/tools.git/git-upload-pack                   | 200    |
      | POST   | /acme/tools.git/git-upload-pack                   | 200    |
    When the user runs "/claude:plugin marketplace info tools --scope project"
    Then the marketplace info result has these fields:
      | kind                    | marketplace-info              |
      | name                    | tools                         |
      | scope                   | project                       |
      | details autoupdate      | false                         |
      | details last updated at | {scenario time}               |
      | source kind             | url                           |
      | source abs path         |                               |
      | source url              | https://{git host}/acme/tools |
      | source owner            |                               |
      | source repo             |                               |
      | source ref              | stable                        |
      | description             | Stable tools                  |
      | severity                | info                          |
      | needs reload            | false                         |

  Scenario: Adding a url marketplace the git host answers with 404 fails as source missing
    Given the marketplace "tools" is published as a url source
    Given the git host answers 404 for the marketplace "tools"
    When the user runs "/claude:plugin marketplace add https://{git host}/acme/tools.git --scope project"
    Then the result has these fields:
      | kind         | cascade                             |
      | severity     | error                               |
      | needs reload | false                               |
      | summary      | A marketplace operation has failed. |
    Then the result lists these marketplaces:
      | name                              | scope   | status | reasons        |
      | https://{git host}/acme/tools.git | project | failed | source missing |
    Then the "claude-plugins.json" file of the project scope does not exist
    Then the git host receives these requests:
      | method | path                                              | status |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 404    |

  Scenario: Adding a url marketplace at a ref the repository lacks fails as source missing
    Given the marketplace "tools" is published as a url source
    When the user runs "/claude:plugin marketplace add https://{git host}/acme/tools.git#missing --scope project"
    Then the result has these fields:
      | kind         | cascade                             |
      | severity     | error                               |
      | needs reload | false                               |
      | summary      | A marketplace operation has failed. |
    Then the result lists these marketplaces:
      | name                                      | scope   | status | reasons        |
      | https://{git host}/acme/tools.git#missing | project | failed | source missing |
    Then the "claude-plugins.json" file of the project scope does not exist
    Then the git host receives these requests:
      | method | path                                              | status |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/tools.git/git-upload-pack                   | 200    |

  Scenario: Adding a marketplace whose ref starts with a dash is refused before git runs
    Given the marketplace "tools" is published as a url source
    When the user runs "/claude:plugin marketplace add https://{git host}/acme/tools.git#-x --scope project"
    Then the result has these fields:
      | kind         | cascade                             |
      | severity     | error                               |
      | needs reload | false                               |
      | summary      | A marketplace operation has failed. |
    Then the result lists these marketplaces:
      | name                                 | scope   | status | reasons            |
      | https://{git host}/acme/tools.git#-x | project | failed | unsupported source |
    Then the "claude-plugins.json" file of the project scope does not exist
    Then the git host receives no request

  Scenario: Adding a url marketplace whose ref is a commit id with capital letters is refused before git runs
    Given the marketplace "tools" is published as a url source
    When the user runs "/claude:plugin marketplace add https://{git host}/acme/tools.git#0123456789ABCDEF0123456789abcdef01234567 --scope project"
    Then the result has these fields:
      | kind         | cascade                      |
      | severity     | error                        |
      | needs reload | false                        |
      | summary      | Some operations have failed. |
    Then the result lists these plugins:
      | marketplace name                                                           | marketplace scope | marketplace status | id                                                                         | name                                                                       | status | reasons            | scope   | leaks | rollback partial | cause chain                                                                                                                                                                                                                                                                               | cause truncated |
      | https://{git host}/acme/tools.git#0123456789ABCDEF0123456789abcdef01234567 | project           | failed             | https://{git host}/acme/tools.git#0123456789ABCDEF0123456789abcdef01234567 | https://{git host}/acme/tools.git#0123456789ABCDEF0123456789abcdef01234567 | failed | unsupported source | project |       |                  | Cannot add marketplace from "https://{git host}/acme/tools.git#0123456789ABCDEF0123456789abcdef01234567": the ref "0123456789ABCDEF0123456789abcdef01234567" looks like a commit id with capital letters, which git would read as a branch name that can move; write the id in lower case | false           |
    Then the project scope holds no marketplace record
    Then the project scope holds no marketplace checkout
    Then the "claude-plugins.json" file of the project scope does not exist
    Then the git host receives no request

  Scenario: Adding a url marketplace whose ref is a lower-case commit id fails as a missing ref
    Given the marketplace "tools" is published as a url source
    When the user runs "/claude:plugin marketplace add https://{git host}/acme/tools.git#0123456789abcdef0123456789abcdef01234567 --scope project"
    Then the result has these fields:
      | kind         | cascade                             |
      | severity     | error                               |
      | needs reload | false                               |
      | summary      | A marketplace operation has failed. |
    Then the result lists these marketplaces:
      | name                                                                       | scope   | status | reasons        |
      | https://{git host}/acme/tools.git#0123456789abcdef0123456789abcdef01234567 | project | failed | source missing |
    Then the project scope holds no marketplace record
    Then the project scope holds no marketplace checkout
    Then the "claude-plugins.json" file of the project scope does not exist
    Then the git host receives these requests:
      | method | path                                              | status |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/tools.git/git-upload-pack                   | 200    |

  Scenario: Adding a url marketplace whose connection drops fails as network unreachable
    Given the marketplace "tools" is published as a url source
    Given the git host drops the connection for the marketplace "tools"
    When the user runs "/claude:plugin marketplace add https://{git host}/acme/tools.git --scope project"
    Then the result has these fields:
      | kind         | cascade                             |
      | severity     | error                               |
      | needs reload | false                               |
      | summary      | A marketplace operation has failed. |
    Then the result lists these marketplaces:
      | name                              | scope   | status | reasons             |
      | https://{git host}/acme/tools.git | project | failed | network unreachable |
    Then the "claude-plugins.json" file of the project scope does not exist
    Then the git host receives these requests:
      | method | path                                              | status  |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | dropped |

  Scenario: Adding a marketplace from an http:// git address reaches git instead of being refused
    Given the marketplace "tools" is published as a url source
    When the user runs "/claude:plugin marketplace add http://{git host}/acme/tools.git --scope project"
    Then the result has these fields:
      | kind         | cascade                             |
      | severity     | error                               |
      | needs reload | false                               |
      | summary      | A marketplace operation has failed. |
    Then the result lists these marketplaces:
      | name                             | scope   | status | reasons             |
      | http://{git host}/acme/tools.git | project | failed | network unreachable |
    Then the "claude-plugins.json" file of the project scope does not exist
    Then the git host accepts 1 connection and receives no request

  Scenario Outline: Adding a url marketplace the git host answers with a server error fails as network error
    Given the marketplace "tools" is published as a url source
    Given the git host answers <status> for the marketplace "tools"
    When the user runs "/claude:plugin marketplace add https://{git host}/acme/tools.git --scope project"
    Then the result has these fields:
      | kind         | cascade                      |
      | severity     | error                        |
      | needs reload | false                        |
      | summary      | Some operations have failed. |
    Then the result lists these plugins:
      | marketplace name                  | marketplace scope | marketplace status | id                                | name                              | status | reasons       | scope   | leaks | rollback partial | cause chain                                                                                     | cause truncated |
      | https://{git host}/acme/tools.git | project           | failed             | https://{git host}/acme/tools.git | https://{git host}/acme/tools.git | failed | network error | project |       |                  | <status> on https://{git host}/acme/tools.git, git clone --depth failed: network, exit code 128 | false           |
    Then the "claude-plugins.json" file of the project scope does not exist
    Then the git host receives these requests:
      | method | path                                              | status   |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | <status> |

    Examples:
      | status |
      | 500    |
      | 502    |
      | 503    |

  Scenario: Adding with --local a url marketplace that the base layer declares makes no second clone and no git request (LAYER-01)
    Given the marketplace "tools" is published as a url source
    Given the marketplace "tools" is added to the project scope
    Given the config and installation record bytes of the project scope are remembered
    When the user runs "/claude:plugin marketplace add https://{git host}/acme/tools.git --scope project --local"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope   | status |
      | tools | project | added  |
    Then the git host receives no request
    Then the project scope holds these git clones:
      | clone       | origin                            | revision |
      | marketplace | https://{git host}/acme/tools.git |          |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name  | source                            |
      | tools | https://{git host}/acme/tools.git |
    Then the "claude-plugins.local.json" file of the project scope declares these marketplaces:
      | name  | source                            |
      | tools | https://{git host}/acme/tools.git |
    Then the config and installation record bytes of the project scope are unchanged

  Scenario: Adding again a url marketplace that the scope records but no layer declares declares it with no git request (D-09)
    Given the marketplace "tools" is published as a url source
    Given the marketplace "tools" is added to the project scope
    Given a config in scope project and layer base, with this text:
      """
      { "schemaVersion": 1, "marketplaces": {} }
      """
    Given the installation record bytes of the project scope are remembered
    When the user runs "/claude:plugin marketplace add https://{git host}/acme/tools.git --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope   | status |
      | tools | project | added  |
    Then the git host receives no request
    Then the project scope holds these git clones:
      | clone       | origin                            | revision |
      | marketplace | https://{git host}/acme/tools.git |          |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name  | source                            |
      | tools | https://{git host}/acme/tools.git |
    Then the "claude-plugins.local.json" file of the project scope does not exist
    Then the installation record bytes of the project scope are unchanged

  Scenario Outline: Installing a pinned plugin from the repository of a url marketplace clones it and fetches its commit, which the depth-1 checkout of the add lacks (D-SEED-01, SG-TRN-02)
    Given the marketplace "tools" is published as a url source
    Given the marketplace "tools" offers these plugins from its own repository:
      | name | version | url          | pinned |
      | demo | 1.0.0   | <plugin url> | true   |
    Given the marketplace "tools" is added to the project scope
    When the user runs "/claude:plugin install demo@tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id         | name | status    | reasons | scope   | version |
      | tools            | project           | demo@tools | demo | installed |         | project | 1.0.0   |
    Then the git host receives these requests:
      | method | path                                                 | status |
      | GET    | /acme/<repository>/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/<repository>/git-upload-pack                   | 200    |
      | POST   | /acme/<repository>/git-upload-pack                   | 200    |
      | GET    | /acme/<repository>/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/<repository>/git-upload-pack                   | 200    |
      | POST   | /acme/<repository>/git-upload-pack                   | 200    |

    Examples:
      | plugin url                         | repository |
      | https://{git host}/acme/tools      | tools      |
      | https://{git host}/acme/tools.git  | tools.git  |
      | https://{git host}/acme/tools/     | tools      |
      | https://{git host}/acme/tools.git/ | tools.git  |

  Scenario Outline: A plugin from the repository of a url marketplace lists as available right after the add (D-SEED-01)
    Given the marketplace "tools" is published as a url source
    Given the marketplace "tools" offers these plugins from its own repository:
      | name | version | url          | pinned |
      | demo | 1.0.0   | <plugin url> | false  |
    Given the marketplace "tools" is added to the project scope
    When the user runs "/claude:plugin list --scope project"
    Then the result has these fields:
      | kind                | cascade     |
      | severity            | info        |
      | needs reload        | false       |
      | tally label         | Plugin list |
      | tally failures      | 0           |
      | tally warnings      | 0           |
      | tally success count | 1           |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id         | name | status    | reasons | version |
      | tools            | project           | demo@tools | demo | available |         | 1.0.0   |

    Examples:
      | plugin url                         |
      | https://{git host}/acme/tools      |
      | https://{git host}/acme/tools.git  |
      | https://{git host}/acme/tools/     |
      | https://{git host}/acme/tools.git/ |
