Feature: Slash command manifest forms

  A plugin can name its command files and directories in its manifest or its
  marketplace entry, and can declare commands as an object map. Pi loads them
  as Claude Code does. A local marketplace stands in for a published one.

  Scenario: A command file the plugin manifest declares by its path is listed under its file name
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".claude-plugin/plugin.json" with this text:
      """
      { "name": "demo", "version": "1.0.0", "commands": "./cmds/a.md" }
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file "cmds/a.md" with this text:
      """
      ---
      description: Runs a.
      ---

      Run a.
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    When the user lists the slash commands pi offers
    Then pi offers these slash commands from prompt templates:
      | command | description |
      | /demo:a | Runs a.     |
