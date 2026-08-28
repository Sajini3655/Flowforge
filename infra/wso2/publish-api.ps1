#Requires -Version 5.0
<#
.SYNOPSIS
Publishes the FlowForge API to WSO2 API Manager 4.7.0

.DESCRIPTION
This script publishes the FlowForge OpenAPI specification to a running WSO2 API Manager instance.
- Waits for WSO2 to be healthy
- Creates the API if it doesn't already exist (idempotent operation)
- Configures the backend endpoint to point to the Docker service: http://backend:8080/api
- Attempts to publish the API to make it accessible via the gateway

.PARAMETER WsoVersion
The WSO2 container version identifier. Defaults to 'wso2-apim'.

.PARAMETER AdminUser
WSO2 admin username. Defaults to 'admin' (local development only).

.PARAMETER AdminPassword
WSO2 admin password. Defaults to 'admin' (local development only).

.PARAMETER MaxWaitSeconds
Maximum seconds to wait for WSO2 health check. Defaults to 300.

.EXAMPLE
.\publish-api.ps1

.EXAMPLE
.\publish-api.ps1 -AdminUser admin -AdminPassword admin

.NOTES
WARNING: This script uses default WSO2 credentials (admin:admin).
Only use with local development deployments. Never use in production.

Idempotency:
- Script queries existing APIs before attempting creation
- Returns success (exit code 0) whether API was newly created or already existed
- Safe to run multiple times without creating duplicates
#>

[CmdletBinding()]
param(
    [string]$WsoVersion = 'wso2-apim',
    [string]$AdminUser = 'admin',
    [string]$AdminPassword = 'admin',
    [int]$MaxWaitSeconds = 300
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

# Script constants
$ApiName = 'FlowForge API'
$ApiVersion = 'v1'
$ApiContext = '/flowforge'
$BackendEndpoint = 'http://backend:8080/api'
$WsoInternalPort = '9443'
$WsoHealthEndpoint = "https://localhost:${WsoInternalPort}/api/am/publisher/v4/apis"
$WsoPublisherBaseUrl = "https://localhost:${WsoInternalPort}/api/am/publisher/v4"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent (Split-Path -Parent $ScriptDir)
$OpenApiPath = Join-Path $RepoRoot 'docs\api\flowforge-openapi.yaml'

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "FlowForge WSO2 API Publication Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Configuration:" -ForegroundColor Yellow
Write-Host "  API Name: $ApiName"
Write-Host "  API Version: $ApiVersion"
Write-Host "  Gateway Context: $ApiContext"
Write-Host "  Backend Endpoint: $BackendEndpoint"
Write-Host "  OpenAPI File: $OpenApiPath"
Write-Host ""

# Verify OpenAPI file exists
if (-not (Test-Path $OpenApiPath)) {
    Write-Host "ERROR: OpenAPI specification not found at: $OpenApiPath" -ForegroundColor Red
    exit 1
}

# Wait for WSO2 to be healthy
Write-Host "Waiting for WSO2 to be healthy..." -ForegroundColor Cyan
$StartTime = Get-Date
$Healthy = $false
$AttemptCount = 0

while ($true) {
    $Elapsed = (Get-Date) - $StartTime
    if ($Elapsed.TotalSeconds -gt $MaxWaitSeconds) {
        Write-Host "ERROR: WSO2 health check timeout after $MaxWaitSeconds seconds" -ForegroundColor Red
        exit 1
    }
    
    $AttemptCount++
    try {
        # Try to query the APIs list endpoint - if WSO2 is healthy, it will respond
        $Response = & docker compose --profile wso2 exec -T wso2-apim bash -c "curl -k -s -u admin:admin -o /dev/null -w '%{http_code}' '${WsoHealthEndpoint}' 2>&1"
        
        if ($Response -eq '200') {
            Write-Host "✓ WSO2 is healthy (attempt $AttemptCount, $([math]::Round($Elapsed.TotalSeconds))s elapsed)" -ForegroundColor Green
            $Healthy = $true
            break
        }
    } catch {
        # Docker exec might fail during startup, continue polling
    }
    
    Start-Sleep -Seconds 5
}

if (-not $Healthy) {
    Write-Host "ERROR: WSO2 failed health check" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Connecting to WSO2 Publisher API..." -ForegroundColor Cyan

function Invoke-Wso2Curl {
    param([string]$Command)
    return & docker compose --profile wso2 exec -T $WsoVersion bash -c $Command 2>&1
}

function Publish-And-DeployApi {
    param([string]$TargetApiId)

    $DetailResponse = Invoke-Wso2Curl "curl -k -s -u ${AdminUser}:${AdminPassword} 'https://localhost:9443/api/am/publisher/v4/apis/${TargetApiId}'"
    $ApiDetail = $DetailResponse | ConvertFrom-Json

    if ($ApiDetail.apiThrottlingPolicy -ne 'Unlimited' -or @($ApiDetail.policies).Count -eq 0) {
        $ApiDetail.apiThrottlingPolicy = 'Unlimited'
        $ApiDetail.policies = @('Unlimited')
        $UpdatePayload = [System.IO.Path]::GetTempFileName()
        $ApiDetail | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $UpdatePayload -Encoding UTF8
        & docker compose --profile wso2 cp $UpdatePayload "${WsoVersion}:/tmp/update-api.json" | Out-Null
        $UpdateResponse = Invoke-Wso2Curl "curl -k -sS -u ${AdminUser}:${AdminPassword} -X PUT -H 'Content-Type: application/json' --data-binary '@/tmp/update-api.json' 'https://localhost:9443/api/am/publisher/v4/apis/${TargetApiId}'"
        Remove-Item $UpdatePayload -Force
        if ($UpdateResponse -notmatch 'HTTP/1.1 200') { throw "Failed to configure WSO2 API tier: $UpdateResponse" }
    }

    if (@($ApiDetail.securityScheme).Count -eq 0) {
        $ApiDetail.securityScheme = @('oauth2')
        $SecurityPayload = [System.IO.Path]::GetTempFileName()
        $ApiDetail | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $SecurityPayload -Encoding UTF8
        & docker compose --profile wso2 cp $SecurityPayload "${WsoVersion}:/tmp/update-api-security.json" | Out-Null
        $SecurityResponse = Invoke-Wso2Curl "curl -k -sS -u ${AdminUser}:${AdminPassword} -X PUT -H 'Content-Type: application/json' --data-binary '@/tmp/update-api-security.json' 'https://localhost:9443/api/am/publisher/v4/apis/${TargetApiId}'"
        Remove-Item $SecurityPayload -Force
        if ($SecurityResponse -notmatch 'HTTP/1.1 200') { throw "Failed to enable WSO2 API security: $SecurityResponse" }
    }

    if ($ApiDetail.lifeCycleStatus -eq 'CREATED') {
        $PublishResponse = Invoke-Wso2Curl "curl -k -sS -u ${AdminUser}:${AdminPassword} -X POST 'https://localhost:9443/api/am/publisher/v4/apis/change-lifecycle?apiId=${TargetApiId}&action=Publish'"
        if ($PublishResponse -notmatch 'workflowStatus.*APPROVED') { throw "Failed to publish API in WSO2: $PublishResponse" }
        Write-Host "✓ API lifecycle transitioned to PUBLISHED" -ForegroundColor Green
    }

    $Deployments = (Invoke-Wso2Curl "curl -k -s -u ${AdminUser}:${AdminPassword} 'https://localhost:9443/api/am/publisher/v4/apis/${TargetApiId}/deployments'") | ConvertFrom-Json
    if (-not $Deployments -or @($Deployments).Count -eq 0) {
        $Revision = (Invoke-Wso2Curl "curl -k -sS -u ${AdminUser}:${AdminPassword} -X POST -H 'Content-Type: application/json' -d '{}' 'https://localhost:9443/api/am/publisher/v4/apis/${TargetApiId}/revisions'") | ConvertFrom-Json
        if (-not $Revision.id) { throw "Failed to create WSO2 API revision" }
        $DeployPayload = [System.IO.Path]::GetTempFileName()
        '[{"name":"Default","vhost":"localhost","displayOnDevportal":true}]' | Set-Content -LiteralPath $DeployPayload -Encoding UTF8
        & docker compose --profile wso2 cp $DeployPayload "${WsoVersion}:/tmp/deploy-api.json" | Out-Null
        $DeployResponse = Invoke-Wso2Curl "curl -k -sS -u ${AdminUser}:${AdminPassword} -X POST -H 'Content-Type: application/json' --data-binary '@/tmp/deploy-api.json' 'https://localhost:9443/api/am/publisher/v4/apis/${TargetApiId}/deploy-revision?revisionId=$($Revision.id)'"
        Remove-Item $DeployPayload -Force
        if ($DeployResponse -notmatch 'deployedGatewayCount') { throw "Failed to deploy WSO2 API revision: $DeployResponse" }
        Write-Host "✓ API revision deployed to the Default gateway environment" -ForegroundColor Green
    }
}

# Create base64 credentials for Basic Auth
$CredentialPair = "${AdminUser}:${AdminPassword}"
$EncodedCredentials = [System.Convert]::ToBase64String([System.Text.Encoding]::ASCII.GetBytes($CredentialPair))
$Headers = @{
    'Authorization' = "Basic $EncodedCredentials"
    'Content-Type' = 'application/json'
}

# Query existing APIs
Write-Host "Checking for existing APIs..." -ForegroundColor Cyan
try {
    $ListResponse = & docker compose --profile wso2 exec -T wso2-apim bash -c "curl -k -s -u admin:admin 'https://localhost:9443/api/am/publisher/v4/apis' 2>&1"
    
    $ListJson = $ListResponse | ConvertFrom-Json
    $ExistingApi = $ListJson.list | Where-Object { $_.name -eq $ApiName -and $_.version -eq $ApiVersion } | Select-Object -First 1
    
    if ($ExistingApi) {
        Write-Host "✓ API already exists with ID: $($ExistingApi.id)" -ForegroundColor Green
        Write-Host "  Name: $($ExistingApi.name)"
        Write-Host "  Version: $($ExistingApi.version)"
        Write-Host "  Status: $($ExistingApi.lifeCycleStatus)"
        Write-Host ""
        Write-Host "Publication Status:" -ForegroundColor Cyan
        Write-Host "  Current Lifecycle: $($ExistingApi.lifeCycleStatus)"
        Write-Host "  Context: $($ExistingApi.context)"
        Publish-And-DeployApi $ExistingApi.id
        $ExistingApi = (Invoke-Wso2Curl "curl -k -s -u ${AdminUser}:${AdminPassword} 'https://localhost:9443/api/am/publisher/v4/apis/$($ExistingApi.id)'") | ConvertFrom-Json
        Write-Host "  Backend Endpoint: $($ExistingApi.endpointConfig.production_endpoints.url)"
        Write-Host ""
        Write-Host "✓ FlowForge API is ready in WSO2" -ForegroundColor Green
        Write-Host ""
        Write-Host "Gateway Access:" -ForegroundColor Cyan
        Write-Host "  URL: https://localhost:8243$($ApiContext)/$($ApiVersion)/jobs"
        Write-Host "  Note: Requires Bearer JWT token for authentication"
        Write-Host ""
        exit 0
    }
} catch {
    Write-Host 'Warning: Could not query existing APIs:' -ForegroundColor Yellow
    Write-Host $_ -ForegroundColor Yellow
}

# Create the API
Write-Host "Creating new API in WSO2..." -ForegroundColor Cyan

$ApiPayload = @{
    name = $ApiName
    version = $ApiVersion
    context = $ApiContext
    type = 'HTTP'
    operations = @(
        @{ target = '/jobs'; verb = 'GET'; authType = 'None'; throttlingPolicy = 'Unlimited' }
        @{ target = '/jobs'; verb = 'POST'; authType = 'None'; throttlingPolicy = 'Unlimited' }
        @{ target = '/jobs/{id}'; verb = 'GET'; authType = 'None'; throttlingPolicy = 'Unlimited' }
        @{ target = '/apis'; verb = 'GET'; authType = 'None'; throttlingPolicy = 'Unlimited' }
        @{ target = '/apis'; verb = 'POST'; authType = 'None'; throttlingPolicy = 'Unlimited' }
        @{ target = '/apis/{id}'; verb = 'GET'; authType = 'None'; throttlingPolicy = 'Unlimited' }
    )
    endpointConfig = @{
        endpoint_type = 'http'
        sandbox_endpoints = @{ url = $BackendEndpoint }
        production_endpoints = @{ url = $BackendEndpoint }
    }
    securityScheme = @('oauth2')
    apiThrottlingPolicy = 'Unlimited'
    policies = @('Unlimited')
} | ConvertTo-Json -Depth 10

# Save payload to temp file
$TempPayload = [System.IO.Path]::GetTempFileName()
Set-Content -LiteralPath $TempPayload -Value $ApiPayload -Encoding UTF8

try {
    # Copy payload to container
    & docker compose --profile wso2 cp $TempPayload "${WsoVersion}:/tmp/create-api.json" | Out-Null
    
    # Execute creation in container
    $CreateResponse = & docker compose --profile wso2 exec -T $WsoVersion bash -c "curl -k -s -u admin:admin -X POST -H 'Content-Type: application/json' -d '@/tmp/create-api.json' 'https://localhost:9443/api/am/publisher/v4/apis' 2>&1"
    
    $ApiJson = $CreateResponse | ConvertFrom-Json
    
    if (-not $ApiJson.id) {
        Write-Host "ERROR: Failed to create API" -ForegroundColor Red
        Write-Host "Response: $CreateResponse" -ForegroundColor Red
        exit 1
    }
    
    $ApiId = $ApiJson.id
    Write-Host "✓ API created successfully with ID: $ApiId" -ForegroundColor Green
    Write-Host "  Name: $($ApiJson.name)"
    Write-Host "  Version: $($ApiJson.version)"
    Write-Host "  Context: $($ApiJson.context)"
    Write-Host ""

    Publish-And-DeployApi $ApiId
    
    Write-Host ""
    Write-Host "Publication Summary:" -ForegroundColor Cyan
    Write-Host "  API ID: $ApiId"
    Write-Host "  Name: $ApiName"
    Write-Host "  Version: $ApiVersion"
    Write-Host "  Context: $ApiContext"
    Write-Host "  Backend: $BackendEndpoint"
    Write-Host ""
    Write-Host "✓ FlowForge API is ready in WSO2" -ForegroundColor Green
    Write-Host ""
    Write-Host "Gateway Access:" -ForegroundColor Cyan
    Write-Host "  URL: https://localhost:8243$($ApiContext)/$($ApiVersion)/jobs"
    Write-Host "  Note: Requires Bearer JWT token for authentication"
    Write-Host ""
    
    exit 0
    
} catch {
    Write-Host 'ERROR: Failed to create API:' -ForegroundColor Red
    Write-Host $_ -ForegroundColor Red
    exit 1
} finally {
    # Cleanup
    if (Test-Path $TempPayload) {
        Remove-Item $TempPayload -Force
    }
}
