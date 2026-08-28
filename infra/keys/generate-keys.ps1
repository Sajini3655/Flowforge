param(
    [string]$OutputDirectory = $PSScriptRoot
)

$privateKey = Join-Path $OutputDirectory 'flowforge-private.pem'
$publicKey = Join-Path $OutputDirectory 'flowforge-public.pem'

if ((Test-Path $privateKey) -or (Test-Path $publicKey)) {
    throw "Refusing to overwrite existing key files. Remove them explicitly first."
}

$rsa = [System.Security.Cryptography.RSA]::Create(2048)
try {
    function Write-Pem([string]$Path, [string]$Type, [byte[]]$Bytes) {
        $base64 = [Convert]::ToBase64String($Bytes)
        $lines = ($base64 -split '(.{1,64})' | Where-Object { $_ }) -join "`n"
        Set-Content -LiteralPath $Path -Value "-----BEGIN $Type-----`n$lines`n-----END $Type-----" -Encoding ascii
    }

    Write-Pem $privateKey 'PRIVATE KEY' $rsa.ExportPkcs8PrivateKey()
    Write-Pem $publicKey 'PUBLIC KEY' $rsa.ExportSubjectPublicKeyInfo()
} finally {
    $rsa.Dispose()
}

Write-Host "Generated local RSA keys in $OutputDirectory"