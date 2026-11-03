Feature: Slash command listing

  A plugin's commands become slash commands that Pi offers in the next
  session, built from prompt templates. A registry probe in Pi stands in for
  the user's view of the command list, and a local marketplace for a published one.

  Scenario: A new session offers a bridged command as a prompt command with its description
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the slash command "greet" described as "Greets a person by name." with this body:
      """
      Greet the person named in the arguments.
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    When the user lists the slash commands pi offers
    Then pi offers these slash commands from prompt templates:
      | command     | description              |
      | /demo:greet | Greets a person by name. |

  Scenario: A command without a description is listed with the first line of its body
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the slash command "deploy" with this command file:
      """
      Deploy the current branch to the staging environment and report the result.

      Second paragraph.
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    When the user lists the slash commands pi offers
    Then pi offers these slash commands from prompt templates:
      | command      | description                                                                 |
      | /demo:deploy | Deploy the current branch to the staging environment and report the result. |

  Scenario Outline: A command without a description is listed with Claude Code's fallback for its body
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the slash command "deploy" with this command file:
      """
      ---
      description: <declared description>
      ---
      <first body line>
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    When the user lists the slash commands pi offers
    Then pi offers these slash commands from prompt templates:
      | command      | description          |
      | /demo:deploy | <listed description> |

    Examples:
      | declared description | first body line                                                                                       | listed description                                                                                   |
      |                      | # Deploy a change                                                                                     | Deploy a change                                                                                      |
      |                      | Run the full release checklist for the current branch, then publish the release notes and tag it now  | Run the full release checklist for the current branch, then publish the release notes and tag it now |
      |                      | Run the full release checklist for the current branch, then publish the release notes and tag it now. | Run the full release checklist for the current branch, then publish the release notes and tag it ... |
      |                      |                                                                                                       | Plugin command                                                                                       |
      | ""                   | Review the open pull requests of this repository and summarize what each one changes.                 | Review the open pull requests of this repository and summarize what each one changes.                |

  Scenario: A command whose frontmatter does not parse is listed with the fallback of its body
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the slash command "repair" with this command file:
      """
      ---
      description: [unclosed
      ---
      Repair the build after a failed run and report which steps changed.
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project", which warned
    Given the user has started a new pi session
    When the user lists the slash commands pi offers
    Then pi offers these slash commands from prompt templates:
      | command      | description                                                         |
      | /demo:repair | Repair the build after a failed run and report which steps changed. |

  Scenario: A nested command file is listed with its directories colon-joined
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the slash command "build/web" with this command file:
      """
      ---
      description: Builds the web app.
      ---
      Build the web app.
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    When the user lists the slash commands pi offers
    Then pi offers these slash commands from prompt templates:
      | command         | description         |
      | /demo:build:web | Builds the web app. |

  Scenario: A command file whose name starts with the plugin name is listed without that prefix, as recorded under D-141-01
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the slash command "demo-lint" with this command file:
      """
      ---
      description: Lints the sources.
      ---
      Lint the sources.
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    When the user lists the slash commands pi offers
    Then pi offers these slash commands from prompt templates:
      | command    | description        |
      | /demo:lint | Lints the sources. |

  Scenario: A command file whose name starts with a dot is not offered, as recorded under CM-4
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the slash command ".hidden" with this command file:
      """
      ---
      description: Stays hidden.
      ---
      Stay hidden.
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    When the user lists the slash commands pi offers
    Then pi offers no slash commands from prompt templates
