Output demos/marketplace-add-plugin-install.gif

Require pi
Require npm

Set Shell "bash"
Set FontFamily "Fira Code Retina"
Set FontSize 24
Set Width 1440
Set Height 1080
Set TypingSpeed 55ms

Hide
Type "./scripts/pi.sh --home tmp/pihome --cd tmp/work --clear"
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
Type "upstash/context7"
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
Type "context7"
Sleep 170ms
Tab
Sleep 3000ms
Enter

Sleep 1400ms

Type "/reload"
Sleep 1800ms
Enter

Sleep 1400ms

Type "Show me the Supabase auth API for email/password sign-up."
Sleep 1800ms
Enter

Sleep 30s

Hide
Type "/claude:plugin marketplace rm upstash/context7"
Sleep 500ms
Ctrl+C
