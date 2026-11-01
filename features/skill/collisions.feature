Feature: Skill collisions

  A skill and a command, or two skills, of one plugin can claim one name; these
  scenarios protect which of them keeps it. A local marketplace stands in for a
  published one, and a scripted model for a real one.

  Scenario: A skill that shares its name with a command of its plugin is skipped with a warning
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the skill "clash" described as "Clash skill" with this body:
      """
      SKILL CLASH BODY
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file "commands/clash.md" with this text:
      """
      ---
      description: Clash command
      ---

      COMMAND CLASH BODY
      """
    Given the marketplace "fixtures" is added to the project scope
    When the user runs "/claude:plugin install demo@fixtures --scope project"
    Then the command reports these results:
      | kind       | severity | needs reload | header                                                              | lines                                                                                                 |
      | cascade    | info     | true         |                                                                     |                                                                                                       |
      | diagnostic | warning  | false        | Plugin "demo" [project] installed; 1 declared component has a note. | skill source "clash" has the same name "demo:clash" as a command of the plugin; ignoring the skill. |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status    | reasons | scope   | version |
      | fixtures         | project           | demo@fixtures | demo | installed |         | project | 1.0.0   |

  Scenario: A new session offers no skill that shares its name with a command of its plugin
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the skill "clash" described as "Clash skill" with this body:
      """
      SKILL CLASH BODY
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file "commands/clash.md" with this text:
      """
      ---
      description: Clash command
      ---

      COMMAND CLASH BODY
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project", which skipped a skill of the plugin
    When the user starts a new pi session
    Then the session offers these skills:
      | command           | description            |
      | /skill:demo-skill | A skill of demo 1.0.0. |

  Scenario: Prompting /demo:clash sends the model the command's body
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the skill "clash" described as "Clash skill" with this body:
      """
      SKILL CLASH BODY
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file "commands/clash.md" with this text:
      """
      ---
      description: Clash command
      ---

      COMMAND CLASH BODY
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project", which skipped a skill of the plugin
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply      |
      | Clash ran. |
    When the user prompts "/demo:clash"
    Then the model receives these calls:
      | call | role | text               |
      | 1    | user | COMMAND CLASH BODY |

  Scenario: A command with another name leaves the skill of its plugin listed
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the skill "clash" described as "Clash skill" with this body:
      """
      SKILL CLASH BODY
      """
    Given the published plugin "demo" of the marketplace "fixtures" has the file "commands/other.md" with this text:
      """
      ---
      description: Other command
      ---

      OTHER COMMAND BODY
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    When the user starts a new pi session
    Then the session offers these skills:
      | command           | description            |
      | /skill:demo-clash | Clash skill            |
      | /skill:demo-skill | A skill of demo 1.0.0. |
