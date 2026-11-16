Feature: Slash command aliases

  Protects the names a user can type for a bridged command besides its own: the names Claude Code
  gives a command from its frontmatter name and from its file path, over RPC and in the terminal UI.
  A local marketplace stands in for a published one, and a scripted model for a real one.

  Background:
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |

  Scenario Outline: Each name Claude Code gives a command sends its body to the model
    Given pi runs with the scripted model
    Given the published plugin "demo" of the marketplace "fixtures" has the slash command "ship" with this command file:
      """
      ---
      name: fancy
      description: Ships the branch.
      ---

      Ship the branch.
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply    |
      | Shipped. |
    When the user prompts "<typed name> production"
    Then the model receives these calls:
      | call | role | text                                     |
      | 1    | user | Ship the branch.\n\nARGUMENTS: production |

    Examples:
      | typed name  |
      | /demo:ship  |
      | /demo:fancy |
      | /fancy      |

  Scenario Outline: A command answers to its Pi name and to the name Claude Code gives it (PG-CMD-09)
    Given pi runs with the scripted model
    Given the published plugin "demo" of the marketplace "fixtures" has the slash command "<source path>" with this command file:
      """
      ---
      description: Lints the sources.
      ---

      Lint the sources.
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply   |
      | Linted. |
    When the user prompts "<typed name> src"
    Then the model receives these calls:
      | call | role | text                                |
      | 1    | user | Lint the sources.\n\nARGUMENTS: src |

    Examples:
      | source path     | typed name            |
      | demo-lint       | /demo:lint            |
      | demo-lint       | /demo:demo-lint       |
      | demo-tools/lint | /demo:demo-tools:lint |

  Scenario: A bare frontmatter name two commands share goes to the first command
    Given pi runs with the scripted model
    Given the published plugin "demo" of the marketplace "fixtures" has the slash command "alpha" with this command file:
      """
      ---
      name: same
      description: The first command named same.
      ---

      First command body.
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the slash command "beta" with this command file:
      """
      ---
      name: same
      description: The second command named same.
      ---

      Second command body.
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply  |
      | Noted. |
    When the user prompts "/same"
    Then the model receives these calls:
      | call | role | text                |
      | 1    | user | First command body. |

  Scenario: A frontmatter name a skill of the plugin already answers to stays with the skill
    Given pi runs with the scripted model
    Given the published plugin "demo" of the marketplace "fixtures" has the skill "review" with this skill file:
      """
      ---
      name: fancy
      description: Reviews a change.
      ---

      Review the change.
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the slash command "ship" with this command file:
      """
      ---
      name: fancy
      description: Ships the branch.
      ---

      Ship the branch.
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply  |
      | Noted. |
    When the user prompts "/fancy Ada"
    Then the model receives these calls:
      | call | role | text                                                                                                                                                                                                                                                                  |
      | 1    | user | <skill name="demo-review" location="{project dir}/.pi/pi-claude-marketplace/resources/skills/demo-review/SKILL.md">\nReferences are relative to {project dir}/.pi/pi-claude-marketplace/resources/skills/demo-review.\n\nReview the change.\n\nARGUMENTS: Ada\n</skill> |

  Scenario: Pi's terminal menu offers a command's plugin-qualified alias with its description
    Given the published plugin "demo" of the marketplace "fixtures" has the slash command "ship" with this command file:
      """
      ---
      name: fancy
      description: Ships the branch.
      ---

      Ship the branch.
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    When the user types the slash command prefix "/demo:fa" in pi's terminal
    Then pi's terminal menu offers these slash commands:
      | command    | argument hint | description       |
      | demo:fancy |               | Ships the branch. |

  Scenario: A command whose frontmatter sets a name does not answer to its path name
    Given pi runs with the scripted model
    Given the published plugin "demo" of the marketplace "fixtures" has the slash command "demo-ship" with this command file:
      """
      ---
      name: fancy
      description: Ships the branch.
      ---

      Ship the branch.
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply  |
      | Noted. |
    When the user prompts "/demo:demo-ship production"
    Then the model receives these calls:
      | call | role | text                       |
      | 1    | user | /demo:demo-ship production |
