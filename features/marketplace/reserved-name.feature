Feature: Marketplace reserved name

  Claude Code reserves the names of its official marketplaces for the
  anthropics GitHub organization, both when a marketplace is added and when an
  update reads a renamed manifest. Local marketplaces and the loopback https git
  host stand in for the sources a user can add.

  Scenario Outline: Adding a marketplace whose manifest declares a reserved name fails with Claude Code's refusal
    Given the marketplace "claude-plugins-official" is published as a <source kind> source
    When the user runs "/claude:plugin marketplace add <source> --scope project"
    Then the result has these fields:
      | kind         | cascade                      |
      | severity     | error                        |
      | needs reload | false                        |
      | summary      | Some operations have failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace status | id       | name     | status | reasons          | scope   | leaks | rollback partial | cause chain | cause truncated |
      | <source>         | project           | failed             | <source> | <source> | failed | invalid manifest | project |       |                  | <refusal>   | false           |
    Then the project scope holds no marketplace checkout
    Then the "claude-plugins.json" file of the project scope does not exist

    Examples:
      | source kind | source                                                                      | refusal                                                                                                                                                       |
      | dir         | {home}/marketplaces/claude-plugins-official                                 | The name 'claude-plugins-official' is reserved for official Anthropic marketplaces and can only be used with GitHub sources from the 'anthropics' organization. |
      | file        | {home}/marketplaces/claude-plugins-official/.claude-plugin/marketplace.json | The name 'claude-plugins-official' is reserved for official Anthropic marketplaces and can only be used with GitHub sources from the 'anthropics' organization. |

    @url
    Examples:
      | source kind | source                                              | refusal                                                                                                                                       |
      | url         | https://{git host}/acme/claude-plugins-official.git | The name 'claude-plugins-official' is reserved for official Anthropic marketplaces. Only repositories from 'github.com/anthropics/' can use this name. |

    @github
    Examples:
      | source kind | source                       | refusal                                                                                                                                       |
      | github      | acme/claude-plugins-official | The name 'claude-plugins-official' is reserved for official Anthropic marketplaces. Only repositories from 'github.com/anthropics/' can use this name. |

  Scenario Outline: Updating a marketplace whose manifest now declares a reserved name fails with Claude Code's refusal
    Given the marketplace "tools" is published as a <source kind> source
    Given the marketplace "tools" is added to the project scope
    Given the marketplace "tools" update source contains this manifest:
      """
      {"name":"claude-plugins-official","owner":{"name":"features"},"plugins":[]}
      """
    When the user runs "/claude:plugin marketplace update tools --scope project"
    Then the result has these fields:
      | kind         | cascade                      |
      | severity     | error                        |
      | needs reload | false                        |
      | summary      | Some operations have failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace status | id    | name  | status | reasons          | scope   | leaks | rollback partial | cause chain   | cause truncated |
      | tools            | project           | failed             | tools | tools | failed | invalid manifest | project |       |                  | <cause chain> | false           |

    Examples:
      | source kind | cause chain                                                                                                                                                                                            |
      | dir         | Failed to update marketplace "tools"., The name 'claude-plugins-official' is reserved for official Anthropic marketplaces and can only be used with GitHub sources from the 'anthropics' organization. |
      | file        | Failed to update marketplace "tools"., The name 'claude-plugins-official' is reserved for official Anthropic marketplaces and can only be used with GitHub sources from the 'anthropics' organization. |

    @url
    Examples:
      | source kind | cause chain                                                                                                                                                                                                                     |
      | url         | Marketplace "tools" clone advanced but manifest could not be persisted., The name 'claude-plugins-official' is reserved for official Anthropic marketplaces. Only repositories from 'github.com/anthropics/' can use this name. |

    @github
    Examples:
      | source kind | cause chain                                                                                                                                                                                                                     |
      | github      | Marketplace "tools" clone advanced but manifest could not be persisted., The name 'claude-plugins-official' is reserved for official Anthropic marketplaces. Only repositories from 'github.com/anthropics/' can use this name. |

  Scenario: The anthropics organization's GitHub repository may use a reserved name
    Given the marketplace "claude-plugins-official" is published as the official marketplace
    When the user runs "/claude:plugin marketplace add anthropics/claude-plugins-official --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name                    | scope   | status |
      | claude-plugins-official | project | added  |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name                    | source                             |
      | claude-plugins-official | anthropics/claude-plugins-official |
