Feature: Plugin staging warnings

  A staging verb follows its rows with one diagnostic per plugin that names
  the declared components it skipped. A local marketplace stands in for a
  published one.

  Background:
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" is added to the project scope

  Scenario: Installing a plugin whose agents share a name reports the skipped agent
    Given the published plugin "demo" of the marketplace "fixtures" has two agents named "helper"
    When the user runs "/claude:plugin install demo@fixtures --scope project"
    Then the command reports these results:
      | kind       | severity | needs reload | summary                             | header                                                    | lines                                                                                                                                                                                        |
      | cascade    | warning  | true         | A plugin operation needs attention. |                                                           |                                                                                                                                                                                              |
      | diagnostic | warning  | false        |                                     | Plugin "demo" installed; 1 declared component has a note. | agent source "helper" at "second.md" duplicates generated name "pi-claude-marketplace-demo-helper" already produced by agent source "helper" at "first.md"; keeping first discovered source. |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons               | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | installed | requires pi-subagents | project | 1.0.0   |
