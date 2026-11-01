Feature: Skill frontmatter

  Each frontmatter field of a bridged skill either behaves in Pi as in Claude Code or is reported
  as a recorded divergence. A local marketplace and a scripted model stand in for published and real ones.

  Scenario: Installing a skill that sets fields pi cannot honor reports them
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the skill "review" with this skill file:
      """
      ---
      name: review
      description: Reviews a change.
      model: opus
      effort: high
      ---

      Review the change.
      """
    Given the marketplace "fixtures" is added to the project scope
    When the user runs "/claude:plugin install demo@fixtures --scope project"
    Then the command reports these results:
      | kind       | severity | needs reload | header                                                              | lines                                  |
      | cascade    | info     | true         |                                                                     |                                        |
      | diagnostic | warning  | false        | Plugin "demo" [project] installed; 1 declared component has a note. | [review] dropped fields: model, effort |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | installed |         | project | 1.0.0   |

  Scenario: A skill that sets every field pi cannot honor reports them in its frontmatter order
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the skill "audit" with this skill file:
      """
      ---
      name: audit
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

  Scenario: A skill that sets only fields pi honors or that have their own decision reports no dropped field
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the skill "tidy" with this skill file:
      """
      ---
      name: tidy
      description: Tidies a change.
      allowed-tools: Read
      arguments: target
      shell: bash
      user-invocable: false
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

  Scenario: Installing a skill whose block-scalar description holds an indented rule line installs it
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the skill "review" with this skill file:
      """
      ---
      name: review
      description: |
        Part one.
        ---
        Part two.
      ---

      Review the change.
      """
    Given the marketplace "fixtures" is added to the project scope
    When the user runs "/claude:plugin install demo@fixtures --scope project"
    Then the command reports these results:
      | kind    | severity | needs reload |
      | cascade | info     | true         |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | installed |         | project | 1.0.0   |

  Scenario Outline: Installing a skill whose block-scalar description holds an indented rule line before another key installs it
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the skill "review" with this skill file:
      """
      ---
      <first line>
      description: |
        Part one.
        ---
        Part two.
      <following line>
      ---

      Review the change.
      """
    Given the marketplace "fixtures" is added to the project scope
    When the user runs "/claude:plugin install demo@fixtures --scope project"
    Then the command reports these results:
      | kind    | severity | needs reload |
      | cascade | info     | true         |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | installed |         | project | 1.0.0   |

    Examples:
      | first line   | following line                   |
      | name: review | when_to_use: Use it for reviews. |
      | license: MIT | name: review                     |
      | name: review | audience: Use this: carefully    |

  Scenario Outline: Installing a skill whose frontmatter spells this extension's own key differently installs it
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the skill "review" with this skill file:
      """
      ---
      name: review
      description: Reviews a change.
      <key and colon> set by the author
      ---

      Review the change.
      """
    Given the marketplace "fixtures" is added to the project scope
    When the user runs "/claude:plugin install demo@fixtures --scope project"
    Then the command reports these results:
      | kind    | severity | needs reload |
      | cascade | info     | true         |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | installed |         | project | 1.0.0   |

    Examples:
      | key and colon            |
      | "pi-claude-marketplace": |
      | 'pi-claude-marketplace': |
      | pi-claude-marketplace :  |

  Scenario: A skill that disables model invocation stays listed
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the skill "hidden" with this skill file:
      """
      ---
      name: hidden
      description: Runs only when the user asks.
      disable-model-invocation: true
      ---

      Run the hidden check.
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the skill "greet" described as "Greets a person by name." with this body:
      """
      Greet the person named in the arguments.
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    When the user starts a new pi session
    Then the session offers these skills:
      | command            | description                   |
      | /skill:demo-greet  | Greets a person by name.      |
      | /skill:demo-hidden | Runs only when the user asks. |
      | /skill:demo-skill  | A skill of demo 1.0.0.        |

  Scenario: A skill that disables model invocation runs on its slash command and is left out of the model's skill list
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the skill "hidden" with this skill file:
      """
      ---
      name: hidden
      description: Runs only when the user asks.
      disable-model-invocation: true
      ---

      Run the hidden check.
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the skill "greet" described as "Greets a person by name." with this body:
      """
      Greet the person named in the arguments.
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply             |
      | The check passed. |
    When the user prompts "/skill:demo-hidden"
    Then the model receives these calls:
      | call | role | text                                                                                                                                                                                                                                                     |
      | 1    | user | <skill name="demo-hidden" location="{project dir}/.pi/pi-claude-marketplace/resources/skills/demo-hidden/SKILL.md">\nReferences are relative to {project dir}/.pi/pi-claude-marketplace/resources/skills/demo-hidden.\n\nRun the hidden check.\n</skill> |
    Then the model call 1 lists these skills in its system prompt:
      | name       | description              | location                                                                     |
      | demo-greet | Greets a person by name. | {project dir}/.pi/pi-claude-marketplace/resources/skills/demo-greet/SKILL.md |
      | demo-skill | A skill of demo 1.0.0.   | {project dir}/.pi/pi-claude-marketplace/resources/skills/demo-skill/SKILL.md |

  Scenario: A skill that is not user-invocable stays listed, because pi cannot hide a skill's slash command
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the skill "quiet" with this skill file:
      """
      ---
      name: quiet
      description: Works in the background.
      user-invocable: false
      ---

      Do the quiet work.
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    When the user starts a new pi session
    Then the session offers these skills:
      | command           | description              |
      | /skill:demo-quiet | Works in the background. |
      | /skill:demo-skill | A skill of demo 1.0.0.   |

  Scenario: A skill that is not user-invocable runs on its slash command, because pi cannot hide a skill's slash command
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the skill "quiet" with this skill file:
      """
      ---
      name: quiet
      description: Works in the background.
      user-invocable: false
      ---

      Do the quiet work.
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply             |
      | The work is done. |
    When the user prompts "/skill:demo-quiet"
    Then the model receives these calls:
      | call | role | text                                                                                                                                                                                                                                               |
      | 1    | user | <skill name="demo-quiet" location="{project dir}/.pi/pi-claude-marketplace/resources/skills/demo-quiet/SKILL.md">\nReferences are relative to {project dir}/.pi/pi-claude-marketplace/resources/skills/demo-quiet.\n\nDo the quiet work.\n</skill> |

  Scenario: A skill is listed under its directory name when its frontmatter names it otherwise
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the skill "review" with this skill file:
      """
      ---
      name: fancy
      description: Reviews a change.
      ---

      Review the change.
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    When the user starts a new pi session
    Then the session offers these skills:
      | command            | description            |
      | /skill:demo-review | Reviews a change.      |
      | /skill:demo-skill  | A skill of demo 1.0.0. |
