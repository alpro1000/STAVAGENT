# AWS CLI - Пошаговая установка и настройка

## Шаг 1: Установка AWS CLI (5 минут)

### Вариант A: Через winget (рекомендуется)

#### 1.1 Открыть PowerShell от администратора
- Нажать `Win + X`
- Выбрать **"Windows PowerShell (Admin)"** или **"Terminal (Admin)"**

#### 1.2 Установить AWS CLI
```powershell
winget install Amazon.AWSCLI
```

Вывод:
```
Found Amazon AWS Command Line Interface [Amazon.AWSCLI] Version 2.15.0
This application is licensed to you by its owner.
Microsoft is not responsible for, nor does it grant any licenses to, third-party packages.
Downloading https://awscli.amazonaws.com/AWSCLIV2.msi
  ██████████████████████████████  100%
Successfully verified installer hash
Starting package install...
Successfully installed
```

#### 1.3 Перезапустить PowerShell
- Закрыть текущее окно PowerShell
- Открыть новое (не обязательно от администратора)

#### 1.4 Проверить установку
```powershell
aws --version
```

Должно вывести:
```
aws-cli/2.15.0 Python/3.11.6 Windows/10 exe/AMD64 prompt/off
```

---

### Вариант B: Через установщик MSI (если winget не работает)

#### 1.1 Скачать установщик
Открыть браузер:
```
https://awscli.amazonaws.com/AWSCLIV2.msi
```

#### 1.2 Запустить установщик
- Двойной клик на `AWSCLIV2.msi`
- Next → Next → Install
- Finish

#### 1.3 Перезапустить PowerShell

#### 1.4 Проверить
```powershell
aws --version
```

---

## Шаг 2: Получить AWS Access Keys (3 минуты)

### 2.1 Войти в AWS Console
```
https://console.aws.amazon.com/
```

### 2.2 Открыть IAM
- В поиске вверху ввести: **IAM**
- Кликнуть **IAM** (Identity and Access Management)

### 2.3 Создать Access Key

#### Если у вас НЕТ пользователя:
1. Слева: **Users** → **Create user**
2. User name: `stavagent-admin`
3. ✅ Provide user access to the AWS Management Console
4. Next
5. Permissions: **Attach policies directly**
6. Выбрать: ✅ **AdministratorAccess** (для полного доступа)
7. Next → Create user
8. Скопировать пароль (или скачать CSV)

#### Если пользователь УЖЕ ЕСТЬ:
1. Слева: **Users**
2. Кликнуть на своего пользователя
3. Вкладка **Security credentials**
4. Прокрутить вниз до **Access keys**
5. Нажать **Create access key**

### 2.4 Выбрать Use Case
- ✅ **Command Line Interface (CLI)**
- ✅ I understand the above recommendation...
- Next

### 2.5 Скопировать ключи
```
Access key ID:     AKIAIOSFODNN7EXAMPLE
Secret access key: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
```

⚠️ **ВАЖНО**: Secret access key показывается только ОДИН РАЗ!

Варианты сохранения:
- Скопировать в блокнот
- Нажать **Download .csv file**
- Оставить вкладку открытой до настройки CLI

---

## Шаг 3: Настроить AWS CLI (2 минуты)

### 3.1 Открыть PowerShell (обычный, не от администратора)

### 3.2 Запустить настройку
```powershell
aws configure
```

### 3.3 Ввести данные
```
AWS Access Key ID [None]: AKIAIOSFODNN7EXAMPLE
AWS Secret Access Key [None]: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
Default region name [None]: eu-central-1
Default output format [None]: json
```

**Регионы на выбор:**
- `eu-central-1` - Frankfurt (рекомендуется для Европы)
- `eu-west-1` - Ireland
- `us-east-1` - Virginia (самый дешёвый)

### 3.4 Проверить настройку
```powershell
aws sts get-caller-identity
```

Должно вывести:
```json
{
    "UserId": "AIDAI...",
    "Account": "123456789012",
    "Arn": "arn:aws:iam::123456789012:user/stavagent-admin"
}
```

✅ Если видите свой Account ID - всё работает!

---

## Шаг 4: Создать RDS PostgreSQL (1 команда, 10 минут)

### 4.1 Перейти в папку проекта
```powershell
cd c:\Users\prokopovo\Documents\beton_agent\PROJEKT\STAVAGENT\rozpocet-registry-backend
```

### 4.2 Изменить пароль в скрипте (опционально)
```powershell
notepad create-rds.ps1
```

Найти строку:
```powershell
$DB_PASSWORD = "StavAgent2024!Secure"
```

Изменить на свой пароль (минимум 8 символов, буквы + цифры + спецсимволы)

Сохранить: `Ctrl+S`, закрыть

### 4.3 Запустить скрипт
```powershell
.\create-rds.ps1
```

Вывод:
```
🚀 Creating AWS RDS PostgreSQL for Registry Backend...

📋 Configuration:
  Instance ID: stavagent-registry-db
  Database: registry
  Username: postgres
  Region: eu-central-1
  Instance: db.t3.micro (Free Tier)

1️⃣ Creating RDS instance...
✅ RDS instance creation initiated

2️⃣ Waiting for instance to be available (5-10 minutes)...
[ждём...]
✅ Instance is available

3️⃣ Getting endpoint...
✅ Endpoint: stavagent-registry-db.c9akqwerty.eu-central-1.rds.amazonaws.com

4️⃣ Getting security group...
✅ Security Group: sg-0123456789abcdef

5️⃣ Opening port 5432 for public access...
✅ Port 5432 is open

🎉 RDS PostgreSQL Created Successfully!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 Connection Details:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Endpoint:     stavagent-registry-db.c9akqwerty.eu-central-1.rds.amazonaws.com
Port:         5432
Database:     registry
Username:     postgres
Password:     StavAgent2024!Secure

DATABASE_URL:
postgresql://postgres:StavAgent2024!Secure@stavagent-registry-db.c9akqwerty.eu-central-1.rds.amazonaws.com:5432/registry

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 4.4 Скопировать DATABASE_URL
Выделить строку с `postgresql://...` и скопировать (`Ctrl+C`)

---

## Шаг 5: Deploy Backend на Render (5 минут)

### 5.1 Открыть Render Dashboard
```
https://dashboard.render.com/
```

### 5.2 Создать Web Service
- Нажать **New +** → **Web Service**
- Connect GitHub repository: **STAVAGENT**
- Root Directory: `rozpocet-registry-backend`

### 5.3 Настроить сервис
```
Name: rozpocet-registry-backend
Environment: Node
Region: Frankfurt (EU Central)
Branch: main (или fix/audit-7-errors)
Build Command: npm install
Start Command: npm start
Instance Type: Free
```

### 5.4 Добавить Environment Variables
Нажать **Advanced** → **Add Environment Variable**

```
DATABASE_URL = postgresql://postgres:StavAgent2024!Secure@stavagent-registry-db.c9akqwerty.eu-central-1.rds.amazonaws.com:5432/registry
PORT = 3002
NODE_ENV = production
```

### 5.5 Create Web Service
- Нажать **Create Web Service**
- Ожидание: 3-5 минут

---

## Шаг 6: Проверка работы (1 минута)

### 6.1 Дождаться Deploy
В Render Dashboard статус должен стать: **Live** (зелёный)

### 6.2 Скопировать URL
```
https://rozpocet-registry-backend-1086027517695.europe-west3.run.app
```

### 6.3 Тест Health Check
```powershell
curl https://rozpocet-registry-backend-1086027517695.europe-west3.run.app/health
```

Ответ:
```json
{"status":"ok","service":"rozpocet-registry-backend"}
```

### 6.4 Тест создания проекта
```powershell
curl -X POST https://rozpocet-registry-backend-1086027517695.europe-west3.run.app/api/registry/projects `
  -H "Content-Type: application/json" `
  -d '{"project_name":"Test Project","user_id":1}'
```

Ответ:
```json
{
  "success": true,
  "project": {
    "project_id": "reg_...",
    "project_name": "Test Project",
    "owner_id": 1,
    ...
  }
}
```

✅ **Всё работает!**

---

## Troubleshooting

### Ошибка: "winget: command not found"
**Решение**: Обновить Windows
```powershell
# Проверить версию Windows
winver

# Должно быть: Windows 10 версия 1809+ или Windows 11
# Если старше - обновить через Windows Update
```

Или использовать **Вариант B** (MSI установщик)

---

### Ошибка: "Unable to locate credentials"
**Решение**: Повторить Шаг 3
```powershell
aws configure
# Ввести Access Key ID и Secret Access Key
```

---

### Ошибка: "DBInstanceAlreadyExists"
**Решение**: Удалить существующий RDS
```powershell
aws rds delete-db-instance `
  --db-instance-identifier stavagent-registry-db `
  --skip-final-snapshot `
  --region eu-central-1

# Подождать 5 минут
aws rds wait db-instance-deleted `
  --db-instance-identifier stavagent-registry-db `
  --region eu-central-1

# Создать заново
.\create-rds.ps1
```

---

### Ошибка: "Connection refused" при тесте
**Причины**:
1. Render ещё не задеплоился (подождать 3-5 минут)
2. Неправильный DATABASE_URL (проверить пароль, endpoint)
3. Security Group не открыт (повторить шаг 5 скрипта)

**Проверка Security Group**:
```powershell
aws ec2 describe-security-groups `
  --group-ids sg-0123456789abcdef `
  --region eu-central-1 `
  --query 'SecurityGroups[0].IpPermissions'
```

Должно быть правило для порта 5432 с CIDR 0.0.0.0/0

---

## Итого

✅ **Установлено**: AWS CLI
✅ **Настроено**: Access Keys
✅ **Создано**: RDS PostgreSQL (Free Tier)
✅ **Задеплоено**: Backend на Render
✅ **Протестировано**: API работает

**Стоимость**: $0/месяц (12 месяцев)

**Следующий шаг**: Обновить Registry Frontend для работы с API
