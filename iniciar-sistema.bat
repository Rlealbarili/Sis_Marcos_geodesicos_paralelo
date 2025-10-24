@echo off
echo ========================================
echo   SISTEMA DE MARCOS GEODESICOS
echo   PostgreSQL Porta: 5434
echo   API Porta: 3001
echo ========================================
echo.

echo Verificando Docker...
docker ps >nul 2>&1
if errorlevel 1 (
    echo [ERRO] Docker nao esta rodando!
    echo Abra o Docker Desktop e tente novamente.
    pause
    exit /b 1
)

echo Verificando container...
docker ps --filter name=marcos-geodesicos-postgres | findstr "Up" >nul
if errorlevel 1 (
    echo Container nao esta rodando. Iniciando...
    docker-compose up -d
    echo Aguardando 30 segundos...
    timeout /t 30 /nobreak
)

echo.
echo Iniciando servidor API...
start "Servidor API" cmd /k "node backend/server-postgres.js"

timeout /t 3 /nobreak

echo.
echo Abrindo navegador...
start http://localhost:3001

echo.
echo ========================================
echo   SISTEMA INICIADO!
echo ========================================
echo.
echo API: http://localhost:3001
echo Health: http://localhost:3001/api/health
echo.
pause
