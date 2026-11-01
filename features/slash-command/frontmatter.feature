Feature: Slash command frontmatter

  Each frontmatter field of a bridged command either behaves in Pi as in Claude Code or is reported
  as a recorded divergence. A local marketplace and a scripted model stand in for published and real ones.

  Scenario: Installing a command that sets fields pi cannot honor reports them
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the slash command "deploy" with this command file:
      """
      ---
      description: Deploys the branch.
      model: opus
      effort: high
      ---

      Deploy the branch.
      """
    Given the marketplace "fixtures" is added to the project scope
    When the user runs "/claude:plugin install demo@fixtures --scope project"
    Then the command reports these results:
      | kind       | severity | needs reload | header                                                              | lines                                  |
      | cascade    | info     | true         |                                                                     |                                        |
      | diagnostic | warning  | false        | Plugin "demo" [project] installed; 1 declared component has a note. | [deploy] dropped fields: model, effort |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | installed |         | project | 1.0.0   |
