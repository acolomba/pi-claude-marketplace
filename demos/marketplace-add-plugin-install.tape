Output demos/marketplace-add-plugin-install.mp4

Require pi

Set Shell "bash"
Set FontFamily "Fira Code Retina"
Set FontSize 24
Set Width 1440
Set Height 1080
Set TypingSpeed 55ms

Hide
Type "pi --no-extensions --no-skills --no-prompt-templates -e ./extensions/claude-marketplace/index.ts -e /opt/homebrew/lib/node_modules/pi-mcp-adapter/index.ts -e /opt/homebrew/lib/node_modules/pi-subagents/src/extension/index.ts"
Enter
Sleep 3000ms
Show

Sleep 1400ms
Type "/claude:p"
Sleep 170ms
Tab
Sleep 170ms
Type "ma"
Sleep 170ms
Tab
Sleep 170ms
Type "a"
Sleep 170ms
Tab
Sleep 170ms
Type "anthropics/claude-plugins-official"
Sleep 1800ms
Enter

Sleep 1800ms

Type "/claude:p"
Sleep 170ms
Tab
Sleep 170ms
Type "i"
Sleep 170ms
Tab
Sleep 170ms
Type "pr-"
Sleep 170ms
Tab
Sleep 1800ms
Enter

Sleep 1400ms

Type "/reload"
Sleep 1800ms
Enter

Sleep 1400ms

Type "/pr-"
Sleep 170ms
Tab
Sleep 1800ms
Enter

Sleep 5s

Hide
Ctrl+C
Sleep 1s
Type "/claude:plugin marketplace remove claude-plugins-official"
Enter
Sleep 1800ms
Type "/quit"
Enter
