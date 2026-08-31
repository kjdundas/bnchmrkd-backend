# One-shot: commit the new-brand rollout and push to main (triggers Railway deploy)
cd $PSScriptRoot

# clear any stale lock left by tooling
if (Test-Path ".git\index.lock") { Remove-Item -Force ".git\index.lock" }

git add frontend/index.html `
        frontend/src/bnchmarkd-app.jsx `
        frontend/src/components/auth/AuthPage.jsx `
        frontend/src/components/coach/CoachDashboard.jsx `
        frontend/public/bnchmrkd-wordmark.svg `
        frontend/public/bnchmrkd-wordmark-white.svg `
        frontend/public/favicon.svg

git status
Write-Host "`nThis will commit the logo rollout AND push your 10 unpushed light-theme commits to main." -ForegroundColor Cyan
Write-Host "Press Enter to continue, or Ctrl+C to abort..." -ForegroundColor Cyan
Read-Host

git commit -m "Brand refresh: roll out track-lane wordmark, white variant, and favicon

- Replace icon.svg + text lockups in all 9 sites with the new wordmark
- Indigo wordmark on light views (landing h-9, about, 5 inner views, coach sidebar)
- White wordmark on dark views (splash screen, auth page)
- Fix invisible white-on-white logo in coach dashboard sidebar
- Add favicon.svg (track-lane b on indigo), replacing default vite.svg

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01R8ZFrNh48xGJWLdyw8FTGx"

git push origin main

Write-Host "`nDone. Railway should pick up the deploy from main." -ForegroundColor Green
