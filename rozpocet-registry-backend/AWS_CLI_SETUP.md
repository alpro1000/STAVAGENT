# AWS CLI Setup для создания RDS

## Шаг 1: Установить AWS CLI

### Windows
```powershell
# Скачать установщик
https://awscli.amazonaws.com/AWSCLIV2.msi

# Или через winget
winget install Amazon.AWSCLI
```

### Проверка установки
```bash
aws --version
# Должно быть: aws-cli/2.x.x
```

---

## Шаг 2: Настроить AWS Credentials

### 2.1 Получить Access Keys
1. AWS Console → IAM → Users → Ваш пользователь
2. Security credentials → Create access key
3. Use case: **Command Line Interface (CLI)**
4. Скопировать:
   - Access key ID: `AKIA...`
   - Secret access key: `wJalr...`

### 2.2 Настроить AWS CLI
```bash
aws configure
```

Ввести:
```
AWS Access Key ID: AKIA...
AWS Secret Access Key: wJalr...
Default region name: eu-central-1
Default output format: json
```

### 2.3 Проверка
```bash
aws sts get-caller-identity
```

Должно вернуть:
```json
{
  "UserId": "AIDA...",
  "Account": "123456789012",
  "Arn": "arn:aws:iam::123456789012:user/yourname"
}
```

---

## Шаг 3: Создать RDS через CLI

### Вариант A: PowerShell (Windows)
```powershell
cd c:\Users\prokopovo\Documents\beton_agent\PROJEKT\STAVAGENT\rozpocet-registry-backend
.\create-rds.ps1
```

### Вариант B: Bash (Git Bash / WSL)
```bash
cd /c/Users/prokopovo/Documents/beton_agent/PROJEKT/STAVAGENT/rozpocet-registry-backend
bash create-rds.sh
```

### Вариант C: Вручную (по шагам)
```bash
# 1. Создать RDS
aws rds create-db-instance \
  --db-instance-identifier stavagent-registry-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --engine-version 15.4 \
  --master-username postgres \
  --master-user-password "StavAgent2024!Secure" \
  --allocated-storage 20 \
  --storage-type gp2 \
  --db-name registry \
  --publicly-accessible \
  --backup-retention-period 7 \
  --no-multi-az \
  --region eu-central-1

# 2. Ждать готовности (5-10 минут)
aws rds wait db-instance-available \
  --db-instance-identifier stavagent-registry-db \
  --region eu-central-1

# 3. Получить endpoint
aws rds describe-db-instances \
  --db-instance-identifier stavagent-registry-db \
  --region eu-central-1 \
  --query 'DBInstances[0].Endpoint.Address' \
  --output text

# 4. Получить Security Group ID
aws rds describe-db-instances \
  --db-instance-identifier stavagent-registry-db \
  --region eu-central-1 \
  --query 'DBInstances[0].VpcSecurityGroups[0].VpcSecurityGroupId' \
  --output text

# 5. Открыть порт 5432
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxxxxxx \
  --protocol tcp \
  --port 5432 \
  --cidr 0.0.0.0/0 \
  --region eu-central-1
```

---

## Шаг 4: Получить DATABASE_URL

После выполнения скрипта скопируй строку:
```
postgresql://postgres:StavAgent2024!Secure@stavagent-registry-db.xxxxxx.eu-central-1.rds.amazonaws.com:5432/registry
```

---

## Шаг 5: Deploy на Render

1. https://dashboard.render.com/
2. New → Web Service
3. Connect GitHub: `STAVAGENT`
4. Root Directory: `rozpocet-registry-backend`
5. Build: `npm install`
6. Start: `npm start`
7. Environment Variables:
   ```
   DATABASE_URL = postgresql://postgres:...
   PORT = 3002
   NODE_ENV = production
   ```
8. Create Web Service

---

## Troubleshooting

### Ошибка: "Unable to locate credentials"
```bash
aws configure
# Ввести Access Key ID и Secret Access Key
```

### Ошибка: "DBInstanceAlreadyExists"
```bash
# Удалить существующий instance
aws rds delete-db-instance \
  --db-instance-identifier stavagent-registry-db \
  --skip-final-snapshot \
  --region eu-central-1

# Подождать удаления
aws rds wait db-instance-deleted \
  --db-instance-identifier stavagent-registry-db \
  --region eu-central-1

# Создать заново
.\create-rds.ps1
```

### Ошибка: "InvalidParameterValue: Invalid master password"
Пароль должен содержать:
- Минимум 8 символов
- Буквы (A-Z, a-z)
- Цифры (0-9)
- Спецсимволы (!@#$%^&*)

Изменить в скрипте:
```powershell
$DB_PASSWORD = "YourSecurePassword123!"
```

---

## Полезные команды

### Список RDS instances
```bash
aws rds describe-db-instances --region eu-central-1
```

### Статус instance
```bash
aws rds describe-db-instances \
  --db-instance-identifier stavagent-registry-db \
  --region eu-central-1 \
  --query 'DBInstances[0].DBInstanceStatus' \
  --output text
```

### Удалить RDS
```bash
aws rds delete-db-instance \
  --db-instance-identifier stavagent-registry-db \
  --skip-final-snapshot \
  --region eu-central-1
```

### Создать snapshot
```bash
aws rds create-db-snapshot \
  --db-instance-identifier stavagent-registry-db \
  --db-snapshot-identifier registry-backup-$(date +%Y%m%d) \
  --region eu-central-1
```

---

## Стоимость

### Free Tier (12 месяцев)
- ✅ 750 часов/месяц db.t3.micro
- ✅ 20 GB storage
- ✅ 20 GB backup
- **Total: $0/месяц**

### После Free Tier
- db.t3.micro: ~$15/месяц
- 20 GB storage: ~$2/месяц
- **Total: ~$17/месяц**

---

## Следующие шаги

1. ✅ Установить AWS CLI
2. ✅ Настроить credentials
3. ✅ Запустить `create-rds.ps1`
4. ⏳ Скопировать DATABASE_URL
5. ⏳ Deploy на Render
6. ⏳ Тест API
