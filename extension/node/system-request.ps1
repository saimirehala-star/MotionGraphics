$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
try {
    $inputData = [Console]::In.ReadToEnd() | ConvertFrom-Json
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $request = [Net.HttpWebRequest]::Create([string]$inputData.url)
    $mode = [string]$inputData.networkMode
    if (-not $mode) { $mode = 'direct' }
    $proxyLabel = 'none'
    if ($mode -eq 'direct') {
        $request.Proxy = $null
    } elseif ($mode -eq 'manual') {
        $proxyValue = [string]$inputData.manualProxy
        if (-not $proxyValue) { throw 'Manual proxy is empty.' }
        $proxyUri = [Uri]$proxyValue
        if ($proxyUri.Scheme -notin @('http','https') -or -not $proxyUri.Host) { throw 'Manual proxy is invalid.' }
        $request.Proxy = New-Object Net.WebProxy($proxyUri)
        $proxyLabel = $proxyUri.Scheme + '://' + $proxyUri.Host + ':' + $proxyUri.Port
    } else {
        $proxy = [Net.WebRequest]::GetSystemWebProxy()
        $request.Proxy = $proxy
        $resolved = $proxy.GetProxy($request.RequestUri)
        if ($resolved -and $resolved.AbsoluteUri -ne $request.RequestUri.AbsoluteUri) { $proxyLabel = $resolved.GetLeftPart([UriPartial]::Authority) } else { $proxyLabel = 'system-direct' }
    }
    $request.Method = 'POST'
    $request.AllowAutoRedirect = $false
    $request.Timeout = [int]$inputData.timeout
    $request.ReadWriteTimeout = [int]$inputData.timeout
    $request.ContentType = 'application/json'
    $request.Accept = 'application/json'
    $request.Headers['Authorization'] = 'Bearer ' + [string]$inputData.key
    $bytes = [Text.Encoding]::UTF8.GetBytes([string]$inputData.body)
    $request.ContentLength = $bytes.Length
    $stream = $request.GetRequestStream()
    try { $stream.Write($bytes, 0, $bytes.Length) } finally { $stream.Dispose() }
    try { $response = $request.GetResponse() }
    catch [Net.WebException] { if ($_.Exception.Response) { $response = $_.Exception.Response } else { throw } }
    try {
        $stream = $response.GetResponseStream()
        $memory = New-Object IO.MemoryStream
        try {
            $buffer = New-Object byte[] 16384
            while (($count = $stream.Read($buffer, 0, $buffer.Length)) -gt 0) {
                if ($memory.Length + $count -gt 8388608) { throw 'Response exceeds 8 MB.' }
                $memory.Write($buffer, 0, $count)
            }
            @{status=[int]$response.StatusCode;body=[Text.Encoding]::UTF8.GetString($memory.ToArray());networkMode=$mode;proxy=$proxyLabel} | ConvertTo-Json -Compress
        } finally { $memory.Dispose(); $stream.Dispose() }
    } finally { $response.Dispose() }
} catch {
    # Never include request headers, credentials or payload in diagnostics.
    $cause=$_.Exception
    while ($cause.InnerException) { $cause=$cause.InnerException }
    $code=$cause.GetType().Name
    if ($cause -is [Net.WebException]) { $code += '/' + $cause.Status }
    @{error=('License network request failed: ' + $code);networkMode=$mode;proxy=$proxyLabel} | ConvertTo-Json -Compress
    exit 1
}
