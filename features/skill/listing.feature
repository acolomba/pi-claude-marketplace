Feature: Skill listing

  A new session lists each bridged skill under its generated name with the
  description Claude Code gives it. A local marketplace stands in for a published one.

  Scenario: A new session lists a bridged skill under its generated name with its description
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the skill "greet" described as "Greets a person by name." with this body:
      """
      Greet the person named in the arguments.
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    When the user starts a new pi session
    Then the session offers these skills:
      | command           | description              |
      | /skill:demo-greet | Greets a person by name. |
      | /skill:demo-skill | A skill of demo 1.0.0.   |

  Scenario: A skill without a description is listed with the first line of its body
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the skill "brief" with this skill file:
      """
      ---
      name: brief
      ---

      First line of the brief.
      Second line of the same paragraph.
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    When the user starts a new pi session
    Then the session offers these skills:
      | command           | description              |
      | /skill:demo-brief | First line of the brief. |
      | /skill:demo-skill | A skill of demo 1.0.0.   |

  Scenario Outline: A skill without a description is listed with Claude Code's fallback for its body
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the skill "<dir>" with this skill file:
      """
      ---
      name: <dir>
      ---

      <body>
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    When the user starts a new pi session
    Then the session offers these skills:
      | command           | description            |
      | /skill:demo-<dir> | <listed description>   |
      | /skill:demo-skill | A skill of demo 1.0.0. |

    Examples:
      | dir     | body                                                                                                  | listed description                                                                                    |
      | heading | # Review a change                                                                                     | Review a change                                                                                       |
      | exact   | Reviews the open change, reads every file it touches, and reports each problem it finds to its owner  | Reviews the open change, reads every file it touches, and reports each problem it finds to its owner  |
      | long    | Reviews the open change, reads every file it touches, and reports each problem it finds to its owners | Reviews the open change, reads every file it touches, and reports each problem it finds to its ow... |
      | empty   |                                                                                                       | Plugin skill                                                                                          |

  Scenario: A skill's when_to_use follows its fallback description in the listing
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the skill "greet" with this skill file:
      """
      ---
      name: greet
      when_to_use: Use it when greeting.
      ---

      Greets.
      """
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    When the user starts a new pi session
    Then the session offers these skills:
      | command           | description                   |
      | /skill:demo-greet | Greets. Use it when greeting. |
      | /skill:demo-skill | A skill of demo 1.0.0.        |
