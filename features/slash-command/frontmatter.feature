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

  Scenario: A command that sets every field pi cannot honor reports them in its frontmatter order
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the slash command "audit" with this command file:
      """
      ---
      description: Audits a change.
      paths: src/**
      hooks: {}
      background: true
      context: fork
      agent: reviewer
      effort: high
      model: opus
      disallowed-tools: Bash
      ---

      Audit the change.
      """
    Given the marketplace "fixtures" is added to the project scope
    When the user runs "/claude:plugin install demo@fixtures --scope project"
    Then the command reports these results:
      | kind       | severity | needs reload | header                                                              | lines                                                                                             |
      | cascade    | info     | true         |                                                                     |                                                                                                   |
      | diagnostic | warning  | false        | Plugin "demo" [project] installed; 1 declared component has a note. | [audit] dropped fields: paths, hooks, background, context, agent, effort, model, disallowed-tools |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | installed |         | project | 1.0.0   |

  Scenario: A command that sets only fields pi honors or that have their own decision reports no dropped field
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the slash command "tidy" with this command file:
      """
      ---
      description: Tidies a change.
      allowed-tools: Read
      arguments: target
      shell: bash
      argument-hint: <target>
      user-invocable: false
      disable-model-invocation: true
      ---

      Tidy the change.
      """
    Given the marketplace "fixtures" is added to the project scope
    When the user runs "/claude:plugin install demo@fixtures --scope project"
    Then the command reports these results:
      | kind    | severity | needs reload |
      | cascade | info     | true         |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | installed |         | project | 1.0.0   |

  Scenario: A command that is not user-invocable is still listed, because pi cannot hide a template
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the slash command "hidden" with this command file:
      """
      ---
      description: Runs the hidden check.
      user-invocable: false
      ---

      Run the hidden check.
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    When the user lists the slash commands pi offers
    Then pi offers these slash commands from prompt templates:
      | command      | description            |
      | /demo:hidden | Runs the hidden check. |

  Scenario: A command that is not user-invocable runs when the user types it
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the slash command "hidden" with this command file:
      """
      ---
      description: Runs the hidden check.
      user-invocable: false
      ---

      Run the hidden check.
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply             |
      | The check passed. |
    When the user prompts "/demo:hidden"
    Then the model receives these calls:
      | call | role | text                  |
      | 1    | user | Run the hidden check. |

  Scenario: The model's system prompt lists no bridged command
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the slash command "deploy" with this command file:
      """
      ---
      description: Deploys the branch.
      ---

      Deploy the branch.
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply  |
      | Hello. |
    When the user prompts "hello"
    Then the model receives these calls:
      | call | role | text  |
      | 1    | user | hello |
    Then the model call 1 lists these skills in its system prompt:
      | name       | description            | location                                                                     |
      | demo-skill | A skill of demo 1.0.0. | {project dir}/.pi/pi-claude-marketplace/resources/skills/demo-skill/SKILL.md |

  Scenario: A command's argument hint is shown in pi's terminal menu
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the slash command "deploy" with this command file:
      """
      ---
      description: Deploys the branch.
      argument-hint: <environment>
      ---

      Deploy the branch.
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the slash command "destroy" with this command file:
      """
      ---
      description: Destroys the branch.
      ---

      Destroy the branch.
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    When the user types the slash command prefix "/demo:de" in pi's terminal
    Then pi's terminal menu offers these slash commands:
      | command         | text                                     |
      | demo:deploy     | <environment> -- [t] Deploys the branch. |
      | demo:destroy    | [t] Destroys the branch.                 |
      | demo:demo-skill |                                          |
