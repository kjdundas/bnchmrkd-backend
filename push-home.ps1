# One-shot: commit the Oura-style athlete home redesign and push to main (Railway deploys)
cd $PSScriptRoot
if (Test-Path ".git\index.lock") { Remove-Item -Force ".git\index.lock" }

git add frontend/src/components/athlete/AthleteDashboard.jsx CLAUDE.md

git status
Write-Host "`nCommits ONLY the athlete home redesign (your mobile/ changes stay uncommitted)." -ForegroundColor Cyan
Write-Host "Press Enter to commit and push, or Ctrl+C to abort..." -ForegroundColor Cyan
Read-Host

git commit -m "Athlete home: Oura-style redesign

- Scrollable metric circles rail (latest value per logged metric, ring = position in own history, star on PB)
- Performance hero: latest result with season-worst-to-PB gauge and off-your-best line
- Detail trend cards: discipline results over time (inverted axis, faster = higher, dashed PB line) + top 3 logged metrics
- Coach cheers moved to header bell with 7-day badge count (toggles reactions strip)
- Bottom nav: label removed from log FAB; TrajectoryHero removed from home (lives in Trajectory tab)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01R8ZFrNh48xGJWLdyw8FTGx"

git push origin main

Write-Host "`nDone. Railway will redeploy from main." -ForegroundColor Green
