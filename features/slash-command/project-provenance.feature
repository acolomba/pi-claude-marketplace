Feature: Slash command project provenance

  A project-scope command runs its context commands only when the user installed its plugin into the
  project, as Claude Code drops a plugin that only the repository's files name. The user's own record
  of project installs, outside the project, tells the two apart. A local marketplace and a scripted
  model stand in for published and real ones.

  Background:
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" publishes this manifest:
      """
      {
        "name": "fixtures",
        "owner": { "name": "features" },
        "plugins": [{ "name": "solo", "source": "./plugins/solo", "version": "1.0.0" }]
      }
      """
    Given the published plugin "solo" of the marketplace "fixtures" has the file ".claude-plugin/plugin.json" with this text:
      """
      { "name": "solo", "version": "1.0.0" }
      """
    Given the published plugin "solo" of the marketplace "fixtures" has the slash command "status" with this command file:
      """
      ---
      description: Reports the status.
      ---

      Status: !`printf ran`
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install solo@fixtures --scope project"

  Scenario: Installing a project command's plugin while the user's record of project installs holds content pi cannot update fails and keeps the record
    Given the user has run "/claude:plugin uninstall solo@fixtures --scope project"
    Given the user's record of project skill installs was replaced with this text:
      """
      { "version": 2, "projects": {} }
      """
    When the user runs "/claude:plugin install solo@fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id            | name | status | reasons | scope   | version | cause chain                                                                                           | cause truncated | leaks | rollback partial |
      | fixtures         | project           | solo@fixtures | solo | failed |         | project | 1.0.0   | The project skill ledger skills.json holds content this version cannot update; it was left unchanged. | false           |       |                  |
    Then the user's record of project skill installs holds this text:
      """
      { "version": 2, "projects": {} }
      """
    Then the project scope has no installed plugins
