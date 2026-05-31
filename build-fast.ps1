$ErrorActionPreference = 'Stop'

$jdk = 'C:\Users\inclu\.jdks\temurin-25-jdk\jdk-25.0.3+9'
if (-not (Test-Path -LiteralPath (Join-Path $jdk 'bin\java.exe'))) {
    throw "JDK not found: $jdk"
}

$env:JAVA_HOME = $jdk
$env:PATH = "$jdk\bin;$env:PATH"

Set-Location -LiteralPath $PSScriptRoot
& .\gradlew.bat build
exit $LASTEXITCODE
