# Build System, Windows Installer & Release Pipeline

## 1. Development & Build Commands

All build scripts are managed through `package.json`:

```bash
# Typecheck TypeScript (Node main process + Web renderers)
npm run typecheck

# Run automated test suite (Vitest)
npm test

# Build production bundle using Electron-Vite
npm run build

# Package full Windows release (Installer + Portable + Setup wrapper)
npm run build:win

# Package unpacked directory without creating NSIS/portable archives
npm run build:unpack
```

---

## 2. Release Packaging Pipeline (`npm run build:win`)

The full Windows release build executes the following sequential stages:

1. **Typechecking & Compilation:**
   - Runs `tsc --noEmit` across `tsconfig.node.json` and `tsconfig.web.json`.
   - Bundles `main`, `preload`, and `renderer` using `electron-vite build`.
2. **Directory Preparation & Engine Packaging (`scripts/prepare-release-dirs.mjs`):**
   - Prepares `release/<version>/{installer,portable}` output directories.
   - Packages `resources/engine/dist/` into `resources/engine.tar.gz` and verifies archive integrity.
3. **Electron Builder Packaging:**
   - Bundles native dependencies (`@electron/rebuild`).
   - Generates unpacked application folder: `release/<version>/win-unpacked/`.
   - Code-signs `Smaran.exe` and `elevate.exe` using Windows `signtool.exe`.
   - Generates standalone portable executable: `release/<version>/portable/Smaran-<version>-portable.exe`.
4. **NSIS Installer Packaging (`scripts/make-setup.mjs`):**
   - Compiles NSIS setup wizard with uninstallers and registry associations: `release/<version>/installer/Smaran-Setup-<version>.exe`.
   - Digitally signs the setup executable.

---

## 3. GitHub Release Deployment (`gh release`)

Once binaries are generated:
```bash
# 1. Commit and push changes
git add -A
git commit -m "release: vX.Y.Z - <summary>"
git tag -a vX.Y.Z -m "Smaran X.Y.Z"
git push origin main --tags

# 2. Publish release with binary assets
gh release create vX.Y.Z \
  release/X.Y.Z/installer/Smaran-Setup-X.Y.Z.exe \
  release/X.Y.Z/portable/Smaran-X.Y.Z-portable.exe \
  --title "Smaran X.Y.Z" \
  --notes-file RELEASE_NOTES.md
```
