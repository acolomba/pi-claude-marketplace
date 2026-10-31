Feature: Marketplace git source

  A git marketplace is cloned when it is added and fetched when it is updated, with the user's stored
  credential if the host asks for one, and fails without it. Listing, inspecting, and removing it read
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

    @url
    Examples:
      | source kind | scope   | source                            | repository path |
      | url         | project | https://{git host}/acme/tools.git | /acme/tools.git |
      | url         | user    | https://{git host}/acme/tools.git | /acme/tools.git |

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
      | marketplace name | marketplace scope | marketplace status | id       | name     | status | reasons                 | scope   | leaks | rollback partial | cause chain                                                            | cause truncated |
      | <source>         | project           | failed             | <source> | <source> | failed | authentication required | project |       |                  | The operation was canceled., fetched https://{git host}/acme/tools.git | false           |
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

    @url
    Examples:
      | source kind | source                            |
      | url         | https://{git host}/acme/tools.git |

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

    @url
    Examples:
      | source kind | source                            | cause chain                                                                                                                                                                                                                                   |
      | url         | https://{git host}/acme/tools.git | Failed to update marketplace "tools"., The operation was canceled., no credential was obtained for {git host}; store one with: printf 'protocol=https\\nhost={git host}\\nusername=<user>\\npassword=<token>\\n\\n' \| git credential approve |

    @github
    Examples:
      | source kind | source                        | cause chain                                                                                                                                                                                                                                                                              |
      | github      | acme/tools                    | Failed to update marketplace "tools"., The operation was canceled., no credential was obtained for {git host}; store one with: printf 'protocol=https\\nhost={git host}\\nusername=<user>\\npassword=<token>\\n\\n' \| git credential approve, fetched https://{git host}/acme/tools.git |
      | github      | https://github.com/acme/tools | Failed to update marketplace "tools"., The operation was canceled., no credential was obtained for {git host}; store one with: printf 'protocol=https\\nhost={git host}\\nusername=<user>\\npassword=<token>\\n\\n' \| git credential approve, fetched https://{git host}/acme/tools.git |

  Scenario Outline: Updating a git marketplace whose host rejects the stored credential names the rejection
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

    @url
    Examples:
      | source kind | source                            | cause chain                                                                      |
      | url         | https://{git host}/acme/tools.git | Failed to update marketplace "tools"., {git host} rejected the stored credential |

    @github
    Examples:
      | source kind | source                        | cause chain                                                                                                                 |
      | github      | acme/tools                    | Failed to update marketplace "tools"., {git host} rejected the stored credential, fetched https://{git host}/acme/tools.git |
      | github      | https://github.com/acme/tools | Failed to update marketplace "tools"., {git host} rejected the stored credential, fetched https://{git host}/acme/tools.git |
