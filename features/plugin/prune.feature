Feature: Plugin prune

  Pruning a scope uninstalls the dependencies that no installed plugin needs
  any more. The scenarios run the real extension in a headless Pi and use a
  local marketplace in place of a published one.

  Scenario: Pruning a scope with nothing to remove reports the empty result
    When the user runs "/claude:plugin prune --scope project"
    Then the result has these fields:
      | kind         | prune-empty |
      | severity     | info        |
      | needs reload | false       |
      | scope        | project     |
