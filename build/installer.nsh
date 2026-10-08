; Custom NSIS hooks for electron-builder. Phase 7 fills these in:
;   customUnInit     close the running app
;   customUnInstall  remove HKCU\...\Run\Smaran and ask whether to delete %APPDATA%\Smaran

!macro customUnInstall
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Smaran"
!macroend
