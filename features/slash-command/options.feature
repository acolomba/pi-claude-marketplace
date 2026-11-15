Feature: Slash command options

  A command's content shows a plugin option as the plugin's manifest declares
  it. A scripted model stands in for a real one, and a local marketplace for
  a published one.

  Scenario: A typed command shows a plugin option's default and hides a sensitive one (PG-CORE-03, D-PG10-09)
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".claude-plugin/plugin.json" with this text:
      """
      {
        "name": "demo",
        "version": "1.0.0",
        "userConfig": {
          "mode": { "type": "string", "title": "Mode", "description": "The mode.", "default": "fast" },
          "token": { "type": "string", "title": "Token", "description": "The token.", "default": "abc123", "sensitive": true }
        }
      }
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the slash command "options" with this command file:
      """
      ---
      description: Reports the options.
      ---

      Mode ${user_config.mode}, token ${user_config.token}.
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply  |
      | Noted. |
    When the user prompts "/demo:options"
    Then the model receives these calls:
      | call | role | text                                                                         |
      | 1    | user | Mode fast, token [sensitive option 'token' not available in skill content]. |
