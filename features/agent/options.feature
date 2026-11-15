Feature: Agent options

  An agent's content shows a plugin option as the plugin's manifest declares
  it. pi-subagents reads the staged agent file itself, so the file holds the
  option. A local marketplace stands in for a published one.

  Scenario: An agent's staged body shows a plugin option's default and hides a sensitive one (PG-CORE-03, D-PG10-09)
    Given pi runs with the scripted model and these companions:
      | companion    |
      | pi-subagents |
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
    Given the published plugin "demo" of the marketplace "fixtures" has the agent "helper" described as "Helps with the task." with this body:
      """
      Mode ${user_config.mode}, token ${user_config.token}.
      """
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Then the agents folder of the user scope holds the file "pi-claude-marketplace-demo-helper.md" with this text:
      """
      ---
      name: demo:helper
      description: Helps with the task.
      aliases: pi-claude-marketplace-demo-helper
      systemPromptMode: replace
      inheritProjectContext: true
      inheritSkills: true
      advertise: true
      provenance:
        generatedBy: pi-claude-marketplace
        sourcePlugin: demo
        sourceAgent: helper
        sourcePath: {home}/marketplaces/fixtures/plugins/demo/agents/helper.md
        droppedFields: []
        droppedTools: []
        warnings: []
      ---

      Mode fast, token [sensitive option 'token' not available in skill content].
      """
