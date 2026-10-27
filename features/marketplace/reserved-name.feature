Feature: Marketplace reserved name

  Claude Code reserves the names of its official marketplaces for the
  anthropics GitHub organization, both when a marketplace is added and when an
  update reads a renamed manifest. It also keeps look-alikes, its own names,
  claudeai- names, other spellings, and Object.prototype member names. Local
  marketplaces and the loopback https git host stand in for the sources a user
  can add.

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
      | source kind | source                                                                      | refusal                                                                                                                                                         |
      | dir         | {home}/marketplaces/claude-plugins-official                                 | The name 'claude-plugins-official' is reserved for official Anthropic marketplaces and can only be used with GitHub sources from the 'anthropics' organization. |
      | file        | {home}/marketplaces/claude-plugins-official/.claude-plugin/marketplace.json | The name 'claude-plugins-official' is reserved for official Anthropic marketplaces and can only be used with GitHub sources from the 'anthropics' organization. |

    @url
    Examples:
      | source kind | source                                              | refusal                                                                                                                                                |
      | url         | https://{git host}/acme/claude-plugins-official.git | The name 'claude-plugins-official' is reserved for official Anthropic marketplaces. Only repositories from 'github.com/anthropics/' can use this name. |

    @github
    Examples:
      | source kind | source                       | refusal                                                                                                                                                |
      | github      | acme/claude-plugins-official | The name 'claude-plugins-official' is reserved for official Anthropic marketplaces. Only repositories from 'github.com/anthropics/' can use this name. |

  Scenario Outline: Adding a marketplace whose name Claude Code keeps for itself fails with Claude Code's refusal
    Given the marketplace "<name>" is published as a dir source
    When the user runs "/claude:plugin marketplace add {home}/marketplaces/<name> --scope project"
    Then the result has these fields:
      | kind         | cascade                      |
      | severity     | error                        |
      | needs reload | false                        |
      | summary      | Some operations have failed. |
    Then the result lists these plugins:
      | marketplace name           | marketplace scope | marketplace status | id                         | name                       | status | reasons          | scope   | leaks | rollback partial | cause chain | cause truncated |
      | {home}/marketplaces/<name> | project           | failed             | {home}/marketplaces/<name> | {home}/marketplaces/<name> | failed | invalid manifest | project |       |                  | <refusal>   | false           |
    Then the project scope holds no marketplace checkout
    Then the "claude-plugins.json" file of the project scope does not exist

    Examples:
      | name                    | refusal                                                                                                                                                                                                            |
      | claude-plugins-v2       | Marketplace name impersonates an official Anthropic/Claude marketplace                                                                                                                                             |
      | claude-directory        | Marketplace name impersonates an official Anthropic/Claude marketplace                                                                                                                                             |
      | npm                     | Marketplace name "npm" is reserved for plugins installed from an npm registry (`<package>@npm`); remove this marketplace and add it again under another name                                                       |
      | GitHub                  | Marketplace name "github" is reserved for plugins installed straight from a GitHub repository (`<owner>/<repo>@github`; reserved; not yet available)                                                               |
      | skills-dir              | Marketplace name "skills-dir" is reserved for plugins auto-loaded from .claude/skills/                                                                                                                             |
      | claudeai-tools          | Cannot add marketplace "claudeai-tools": names starting with "claudeai-" are reserved for marketplaces hosted on claude.ai.                                                                                        |
      | claude.code.plugins     | "claude.code.plugins" is another spelling of "claude-code-plugins", a reserved marketplace name.                                                                                                                   |
      | claude.plugin.directory | "claude.plugin.directory" is a reserved marketplace name.                                                                                                                                                          |
      | constructor             | Cannot add marketplace "constructor": Claude Code reserves this name and cannot register a marketplace under it. The name is set by "name" in the marketplace's marketplace.json; ask its maintainer to change it. |

  Scenario: A look-alike name is refused even from the anthropics organization
    Given the marketplace "claude-plugins-v2" is published by the anthropics organization
    When the user runs "/claude:plugin marketplace add anthropics/claude-plugins-v2 --scope project"
    Then the result has these fields:
      | kind         | cascade                      |
      | severity     | error                        |
      | needs reload | false                        |
      | summary      | Some operations have failed. |
    Then the result lists these plugins:
      | marketplace name             | marketplace scope | marketplace status | id                           | name                         | status | reasons          | scope   | leaks | rollback partial | cause chain                                                            | cause truncated |
      | anthropics/claude-plugins-v2 | project           | failed             | anthropics/claude-plugins-v2 | anthropics/claude-plugins-v2 | failed | invalid manifest | project |       |                  | Marketplace name impersonates an official Anthropic/Claude marketplace | false           |
    Then the project scope holds no marketplace checkout
    Then the "claude-plugins.json" file of the project scope does not exist

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

  Scenario Outline: Updating a marketplace whose manifest now declares a name Claude Code keeps for itself fails with Claude Code's refusal
    Given the marketplace "tools" is published as a <source kind> source
    Given the marketplace "tools" is added to the project scope
    Given the marketplace "tools" update source contains this manifest:
      """
      {"name":"<declared name>","owner":{"name":"features"},"plugins":[]}
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
      | source kind | declared name     | cause chain                                                                                                                                                                                         |
      | dir         | claude-plugins-v2 | Failed to update marketplace "tools"., Marketplace name impersonates an official Anthropic/Claude marketplace                                                                                       |
      | file        | npm               | Failed to update marketplace "tools"., Marketplace name "npm" is reserved for plugins installed from an npm registry (`<package>@npm`); remove this marketplace and add it again under another name |

    @url
    Examples:
      | source kind | declared name     | cause chain                                                                                                                                     |
      | url         | claude-plugins-v2 | Marketplace "tools" clone advanced but manifest could not be persisted., Marketplace name impersonates an official Anthropic/Claude marketplace |

    @github
    Examples:
      | source kind | declared name | cause chain                                                                                                                                                                                                                           |
      | github      | npm           | Marketplace "tools" clone advanced but manifest could not be persisted., Marketplace name "npm" is reserved for plugins installed from an npm registry (`<package>@npm`); remove this marketplace and add it again under another name |

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
