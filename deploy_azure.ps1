# Automated Azure App Service & PostgreSQL Deployment Script
# Run 'az login' once before running this script!

$env:PATH += ";C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin"
$SUBSCRIPTION_ID = "cb84cf73-7a46-4c44-b31c-fda2d3ee67c1"

Write-Host "0. Setting active subscription to Azure for Students ($SUBSCRIPTION_ID)..." -ForegroundColor Cyan
az account set --subscription $SUBSCRIPTION_ID

$RESOURCE_GROUP = "rg-asl-learning-system"
$LOCATION = "southeastasia"
$APP_NAME = "asl-system-api"
$PLAN_NAME = "plan-asl-system"
$DB_SERVER_NAME = "asl-db-server-wvsu"
$DB_NAME = "asl_system_db"
$DB_USER = "postgres"
$DB_PASS = "WvsuAslPass2026!"

Write-Host "1. Creating Azure Resource Group ($RESOURCE_GROUP)..." -ForegroundColor Cyan
az group create --name $RESOURCE_GROUP --location $LOCATION

Write-Host "2. Creating Azure App Service Plan..." -ForegroundColor Cyan
az appservice plan create --name $PLAN_NAME --resource-group $RESOURCE_GROUP --sku B1 --is-linux

Write-Host "3. Creating Azure Web App for Python 3.11..." -ForegroundColor Cyan
az webapp create --resource-group $RESOURCE_GROUP --plan $PLAN_NAME --name $APP_NAME --runtime "PYTHON:3.11"

Write-Host "4. Setting App Startup Command..." -ForegroundColor Cyan
az webapp config set --resource-group $RESOURCE_GROUP --name $APP_NAME --startup-file "gunicorn -w 2 -k uvicorn.workers.UvicornWorker server:app --bind 0.0.0.0:8000 --timeout 120"

Write-Host "5. Configuring Environment Variables..." -ForegroundColor Cyan
az webapp config appsettings set --resource-group $RESOURCE_GROUP --name $APP_NAME --settings DB_HOST="$DB_SERVER_NAME.postgres.database.azure.com" DB_NAME="$DB_NAME" DB_USER="$DB_USER" DB_PASSWORD="$DB_PASS" DB_PORT="5432" PYTHONUNBUFFERED="1"

Write-Host "6. Deploying Application Code to Azure..." -ForegroundColor Cyan
az webapp up --name $APP_NAME --resource-group $RESOURCE_GROUP

Write-Host "`n[SUCCESS] Automated Deployment Complete!" -ForegroundColor Green
Write-Host "Your Azure API is live at: https://$APP_NAME.azurewebsites.net" -ForegroundColor Green
