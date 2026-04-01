cd $PSScriptRoot

# Remove nested .git from backend (repo is now at this level)
if (Test-Path "backend\.git") {
    Remove-Item -Recurse -Force "backend\.git"
    Write-Host "Removed nested backend/.git" -ForegroundColor Yellow
}

# Stage everything
git add -A
git status

Write-Host "`nReady to push. Review the above, then press Enter to continue..." -ForegroundColor Cyan
Read-Host

git commit -m "Add Athlete Explorer, live API integration, and frontend

- Add Athlete Explorer view with searchable dropdown of all 2,322 athletes
- Career trajectory charts with season-by-season data and discipline switching
- Olympic results display with position badges
- Connect Similar Athletes to live Supabase API (removed embedded constant)
- Make runAnalysis async to support API calls
- Fix numeric parsing (PostgreSQL returns decimals as strings)
- Update landing page with 3 CTA buttons
- Restructure repo: backend/ + frontend/ in one repo

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"

git push -u origin main --force

Write-Host "`nDone! Check https://github.com/kjdundas/bnchmrkd-backend" -ForegroundColor Green
