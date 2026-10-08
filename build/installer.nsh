; Custom NSIS hooks for electron-builder.
; Closing a running Smaran before install/uninstall is handled by electron-builder's built-in
; "app is running" check, which asks the user to close it.

!macro customUnInstall
  ; Remove the start-at-login entry (written by Smaran with the value name "Smaran").
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Smaran"

  ; On a real uninstall (not an update), offer to remove messages and settings.
  ${ifNot} ${isUpdated}
    IfSilent keepData
    MessageBox MB_YESNO|MB_ICONQUESTION "Also delete your Smaran messages and settings?$\r$\n$\r$\nChoose No to keep them for a later reinstall." /SD IDNO IDNO keepData
      RMDir /r "$APPDATA\Smaran"
    keepData:
  ${endIf}
!macroend
