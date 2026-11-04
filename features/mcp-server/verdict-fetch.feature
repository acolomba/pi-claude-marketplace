Feature: MCP server verdict fetch

  A fetched plugin's row follows the MCP implementation pi runs when the fetch
  reads the new revision (P3-DC-25, MREC-03). A loopback https git host serves
  the plugin repository and logs the requests Pi makes, and the sse server
  points at a loopback port that nothing listens on.

  @builtin-only
  Scenario: Fetching a plugin whose new revision declares an sse server reports it partially available, under Pi's built-in MCP (P3-DC-25)
    Given the git repository "ghp" holds these plugins:
      | name | version | path |
      | ghp  | 1.0.0   |      |
    Given the marketplace "gits" is published as a dir source
    Given the marketplace "gits" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | ghp  | github      | ghp        | false  |
    Given the marketplace "gits" is added to the project scope
    Given the user has run "/claude:plugin install ghp@gits --scope project"
    Given the git repository "ghp" adds this .mcp.json to the plugin "ghp":
      """
      {"mcpServers": {"events": {"type": "sse", "url": "http://127.0.0.1:9/sse"}}}
      """
    When the user runs "/claude:plugin fetch ghp@gits --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id       | name | status              | reasons         | version |
      | gits             | project           | ghp@gits | ghp  | partially-available | unsupported mcp | 1.0.0   |
    Then the git host receives these requests:
      | method | path                                            | status |
      | GET    | /acme/ghp.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/ghp.git/git-upload-pack                   | 200    |

  @adapter-only
  Scenario: Fetching a plugin whose new revision declares an sse server reports it available, under pi-mcp-adapter (P3-DC-25)
    Given the git repository "ghp" holds these plugins:
      | name | version | path |
      | ghp  | 1.0.0   |      |
    Given the marketplace "gits" is published as a dir source
    Given the marketplace "gits" offers these plugins from git repositories:
      | name | source kind | repository | pinned |
      | ghp  | github      | ghp        | false  |
    Given the marketplace "gits" is added to the project scope
    Given the user has run "/claude:plugin install ghp@gits --scope project"
    Given the git repository "ghp" adds this .mcp.json to the plugin "ghp":
      """
      {"mcpServers": {"events": {"type": "sse", "url": "http://127.0.0.1:9/sse"}}}
      """
    When the user runs "/claude:plugin fetch ghp@gits --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id       | name | status    | reasons | version |
      | gits             | project           | ghp@gits | ghp  | available |         | 1.0.0   |
    Then the git host receives these requests:
      | method | path                                            | status |
      | GET    | /acme/ghp.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/ghp.git/git-upload-pack                   | 200    |
