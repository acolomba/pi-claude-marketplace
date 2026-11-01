Feature: Marketplace background update

  Pi updates the plugins of the user's autoupdate marketplaces in the background only in a tui session,
  and never the project scope, which a repository's own files can set up. The suite drives a real
  pseudoterminal and a headless RPC negative control in one sandbox, with local marketplaces in place
  of published ones.

  Scenario: A PTY backed TUI session is interactive and ready inside its sandbox
    When the user starts a tui session
    Then the tui session has an interactive terminal and is ready

  Scenario: The TUI background update refreshes an autoupdate marketplace and updates its plugin
    Given pi runs with the background update delay "0"
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "tools" is added to the user scope
    Given the user has run "/claude:plugin install demo@tools --scope user"
    Given the user has run "/claude:plugin marketplace autoupdate tools --scope user"
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | demo | 1.10.0  |
    When the user sends the message "hello" in the tui session
    Then the tui session reports the notice "Plugin updated: demo · Run /reload to apply"
    When the user runs "/claude:plugin list"
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace details autoupdate | id         | name | status    | reasons | scope   | version |
      | tools            | user              | true                           | demo@tools | demo | installed |         | user    | 1.10.0  |

  Scenario: The TUI combines distinct plugin updates across marketplaces in one notice
    Given pi runs with the background update delay "0"
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins:
      | name  | version |
      | alpha | 1.0.0   |
    Given the marketplace "extras" is published as a dir source
    Given the marketplace "extras" offers these plugins:
      | name | version |
      | beta | 1.0.0   |
    Given the marketplace "tools" is added to the user scope
    Given the marketplace "extras" is added to the user scope
    Given the user has run "/claude:plugin install alpha@tools --scope user"
    Given the user has run "/claude:plugin install beta@extras --scope user"
    Given the user has run "/claude:plugin marketplace autoupdate tools --scope user"
    Given the user has run "/claude:plugin marketplace autoupdate extras --scope user"
    Given the marketplace "tools" offers these plugins:
      | name  | version |
      | alpha | 1.10.0  |
    Given the marketplace "extras" offers these plugins:
      | name | version |
      | beta | 1.10.0  |
    When the user sends the message "hello" in the tui session
    Then the tui session reports the notice "Plugins updated: alpha and beta · Run /reload to apply"
    When the user runs "/claude:plugin list"
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace details autoupdate | id          | name  | status    | reasons | scope   | version |
      | extras           | user              | true                           | beta@extras | beta  | installed |         | user    | 1.10.0  |
      | tools            | user              | true                           | alpha@tools | alpha | installed |         | user    | 1.10.0  |

  Scenario: The TUI background update leaves a project autoupdate marketplace and its skill as they are
    Given pi runs with the background update delay "0"
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "tools" has the skill "status" with this skill file:
      """
      ---
      name: status
      description: Reports the status.
      ---

      Status: !`printf ran`
      """
    Given the marketplace "extras" is published as a dir source
    Given the marketplace "extras" offers these plugins:
      | name | version |
      | beta | 1.0.0   |
    Given the marketplace "tools" is added to the project scope
    Given the marketplace "extras" is added to the user scope
    Given the user has run "/claude:plugin install demo@tools --scope project"
    Given the user has run "/claude:plugin install beta@extras --scope user"
    Given the user has run "/claude:plugin marketplace autoupdate tools --scope project"
    Given the user has run "/claude:plugin marketplace autoupdate extras --scope user"
    Given the user's pi directory records no plugin install for the project
    Given the user has started a new pi session
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | demo | 1.10.0  |
    Given the marketplace "extras" offers these plugins:
      | name | version |
      | beta | 1.10.0  |
    When the user sends the message "hello" in the tui session
    Then the tui session reports the notice "Plugin updated: beta · Run /reload to apply"
    When the user runs "/claude:plugin list"
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace details autoupdate | id          | name | status     | reasons | scope   | version |
      | extras           | user              | true                           | beta@extras | beta | installed  |         | user    | 1.10.0  |
      | tools            | project           | true                           | demo@tools  | demo | upgradable |         | project | 1.0.0   |
    When the user runs "/skill:demo-status"
    Then the result has these fields:
      | kind         | usage-error                                                                                                                                                                                                                                                       |
      | severity     | error                                                                                                                                                                                                                                                             |
      | needs reload | false                                                                                                                                                                                                                                                             |
      | message      | The skill /skill:demo-status was not installed into the project {project dir} on this machine, or its file changed after the install. Reinstall its plugin into this project with /claude:plugin reinstall demo@tools --scope project, then run /reload to use it. |
      | usage        |                                                                                                                                                                                                                                                                   |

  Scenario: A foreground command cancels a held background git update before dependency settlement
    Given pi runs with the background update delay "0"
    Given the git repository "ghp" holds these plugins:
      | name | version | path |
      | ghp  | 1.0.0   |      |
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | app  | 1.0.0   |
      | dep  | 1.0.0   |
    Given the marketplace "tools" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | ghp  | github      | ghp        | false  |
    Given the marketplace "tools" is added to the user scope
    Given the user has run "/claude:plugin install app@tools --scope user"
    Given the user has run "/claude:plugin install ghp@tools --scope user"
    Given the user has run "/claude:plugin marketplace autoupdate tools --scope user"
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.1.0   | dep          |
      | dep  | 1.0.0   |              |
    Given the marketplace "tools" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | ghp  | github      | ghp        | false  |
    Given the published plugin "app" of the marketplace "tools" has the agent "helper"
    Given the agents directory of the user scope holds the file "pi-claude-marketplace-app-helper.md" with the text "My own helper agent."
    Given the git host holds the response body for the plugin "ghp"
    When the user runs a foreground plugin list while the tui background request is in flight
    Then the foreground plugin list waits for the background git request to stop at the wait cap
    Then the installation record of the user scope holds these plugins:
      | id        | version | enabled |
      | app@tools | 1.0.0   | true    |
      | ghp@tools | 1.0.0   | true    |

  Scenario: A message in an RPC session leaves the plugins of an autoupdate marketplace as they are
    Given pi runs with the background update delay "0"
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "tools" is added to the user scope
    Given the user has run "/claude:plugin install demo@tools --scope user"
    Given the user has run "/claude:plugin marketplace autoupdate tools --scope user"
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | demo | 1.10.0  |
    When the user sends the message "hello"
    Then the session reports no results
    When the user runs "/claude:plugin list"
    Then the result has these fields:
      | kind                | cascade     |
      | severity            | info        |
      | needs reload        | false       |
      | tally label         | Plugin list |
      | tally failures      | 0           |
      | tally warnings      | 0           |
      | tally success count | 1           |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace details autoupdate | id         | name | status     | reasons | scope   | version |
      | tools            | user              | true                           | demo@tools | demo | upgradable |         | user    | 1.0.0   |

  Scenario: The DISABLE_AUTOUPDATER variable keeps the TUI from updating an autoupdate marketplace
    Given pi runs with the background update delay "0"
    Given the tui session starts with the environment variable "DISABLE_AUTOUPDATER" set to "1"
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "tools" is added to the user scope
    Given the user has run "/claude:plugin install demo@tools --scope user"
    Given the user has run "/claude:plugin marketplace autoupdate tools --scope user"
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | demo | 1.10.0  |
    When the user sends the message "hello" in the tui session
    Then the tui session reports no notice
    When the user runs "/claude:plugin list"
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace details autoupdate | id         | name | status     | reasons | scope   | version |
      | tools            | user              | true                           | demo@tools | demo | upgradable |         | user    | 1.0.0   |

  Scenario: The FORCE_AUTOUPDATE_PLUGINS variable overrides DISABLE_AUTOUPDATER in the TUI
    Given pi runs with the background update delay "0"
    Given the tui session starts with the environment variable "DISABLE_AUTOUPDATER" set to "1"
    Given the tui session starts with the environment variable "FORCE_AUTOUPDATE_PLUGINS" set to "1"
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "tools" is added to the user scope
    Given the user has run "/claude:plugin install demo@tools --scope user"
    Given the user has run "/claude:plugin marketplace autoupdate tools --scope user"
    Given the marketplace "tools" offers these plugins:
      | name | version |
      | demo | 1.10.0  |
    When the user sends the message "hello" in the tui session
    Then the tui session reports the notice "Plugin updated: demo · Run /reload to apply"
    When the user runs "/claude:plugin list"
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace details autoupdate | id         | name | status    | reasons | scope   | version |
      | tools            | user              | true                           | demo@tools | demo | installed |         | user    | 1.10.0  |

  Scenario: A readable config layer lets the TUI update an official marketplace
    Given pi runs with the background update delay "0"
    Given the marketplace "claude-plugins-official" is published by the anthropics organization
    Given the marketplace "claude-plugins-official" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "claude-plugins-official" is added to the user scope
    Given the user has run "/claude:plugin install demo@claude-plugins-official --scope user"
    Given the marketplace "claude-plugins-official" offers these plugins:
      | name | version |
      | demo | 1.10.0  |
    Given a config in scope user and layer local, with this text:
      """
      { "schemaVersion": 1 }
      """
    When the user sends the message "hello" in the tui session
    Then the tui session reports the notice "Plugin updated: demo · Run /reload to apply"
    When the user runs "/claude:plugin list"
    Then the result lists these plugins:
      | marketplace name        | marketplace scope | marketplace details autoupdate | id                           | name | status    | reasons | scope   | version |
      | claude-plugins-official | user              | true                           | demo@claude-plugins-official | demo | installed |         | user    | 1.10.0  |

  Scenario: An unreadable config layer keeps the TUI from updating even an official marketplace
    Given pi runs with the background update delay "0"
    Given the marketplace "claude-plugins-official" is published by the anthropics organization
    Given the marketplace "claude-plugins-official" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "claude-plugins-official" is added to the user scope
    Given the user has run "/claude:plugin install demo@claude-plugins-official --scope user"
    Given the marketplace "claude-plugins-official" offers these plugins:
      | name | version |
      | demo | 1.10.0  |
    Given a config in scope user and layer local, with this text:
      """
      { "schemaVersion": 1,
      """
    When the user sends the message "hello" in the tui session
    Then the tui session reports no notice
    When the user runs "/claude:plugin list"
    Then the result lists these plugins:
      | marketplace name        | marketplace scope | id                           | name | status    | reasons | scope   | version |
      | claude-plugins-official | user              | demo@claude-plugins-official | demo | installed |         | user    | 1.0.0   |
    Then the "claude-plugins.local.json" file of the user scope holds this text:
      """
      { "schemaVersion": 1,
      """
