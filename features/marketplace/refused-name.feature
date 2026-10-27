Feature: Marketplace refused name

  Claude Code stops loading a marketplace recorded under a name it refuses. Pi
  reports it on every command that reads it and keeps removal open. Local
  marketplaces and a record an earlier version wrote stand in for such records.

  Scenario: Updating a marketplace an earlier version recorded under a reserved name fails before it reads its source
    Given the marketplace "claude-plugins-official" is published as a dir source
    Given an earlier version recorded the marketplace "claude-plugins-official" in the project scope
    When the user runs "/claude:plugin marketplace update claude-plugins-official --scope project"
    Then the result has these fields:
      | kind         | cascade                      |
      | severity     | error                        |
      | needs reload | false                        |
      | summary      | Some operations have failed. |
    Then the result lists these plugins:
      | marketplace name        | marketplace scope | marketplace status | id                      | name                    | status | reasons          | scope   | leaks | rollback partial | cause chain                                                                                                                                                                                                                                                                                                                                                                      | cause truncated |
      | claude-plugins-official | project           | failed             | claude-plugins-official | claude-plugins-official | failed | invalid manifest | project |       |                  | Failed to update marketplace "claude-plugins-official"., Marketplace "claude-plugins-official" is registered from an untrusted source: The name 'claude-plugins-official' is reserved for official Anthropic marketplaces and can only be used with GitHub sources from the 'anthropics' organization. To fix it, remove the marketplace and re-add it from the official source. | false           |
