git add .
$msg = if ($args.Count -gt 0) { $args -join ' ' } else { "Cap nhat code $(Get-Date -Format 'yyyy-MM-dd HH:mm')" }
git commit -m "$msg"
git push -u origin main
