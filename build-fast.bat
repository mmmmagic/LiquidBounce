@echo off
setlocal

set "JAVA_HOME=C:\Users\inclu\.jdks\temurin-25-jdk\jdk-25.0.3+9"

if not exist "%JAVA_HOME%\bin\java.exe" (
    echo JDK not found: %JAVA_HOME%
    exit /b 1
)

set "PATH=%JAVA_HOME%\bin;%PATH%"

pushd "%~dp0"
call gradlew.bat build
set "EXIT_CODE=%ERRORLEVEL%"
popd

exit /b %EXIT_CODE%
