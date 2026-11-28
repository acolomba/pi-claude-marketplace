Feature: Marketplace git source

  A git marketplace is cloned when it is added and cloned again when an update finds its remote moved,
  with the user's stored credential if the host asks for one, and fails without it. Listing, inspecting, and removing it read
  only local state. The scenarios run a headless Pi against a loopback https git host.

  Scenario Outline: A removed git marketplace can be added again from the same source
    Given the marketplace "tools" is published as a <source kind> source
    Given the marketplace "tools" is added to the <scope> scope
    Given the user has run "/claude:plugin marketplace remove tools --scope <scope>"
    When the user runs "/claude:plugin marketplace add <source> --scope <scope>"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope   | status |
      | tools | <scope> | added  |
    Then the "claude-plugins.json" file of the <scope> scope declares these marketplaces:
      | name  | source   |
      | tools | <source> |
    Then the git host receives these requests:
      | method | path                                                | status |
      | GET    | <repository path>/info/refs?service=git-upload-pack | 200    |
      | POST   | <repository path>/git-upload-pack                   | 200    |
      | POST   | <repository path>/git-upload-pack                   | 200    |

    @url
    Examples:
      | source kind | scope   | source                            | repository path |
      | url         | project | https://{git host}/acme/tools.git | /acme/tools.git |
      | url         | user    | https://{git host}/acme/tools.git | /acme/tools.git |

  Scenario Outline: A removed github marketplace can be added again from the same source and names its clone transport
    Given the marketplace "tools" is published as a <source kind> source
    Given the marketplace "tools" is added to the <scope> scope
    Given the user has run "/claude:plugin marketplace remove tools --scope <scope>"
    When the user runs "/claude:plugin marketplace add <source> --scope <scope>"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope   | status | clone note | clone url                         |
      | tools | <scope> | added  | via-https  | https://github.com/acme/tools.git |
    Then the "claude-plugins.json" file of the <scope> scope declares these marketplaces:
      | name  | source   |
      | tools | <source> |
    Then the git host receives these requests:
      | method | path                                                | status |
      | GET    | <repository path>/info/refs?service=git-upload-pack | 200    |
      | POST   | <repository path>/git-upload-pack                   | 200    |
      | POST   | <repository path>/git-upload-pack                   | 200    |

    @github
    Examples:
      | source kind | scope   | source     | repository path |
      | github      | project | acme/tools | /acme/tools.git |
      | github      | user    | acme/tools | /acme/tools.git |

  Scenario Outline: Listing git marketplaces makes no request to the git host
    Given the marketplace "tools" is published as a <source kind> source
    Given the marketplace "tools" is added to the <scope> scope
    When the user runs "/claude:plugin marketplace list --scope <scope>"
    Then the result has these fields:
      | kind                | cascade          |
      | severity            | info             |
      | needs reload        | false            |
      | tally label         | Marketplace list |
      | tally failures      | 0                |
      | tally warnings      | 0                |
      | tally success count | 1                |
    Then the result lists these marketplaces:
      | name  | scope   | details autoupdate | details last updated at |
      | tools | <scope> | false              | {scenario time}         |
    Then the git host receives no request

    @url
    Examples:
      | source kind | scope   |
      | url         | project |
      | url         | user    |

    @github
    Examples:
      | source kind | scope   |
      | github      | project |
      | github      | user    |

  Scenario Outline: Info on a git marketplace makes no request to the git host
    Given the marketplace "tools" is published as a <source kind> source
    Given the marketplace "tools" is added to the <scope> scope
    When the user runs "/claude:plugin marketplace info tools --scope <scope>"
    Then the marketplace info result has these fields:
      | kind                    | marketplace-info       |
      | name                    | tools                  |
      | scope                   | <scope>                |
      | details autoupdate      | false                  |
      | details last updated at | {scenario time}        |
      | source kind             | <expected source kind> |
      | source abs path         |                        |
      | source url              | <source url>           |
      | source owner            | <source owner>         |
      | source repo             | <source repo>          |
      | source ref              |                        |
      | severity                | info                   |
      | needs reload            | false                  |
    Then the git host receives no request

    @url
    Examples:
      | source kind | scope   | expected source kind | source url                    | source owner | source repo |
      | url         | project | url                  | https://{git host}/acme/tools |              |             |
      | url         | user    | url                  | https://{git host}/acme/tools |              |             |

    @github
    Examples:
      | source kind | scope   | expected source kind | source url | source owner | source repo |
      | github      | project | github               |            | acme         | tools       |
      | github      | user    | github               |            | acme         | tools       |

  Scenario Outline: Removing a git marketplace makes no request to the git host
    Given the marketplace "tools" is published as a <source kind> source
    Given the marketplace "tools" is added to the <scope> scope
    When the user runs "/claude:plugin marketplace remove tools --scope <scope>"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope   | status  |
      | tools | <scope> | removed |
    Then the git host receives no request

    @url
    Examples:
      | source kind | scope   |
      | url         | project |
      | url         | user    |

    @github
    Examples:
      | source kind | scope   |
      | github      | project |
      | github      | user    |

  Scenario: Adding a url marketplace that needs a credential fails as authentication required without one
    Given the marketplace "tools" is published as a url source
    Given the git host requires the user "alice" with the password "s3cret" for the marketplace "tools"
    When the user runs "/claude:plugin marketplace add https://{git host}/acme/tools.git --scope project"
    Then the result has these fields:
      | kind         | cascade                             |
      | severity     | error                               |
      | needs reload | false                               |
      | summary      | A marketplace operation has failed. |
    Then the result lists these marketplaces:
      | name                              | scope   | status | reasons                 |
      | https://{git host}/acme/tools.git | project | failed | authentication required |
    Then the "claude-plugins.json" file of the project scope does not exist
    Then the git host receives these requests:
      | method | path                                              | status |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 401    |

  Scenario: A url marketplace that needs a credential fails as authentication required without running the user's askpass program
    Given the marketplace "tools" is published as a url source
    Given the git host requires the user "alice" with the password "s3cret" for the marketplace "tools"
    Given the user's git configuration names an askpass program that answers the user "alice" with the password "s3cret"
    When the user runs "/claude:plugin marketplace add https://{git host}/acme/tools.git --scope project"
    Then the result has these fields:
      | kind         | cascade                             |
      | severity     | error                               |
      | needs reload | false                               |
      | summary      | A marketplace operation has failed. |
    Then the result lists these marketplaces:
      | name                              | scope   | status | reasons                 |
      | https://{git host}/acme/tools.git | project | failed | authentication required |
    Then the "claude-plugins.json" file of the project scope does not exist
    Then the askpass program has recorded no run
    Then the git host receives these requests:
      | method | path                                              | status |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 401    |

  Scenario: A url marketplace that needs a credential fails as authentication required without asking the project's credential helper
    Given the marketplace "tools" is published as a url source
    Given the git host requires the user "alice" with the password "s3cret" for the marketplace "tools"
    Given the project is a git repository whose own configuration names a credential helper that answers the user "alice" with the password "s3cret"
    When the user runs "/claude:plugin marketplace add https://{git host}/acme/tools.git --scope project"
    Then the result has these fields:
      | kind         | cascade                             |
      | severity     | error                               |
      | needs reload | false                               |
      | summary      | A marketplace operation has failed. |
    Then the result lists these marketplaces:
      | name                              | scope   | status | reasons                 |
      | https://{git host}/acme/tools.git | project | failed | authentication required |
    Then the "claude-plugins.json" file of the project scope does not exist
    Then the credential helper has recorded no run
    Then the git host receives these requests:
      | method | path                                              | status |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 401    |

  Scenario Outline: Adding a github marketplace that needs a credential fails as authentication required without one
    Given the marketplace "tools" is published as a <source kind> source
    Given the git host requires the user "alice" with the password "s3cret" for the marketplace "tools"
    When the user runs "/claude:plugin marketplace add <source> --scope project"
    Then the result has these fields:
      | kind         | cascade                      |
      | severity     | error                        |
      | needs reload | false                        |
      | summary      | Some operations have failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace status | id       | name     | status | reasons                 | scope   | leaks | rollback partial | cause chain                                                                                    | cause truncated | marketplace clone note | marketplace clone url             |
      | <source>         | project           | failed             | <source> | <source> | failed | authentication required | project |       |                  | git clone --depth failed: https-auth, exit code 128, fetched https://{git host}/acme/tools.git | false           | via-https              | https://github.com/acme/tools.git |
    Then the "claude-plugins.json" file of the project scope does not exist
    Then the git host receives these requests:
      | method | path                                              | status |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 401    |

    @github
    Examples:
      | source kind | source                            |
      | github      | acme/tools                        |
      | github      | https://github.com/acme/tools     |
      | github      | https://github.com/acme/tools.git |

  Scenario Outline: Adding a git marketplace with a stored credential clones it
    Given the marketplace "tools" is published as a <source kind> source
    Given the git host requires the user "alice" with the password "s3cret" for the marketplace "tools"
    Given the user has stored a credential for the git host with the user "alice" and the password "s3cret"
    When the user runs "/claude:plugin marketplace add <source> --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope   | status |
      | tools | project | added  |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name  | source   |
      | tools | <source> |
    Then the git host receives these requests:
      | method | path                                              | status |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 401    |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/tools.git/git-upload-pack                   | 200    |
      | POST   | /acme/tools.git/git-upload-pack                   | 200    |

    @url
    Examples:
      | source kind | source                            |
      | url         | https://{git host}/acme/tools.git |

  Scenario Outline: Adding a github marketplace with a stored credential clones it and names its clone transport
    Given the marketplace "tools" is published as a <source kind> source
    Given the git host requires the user "alice" with the password "s3cret" for the marketplace "tools"
    Given the user has stored a credential for the git host with the user "alice" and the password "s3cret"
    When the user runs "/claude:plugin marketplace add <source> --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope   | status | clone note | clone url                         |
      | tools | project | added  | via-https  | https://github.com/acme/tools.git |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name  | source   |
      | tools | <source> |
    Then the git host receives these requests:
      | method | path                                              | status |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 401    |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/tools.git/git-upload-pack                   | 200    |
      | POST   | /acme/tools.git/git-upload-pack                   | 200    |

    @github
    Examples:
      | source kind | source                        |
      | github      | acme/tools                    |
      | github      | https://github.com/acme/tools |

  Scenario Outline: Updating a git marketplace whose host now needs a credential fails as authentication required
    Given the marketplace "tools" is published as a <source kind> source
    Given the user has run "/claude:plugin marketplace add <source> --scope project"
    Given the git host requires the user "alice" with the password "s3cret" for the marketplace "tools"
    When the user runs "/claude:plugin marketplace update tools --scope project"
    Then the result has these fields:
      | kind         | cascade                      |
      | severity     | error                        |
      | needs reload | false                        |
      | summary      | Some operations have failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace status | id    | name  | status | reasons                 | scope   | leaks | rollback partial | cause chain   | cause truncated |
      | tools            | project           | failed             | tools | tools | failed | authentication required | project |       |                  | <cause chain> | false           |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name  | source   |
      | tools | <source> |
    Then the git host receives these requests:
      | method | path                                              | status |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 401    |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 401    |

    @url
    Examples:
      | source kind | source                            | cause chain                                                                                                                                                                                                                                   |
      | url         | https://{git host}/acme/tools.git | Failed to update marketplace "tools"., git ls-remote failed: https-auth, exit code 128, no credential was obtained for {git host}; store one with: printf 'protocol=https\\nhost={git host}\\nusername=<user>\\npassword=<token>\\n\\n' \| git credential approve |

  Scenario Outline: Updating a github marketplace whose host now needs a credential fails as authentication required and names the clone it tried
    Given the marketplace "tools" is published as a <source kind> source
    Given the user has run "/claude:plugin marketplace add <source> --scope project"
    Given the git host requires the user "alice" with the password "s3cret" for the marketplace "tools"
    When the user runs "/claude:plugin marketplace update tools --scope project"
    Then the result has these fields:
      | kind         | cascade                      |
      | severity     | error                        |
      | needs reload | false                        |
      | summary      | Some operations have failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace status | id    | name  | status | reasons                 | scope   | leaks | rollback partial | cause chain   | cause truncated | marketplace clone note | marketplace clone url             |
      | tools            | project           | failed             | tools | tools | failed | authentication required | project |       |                  | <cause chain> | false           | via-https              | https://github.com/acme/tools.git |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name  | source   |
      | tools | <source> |
    Then the git host receives these requests:
      | method | path                                              | status |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 401    |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 401    |

    @github
    Examples:
      | source kind | source                        | cause chain                                                                                                                                                                                                                                                                              |
      | github      | acme/tools                    | Failed to update marketplace "tools"., git ls-remote failed: https-auth, exit code 128, no credential was obtained for {git host}; store one with: printf 'protocol=https\\nhost={git host}\\nusername=<user>\\npassword=<token>\\n\\n' \| git credential approve, fetched https://{git host}/acme/tools.git |
      | github      | https://github.com/acme/tools | Failed to update marketplace "tools"., git ls-remote failed: https-auth, exit code 128, no credential was obtained for {git host}; store one with: printf 'protocol=https\\nhost={git host}\\nusername=<user>\\npassword=<token>\\n\\n' \| git credential approve, fetched https://{git host}/acme/tools.git |

  Scenario Outline: Updating a git marketplace whose host rejects the stored credential fails as authentication required
    Given the marketplace "tools" is published as a <source kind> source
    Given the user has run "/claude:plugin marketplace add <source> --scope project"
    Given the git host requires the user "alice" with the password "s3cret" for the marketplace "tools"
    Given the user has stored a credential for the git host with the user "alice" and the password "expired"
    When the user runs "/claude:plugin marketplace update tools --scope project"
    Then the result has these fields:
      | kind         | cascade                      |
      | severity     | error                        |
      | needs reload | false                        |
      | summary      | Some operations have failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace status | id    | name  | status | reasons                 | scope   | leaks | rollback partial | cause chain   | cause truncated |
      | tools            | project           | failed             | tools | tools | failed | authentication required | project |       |                  | <cause chain> | false           |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name  | source   |
      | tools | <source> |
    Then the git host receives these requests:
      | method | path                                              | status |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 401    |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 401    |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 401    |

    @url
    Examples:
      | source kind | source                            | cause chain                                                                            |
      | url         | https://{git host}/acme/tools.git | Failed to update marketplace "tools"., git ls-remote failed: https-auth, exit code 128 |

  Scenario Outline: Updating a github marketplace whose host rejects the stored credential fails as authentication required and names the clone it tried
    Given the marketplace "tools" is published as a <source kind> source
    Given the user has run "/claude:plugin marketplace add <source> --scope project"
    Given the git host requires the user "alice" with the password "s3cret" for the marketplace "tools"
    Given the user has stored a credential for the git host with the user "alice" and the password "expired"
    When the user runs "/claude:plugin marketplace update tools --scope project"
    Then the result has these fields:
      | kind         | cascade                      |
      | severity     | error                        |
      | needs reload | false                        |
      | summary      | Some operations have failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace status | id    | name  | status | reasons                 | scope   | leaks | rollback partial | cause chain   | cause truncated | marketplace clone note | marketplace clone url             |
      | tools            | project           | failed             | tools | tools | failed | authentication required | project |       |                  | <cause chain> | false           | via-https              | https://github.com/acme/tools.git |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name  | source   |
      | tools | <source> |
    Then the git host receives these requests:
      | method | path                                              | status |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 401    |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 401    |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 401    |

    @github
    Examples:
      | source kind | source                        | cause chain                                                                                                                       |
      | github      | acme/tools                    | Failed to update marketplace "tools"., git ls-remote failed: https-auth, exit code 128, fetched https://{git host}/acme/tools.git |
      | github      | https://github.com/acme/tools | Failed to update marketplace "tools"., git ls-remote failed: https-auth, exit code 128, fetched https://{git host}/acme/tools.git |

  Scenario Outline: Updating a git marketplace whose host answers 403 before any credential is sent names the command that stores one
    Given the marketplace "tools" is published as a <source kind> source
    Given the user has run "/claude:plugin marketplace add <source> --scope project"
    Given the user has stored a credential for the git host with the user "alice" and the password "s3cret"
    Given the git host answers 403 for the marketplace "tools"
    When the user runs "/claude:plugin marketplace update tools --scope project"
    Then the result has these fields:
      | kind         | cascade                      |
      | severity     | error                        |
      | needs reload | false                        |
      | summary      | Some operations have failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace status | id    | name  | status | reasons                 | scope   | leaks | rollback partial | cause chain   | cause truncated |
      | tools            | project           | failed             | tools | tools | failed | authentication required | project |       |                  | <cause chain> | false           |
    Then the git host receives these requests:
      | method | path                                              | status |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 403    |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 403    |

    @url
    Examples:
      | source kind | source                            | cause chain                                                                                                                                                                                                                                   |
      | url         | https://{git host}/acme/tools.git | Failed to update marketplace "tools"., git ls-remote failed: https-auth, exit code 128, no credential was obtained for {git host}; store one with: printf 'protocol=https\\nhost={git host}\\nusername=<user>\\npassword=<token>\\n\\n' \| git credential approve |

  Scenario: Updating a marketplace whose checkout cannot be moved aside keeps it and warns, and the next update replaces it
    Given the marketplace "tools" is published as a url source
    Given the marketplace "tools" has the description "Tools before the update"
    Given the marketplace "tools" is added to the project scope
    Given the marketplace "tools" has the description "Tools after the update"
    Given the folder that holds the checkout of the marketplace "tools" in the project scope is read-only
    When the user runs "/claude:plugin marketplace update tools --scope project"
    Then the result has these fields:
      | kind         | cascade                         |
      | severity     | warning                         |
      | needs reload | false                           |
      | summary      | Some operations need attention. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace status | id    | name  | status  | reasons           | scope   | leaks | rollback partial | cause chain                                                                                                                                                                   | cause truncated | marketplace reasons |
      | tools            | project           | skipped            | tools | tools | skipped | permission denied | project |       |                  | Could not replace the marketplace checkout because it is in use; the existing copy was kept and the next update will try again., {read-only checkout folder rename error} | false           | permission denied   |
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
      | source ref              |                               |
      | description             | Tools before the update       |
      | severity                | info                          |
      | needs reload            | false                         |
    When the folder that holds the checkout of the marketplace "tools" in the project scope becomes writable again
    When the user runs "/claude:plugin marketplace update tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | marketplace status |
      | tools            | project           | updated            |
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
      | source ref              |                               |
      | description             | Tools after the update        |
      | severity                | info                          |
      | needs reload            | false                         |

  Scenario: Updating a git marketplace whose repository changed its default branch follows the new branch
    Given the marketplace "tools" is published as a url source
    Given the marketplace "tools" has the description "Tools on main"
    Given the marketplace "tools" is added to the project scope
    Given the branch "next" of the marketplace "tools" has the description "Tools on next"
    Given the default branch of the marketplace "tools" is "next"
    When the user runs "/claude:plugin marketplace update tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | marketplace status |
      | tools            | project           | updated            |
    Then the git host receives these requests:
      | method | path                                              | status |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/tools.git/git-upload-pack                   | 200    |
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
      | source ref              |                               |
      | description             | Tools on next                 |
      | severity                | info                          |
      | needs reload            | false                         |

  Scenario: Updating a git marketplace added at a tag follows the tag when it moves
    Given the marketplace "tools" is published as a url source
    Given the tag "v1" of the marketplace "tools" has the description "Tools at the first v1"
    Given the user has run "/claude:plugin marketplace add https://{git host}/acme/tools.git#v1 --scope project"
    Given the tag "v1" of the marketplace "tools" has the description "Tools at the moved v1"
    When the user runs "/claude:plugin marketplace update tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | marketplace status |
      | tools            | project           | updated            |
    Then the git host receives these requests:
      | method | path                                              | status |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/tools.git/git-upload-pack                   | 200    |
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
      | source ref              | v1                            |
      | description             | Tools at the moved v1         |
      | severity                | info                          |
      | needs reload            | false                         |

  Scenario: Updating a marketplace after an interrupted update restores its checkout, and its plugins install from it
    Given the marketplace "tools" is published as a url source
    Given the marketplace "tools" offers these plugins:
      | name      | version |
      | formatter | 1.0.0   |
    Given the marketplace "tools" is added to the project scope
    Given an update of the marketplace "tools" in the project scope was interrupted after it moved the checkout aside
    When the user runs "/claude:plugin marketplace update tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | marketplace status | marketplace reasons |
      | tools            | project           | skipped            | up-to-date          |
    Then the git host receives these requests:
      | method | path                                              | status |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/tools.git/git-upload-pack                   | 200    |
    When the user runs "/claude:plugin install formatter@tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id              | name      | status    | reasons | scope   | version |
      | tools            | project           | formatter@tools | formatter | installed |         | project | 1.0.0   |
    Then the git host receives no request

  Scenario: A marketplace update that the git host drops keeps the previous checkout, and the next update succeeds
    Given the marketplace "tools" is published as a url source
    Given the marketplace "tools" offers these plugins:
      | name      | version |
      | formatter | 1.0.0   |
    Given the marketplace "tools" is added to the project scope
    Given the marketplace "tools" has the description "Tools after the update"
    Given the git host drops the connection for the marketplace "tools"
    When the user runs "/claude:plugin marketplace update tools --scope project"
    Then the result has these fields:
      | kind         | cascade                      |
      | severity     | error                        |
      | needs reload | false                        |
      | summary      | Some operations have failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace status | id    | name  | status | reasons             | scope   | leaks | rollback partial | cause chain                                                                         | cause truncated |
      | tools            | project           | failed             | tools | tools | failed | network unreachable | project |       |                  | Failed to update marketplace "tools"., git ls-remote failed: network, exit code 128 | false           |
    Then the git host receives these requests:
      | method | path                                              | status  |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | dropped |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | dropped |
    When the user runs "/claude:plugin install formatter@tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id              | name      | status    | reasons | scope   | version |
      | tools            | project           | formatter@tools | formatter | installed |         | project | 1.0.0   |
    When the git host serves the marketplace "tools" again
    When the user runs "/claude:plugin marketplace update tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | marketplace status |
      | tools            | project           | updated            |
    Then the git host receives these requests:
      | method | path                                              | status |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/tools.git/git-upload-pack                   | 200    |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/tools.git/git-upload-pack                   | 200    |
      | POST   | /acme/tools.git/git-upload-pack                   | 200    |

  Scenario: Updating a marketplace whose clone an earlier version made re-clones it, and its plugin's linked skill works
    Given the marketplace "tools" is published as a url source
    Given the marketplace "tools" offers these plugins:
      | name      | version |
      | formatter | 1.0.0   |
    Given the marketplace "tools" is added to the project scope
    Given the checkout of the marketplace "tools" in the project scope has the git settings an earlier version made
    Given the published plugin "formatter" of the marketplace "tools" links a file of its skill to another file of the skill
    Given the marketplace "tools" has the description "Tools with a linked skill"
    When the user starts a new pi session
    Then the session reports no results
    Then the git host receives no request
    Then the checkout of the marketplace "tools" in the project scope keeps the git settings an earlier version made
    When the user runs "/claude:plugin marketplace update tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | marketplace status |
      | tools            | project           | updated            |
    Then the git host receives these requests:
      | method | path                                              | status |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/tools.git/git-upload-pack                   | 200    |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/tools.git/git-upload-pack                   | 200    |
      | POST   | /acme/tools.git/git-upload-pack                   | 200    |
    When the user runs "/claude:plugin install formatter@tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id              | name      | status    | reasons | scope   | version |
      | tools            | project           | formatter@tools | formatter | installed |         | project | 1.0.0   |
    Then the git host receives no request
    Then the staged skill "formatter-skill" of the project scope holds these supporting files:
      | file       | text                    |
      | linked.txt | -> notes.txt            |
      | notes.txt  | The notes of formatter. |
    When the user starts a new pi session
    Then the session offers these skills:
      | command                | description                 |
      | /skill:formatter-skill | A skill of formatter 1.0.0. |

  Scenario: Updating a marketplace whose clone an earlier version made and whose remote has not moved reports it up to date and still serves its plugins
    Given the marketplace "tools" is published as a url source
    Given the marketplace "tools" offers these plugins:
      | name      | version |
      | formatter | 1.0.0   |
    Given the published plugin "formatter" of the marketplace "tools" links a file of its skill to another file of the skill
    Given the marketplace "tools" is added to the project scope
    Given the checkout of the marketplace "tools" in the project scope has the git settings an earlier version made
    When the user starts a new pi session
    Then the session reports no results
    Then the git host receives no request
    Then the checkout of the marketplace "tools" in the project scope keeps the git settings an earlier version made
    When the user runs "/claude:plugin marketplace update tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | marketplace status | marketplace reasons |
      | tools            | project           | skipped            | up-to-date          |
    Then the git host receives these requests:
      | method | path                                              | status |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/tools.git/git-upload-pack                   | 200    |
    When the user runs "/claude:plugin install formatter@tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id              | name      | status    | reasons | scope   | version |
      | tools            | project           | formatter@tools | formatter | installed |         | project | 1.0.0   |
    Then the git host receives no request
    Then the staged skill "formatter-skill" of the project scope holds these supporting files:
      | file       | text                    |
      | linked.txt | -> notes.txt            |
      | notes.txt  | The notes of formatter. |
    When the user starts a new pi session
    Then the session offers these skills:
      | command                | description                 |
      | /skill:formatter-skill | A skill of formatter 1.0.0. |
