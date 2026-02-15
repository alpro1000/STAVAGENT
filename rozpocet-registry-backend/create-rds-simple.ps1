# AWS RDS PostgreSQL Creation Script (PowerShell - No Emoji)
# Run: .\create-rds-simple.ps1

$ErrorActionPreference = "Stop"

Write-Host "Creating AWS RDS PostgreSQL for Registry Backend..." -ForegroundColor Green

# Configuration
$DB_INSTANCE_ID = "stavagent-registry-db"
$DB_NAME = "registry"
$DB_USERNAME = "postgres"
$DB_PASSWORD = "StavAgent2024!Secure"
$DB_CLASS = "db.t3.micro"
$STORAGE_SIZE = 20
$REGION = "eu-central-1"

Write-Host ""
Write-Host "Configuration:" -ForegroundColor Cyan
Write-Host "  Instance ID: $DB_INSTANCE_ID"
Write-Host "  Database: $DB_NAME"
Write-Host "  Username: $DB_USERNAME"
Write-Host "  Region: $REGION"
Write-Host "  Instance: $DB_CLASS (Free Tier)"
Write-Host ""

# Step 1: Create RDS instance
Write-Host "[1/5] Creating RDS instance..." -ForegroundColor Yellow
aws rds create-db-instance `
  --db-instance-identifier $DB_INSTANCE_ID `
  --db-instance-class $DB_CLASS `
  --engine postgres `
  --engine-version 15.4 `
  --master-username $DB_USERNAME `
  --master-user-password $DB_PASSWORD `
  --allocated-storage $STORAGE_SIZE `
  --storage-type gp2 `
  --db-name $DB_NAME `
  --publicly-accessible `
  --backup-retention-period 7 `
  --no-multi-az `
  --region $REGION `
  --tags Key=Project,Value=StavAgent Key=Service,Value=Registry

Write-Host "RDS instance creation initiated" -ForegroundColor Green
Write-Host ""

# Step 2: Wait for instance
Write-Host "[2/5] Waiting for instance to be available (5-10 minutes)..." -ForegroundColor Yellow
aws rds wait db-instance-available `
  --db-instance-identifier $DB_INSTANCE_ID `
  --region $REGION

Write-Host "Instance is available" -ForegroundColor Green
Write-Host ""

# Step 3: Get endpoint
Write-Host "[3/5] Getting endpoint..." -ForegroundColor Yellow
$ENDPOINT = aws rds describe-db-instances `
  --db-instance-identifier $DB_INSTANCE_ID `
  --region $REGION `
  --query 'DBInstances[0].Endpoint.Address' `
  --output text

Write-Host "Endpoint: $ENDPOINT" -ForegroundColor Green
Write-Host ""

# Step 4: Get security group
Write-Host "[4/5] Getting security group..." -ForegroundColor Yellow
$SG_ID = aws rds describe-db-instances `
  --db-instance-identifier $DB_INSTANCE_ID `
  --region $REGION `
  --query 'DBInstances[0].VpcSecurityGroups[0].VpcSecurityGroupId' `
  --output text

Write-Host "Security Group: $SG_ID" -ForegroundColor Green
Write-Host ""

# Step 5: Open port 5432
Write-Host "[5/5] Opening port 5432 for public access..." -ForegroundColor Yellow
try {
    aws ec2 authorize-security-group-ingress `
      --group-id $SG_ID `
      --protocol tcp `
      --port 5432 `
      --cidr 0.0.0.0/0 `
      --region $REGION
    Write-Host "Port 5432 is open" -ForegroundColor Green
} catch {
    Write-Host "Port already open" -ForegroundColor Yellow
}
Write-Host ""

# Generate DATABASE_URL
$DATABASE_URL = "postgresql://${DB_USERNAME}:${DB_PASSWORD}@${ENDPOINT}:5432/${DB_NAME}"

Write-Host "RDS PostgreSQL Created Successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "Connection Details:" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Endpoint:     $ENDPOINT"
Write-Host "Port:         5432"
Write-Host "Database:     $DB_NAME"
Write-Host "Username:     $DB_USERNAME"
Write-Host "Password:     $DB_PASSWORD"
Write-Host ""
Write-Host "DATABASE_URL:"
Write-Host $DATABASE_URL -ForegroundColor Yellow
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "1. Copy DATABASE_URL to Render environment variables"
Write-Host "2. Deploy backend: https://dashboard.render.com/"
Write-Host "3. Test: curl https://rozpocet-registry-backend.onrender.com/health"
Write-Host ""
Write-Host "Cost: FREE for 12 months (750 hours/month)" -ForegroundColor Green
Write-Host ""
