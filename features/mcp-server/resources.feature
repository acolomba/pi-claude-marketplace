Feature: MCP server resources

  A plugin server's resources reach the model under each MCP implementation (PG-MCP-08, D-PG9-10).
  A stdio stub server with one text resource stands in for a real one, a scripted model for a real
  model, and a local marketplace for a published one.

  @adapter-only
  Scenario: The model reads a plugin server's resource through pi-mcp-adapter's resource tool (PG-MCP-08)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the stub mcp server "stub" with the text resource "notes"
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given pi runs with the scripted model and these companions:
      | companion      |
      | pi-mcp-adapter |
    Given pi-mcp-adapter has listed the tools of the stub mcp server "stub" of the plugin "demo"
    Given the scripted model plays these steps:
      | reply | tool | arguments                                     |
      |       | mcp  | {"tool": "mcp__plugin_demo_stub__read_notes"} |
      | Done. |      |                                               |
    When the user prompts "read the notes"
    Then the model receives these calls:
      | call | role        | text                                                       |
      | 1    | user        | read the notes                                             |
      | 2    | user        | read the notes                                             |
      | 2    | assistant   | tool call mcp {"tool":"mcp__plugin_demo_stub__read_notes"} |
      | 2    | tool result | mcp returned: stub notes                                   |

  @builtin-only
  Scenario: The model reads a plugin server's resource through Pi's read_mcp_resource tool after a tool search (PG-MCP-08, BLT-01)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the stub mcp server "stub" with the text resource "notes"
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given pi runs with the scripted model and the mcp implementation
    Given the mcp implementation has listed the tools of the stub mcp server "stub" of the plugin "demo"
    Given the scripted model plays these steps:
      | reply | tool              | arguments                                             |
      |       | tool_search       | {"query": "read_mcp_resource"}                        |
      |       | read_mcp_resource | {"server": "plugin_demo_stub", "uri": "stub://notes"} |
      | Done. |                   |                                                       |
    When the user prompts "read the notes"
    Then the model receives these calls, with each tool search reduced to the tools it loads:
      | call | role        | text                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
      | 1    | user        | read the notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
      | 2    | user        | read the notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
      | 2    | assistant   | tool call tool_search {"query":"read_mcp_resource"}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
      | 2    | tool result | tool_search returned: found list_mcp_resource_templates: Lists resource templates provided by MCP servers. Parameterized resource templates allow servers to share data that takes parameters and provides context to language models, such as files, database schemas, or application-specific information. Prefer resource templates over web search when possible.\nfound list_mcp_resources: Lists resources provided by MCP servers. Resources allow servers to share data that provides context to language models, such as files, database schemas, or application-specific information. Prefer resources over web search when possible.\nfound mcp__plugin_demo_stub__echo: Echoes the text it is given.\nfound read_mcp_resource: Read a specific resource from an MCP server given the server name and resource URI. |
      | 3    | user        | read the notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
      | 3    | assistant   | tool call tool_search {"query":"read_mcp_resource"}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
      | 3    | tool result | tool_search returned: found list_mcp_resource_templates: Lists resource templates provided by MCP servers. Parameterized resource templates allow servers to share data that takes parameters and provides context to language models, such as files, database schemas, or application-specific information. Prefer resource templates over web search when possible.\nfound list_mcp_resources: Lists resources provided by MCP servers. Resources allow servers to share data that provides context to language models, such as files, database schemas, or application-specific information. Prefer resources over web search when possible.\nfound mcp__plugin_demo_stub__echo: Echoes the text it is given.\nfound read_mcp_resource: Read a specific resource from an MCP server given the server name and resource URI. |
      | 3    | assistant   | tool call read_mcp_resource {"server":"plugin_demo_stub","uri":"stub://notes"}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
      | 3    | tool result | read_mcp_resource returned: stub notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
