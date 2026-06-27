$json = [Console]::In.ReadToEnd() | ConvertFrom-Json

$model = $json.model.display_name
$usedPct = $json.context_window.used_percentage
$totalTokens = $json.context_window.total_input_tokens + $json.context_window.total_output_tokens
$maxTokens = $json.context_window.context_window_size
$remaining = if ($maxTokens) { $maxTokens - $totalTokens } else { $null }

$pctStr = if ($null -ne $usedPct) { "{0:N0}% context" -f $usedPct } else { "context: n/a" }
$tokenStr = if ($null -ne $remaining) {
    "$totalTokens/$maxTokens tokens ($remaining restants)"
} else {
    "$totalTokens tokens"
}

Write-Output "$model | $pctStr | $tokenStr"
