Feature: Plugin reload

  Reload makes Pi load plugin changes in a session that takes later commands, as Claude Code's
  /reload-plugins does, and refuses where it cannot (RELOADCMD-D1). The scenarios run the real
  extension in Pi's terminal, over rpc, in a one-shot run in json mode, and with a scripted model.

  Scenario: Reloading in pi's terminal runs pi's own reload
    When the user runs "/claude:plugin reload" in pi's terminal
    Then pi's terminal shows this result of the command:
      """
      Reloaded keybindings, extensions, skills, prompts, themes, and context files
      """

  Scenario: Reloading over rpc reports that the reload started, and pi answers only after the reload's load reported the pending install once
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" is added to the project scope
    Given a config in scope project and layer base, with these plugins:
      | marketplace | plugin | enabled |
      | fixtures    | demo   |         |
    When the user runs "/claude:plugin reload"
    Then the command reports these results:
      | kind           | severity | needs reload | needs apply | tally label       | tally failures | tally warnings | tally success count |
      | reload-started | info     | false        |             |                   |                |                |                     |
      | cascade        | info     | false        | true        | Reconcile pending | 0              | 0              | 1                   |
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | id            | name | status       | reasons | scope   |
      | fixtures         | project           | demo@fixtures | demo | will install |         | project |
    Then the project scope has no installed plugins

  Scenario: Reloading in a one-shot run in json mode is refused, because the next run loads the changes
    When the user runs "/claude:plugin reload" in pi's json mode
    Then the result has these fields:
      | kind         | usage-error                                                                                           |
      | severity     | error                                                                                                 |
      | needs reload | false                                                                                                 |
      | message      | Reload is unavailable: this Pi run does not accept later commands, so the next run loads the changes. |
      | usage        |                                                                                                       |

  Scenario: Reloading while the tool of a prompt runs is refused with Claude Code's busy message
    Given pi runs with the scripted model
    Given the scripted model plays these steps:
      | reply | tool | arguments                                 |
      |       | bash | {"command": "sleep 3 && echo from-model"} |
      | Done. |      |                                           |
    When the user runs "/claude:plugin reload" while the tool of the prompt "run the echo" runs
    Then the result has these fields:
      | kind         | usage-error                                                                   |
      | severity     | error                                                                         |
      | needs reload | false                                                                         |
      | message      | The session is busy, so plugins were not reloaded. Ask again once it is idle. |
      | usage        |                                                                               |
