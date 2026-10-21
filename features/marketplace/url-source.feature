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
    Then the git host receives these requests:
      | method | path                                              | status |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 200    |

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
    Then the git host receives these requests:
      | method | path                                              | status  |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | dropped |

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
      | marketplace name                  | marketplace scope | marketplace status | id                                | name                              | status | reasons       | scope   | leaks | rollback partial | cause chain                                                                  | cause truncated |
      | https://{git host}/acme/tools.git | project           | failed             | https://{git host}/acme/tools.git | https://{git host}/acme/tools.git | failed | network error | project |       |                  | <status> on https://{git host}/acme/tools.git, HTTP Error: <status> <phrase> | false           |
    Then the git host receives these requests:
      | method | path                                              | status   |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | <status> |

    Examples:
      | status | phrase                |
      | 500    | Internal Server Error |
      | 502    | Bad Gateway           |
      | 503    | Service Unavailable   |

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
    Then the git host receives these requests:
      | method | path                                              | status |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 401    |

  Scenario: Adding a url marketplace with a stored credential clones it
    Given the marketplace "tools" is published as a url source
    Given the git host requires the user "alice" with the password "s3cret" for the marketplace "tools"
    Given the user has stored a credential for the git host with the user "alice" and the password "s3cret"
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
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 401    |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/tools.git/git-upload-pack                   | 200    |
