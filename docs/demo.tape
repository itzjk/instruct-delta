Output docs/demo.gif
Set Shell "bash"
Set FontSize 17
Set Width 1100
Set Height 900
Set Padding 18
Set Theme "Catppuccin Mocha"
Set TypingSpeed 35ms
Set Framerate 15
Hide
Type "node docs/create-demo.mjs && cd .demo-repo"
Enter
Sleep 1s
Type "alias instruct-delta='node ../bin/instruct-delta.mjs'; export PS1='$ '; clear"
Enter
Show
Type "git --no-pager diff --stat base head"
Enter
Sleep 2s
Ctrl+L
Type "instruct-delta --base base --head head --limit 2"
Enter
Sleep 9s
