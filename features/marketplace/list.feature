Feature: Marketplace list

  The list shows every marketplace added to either scope.
  The scenarios run the real extension in a headless Pi and read its JSON results.

  Scenario: The list is empty when no marketplace is added
    When the user runs "/claude:plugin marketplace list"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists no marketplaces
