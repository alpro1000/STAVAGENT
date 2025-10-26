# Concrete Agent - Setup Instructions

## Project Structure Created

The following directory structure has been created:

```
.
├── app
│   ├── core
│   ├── knowledge_base
│   │   ├── B1_Normy_Standardy
│   │   ├── B2_Tech_Cards
│   │   ├── B3_Pricing
│   │   ├── B4_Historical
│   │   │   └── projects
│   │   ├── B5_URS_KROS4
│   │   ├── B6_RTS
│   │   ├── B7_Company_Rules
│   │   └── B8_Templates
│   ├── models
│   ├── prompts
│   │   ├── claude
│   │   │   ├── audit
│   │   │   ├── generation
│   │   │   └── parsing
│   │   └── gpt4
│   ├── services
│   └── utils
├── data
│   ├── processed
│   ├── raw
│   └── results
├── logs
│   ├── claude_calls
│   └── gpt4_calls
└── web
    ├── assets
    └── static
        ├── css
        └── js
```

## Setup Steps

Follow these steps to complete the setup:

1. **Скопируйте файлы артефактов в соответствующие директории**
   - Copy your artifact files to their corresponding directories

2. **Создайте .env из .env.example**
   ```bash
   cp .env.example .env
   ```

3. **Добавьте ключ Claude API в .env**
   - Open `.env` file and add your Claude API key:
   ```
   CLAUDE_API_KEY=your_api_key_here
   ```

4. **Установите зависимости**
   ```bash
   pip install -r requirements.txt
   ```

5. **Запустите сервер**
   ```bash
   python -m uvicorn app.main:app --reload
   ```

## Directory Structure Details

### Application Directories
- `app/core` - Core application logic
- `app/services` - Service layer
- `app/models` - Data models
- `app/utils` - Utility functions
- `app/prompts/` - Prompt templates for AI models
  - `claude/parsing` - Claude parsing prompts
  - `claude/audit` - Claude audit prompts
  - `claude/generation` - Claude generation prompts
  - `gpt4` - GPT-4 prompts

### Knowledge Base
- `app/knowledge_base/B1_Normy_Standardy` - Standards and norms
- `app/knowledge_base/B2_Tech_Cards` - Technical cards
- `app/knowledge_base/B3_Pricing` - Pricing information
- `app/knowledge_base/B4_Historical/projects` - Historical project data
- `app/knowledge_base/B5_URS_KROS4` - URS KROS4 documentation
- `app/knowledge_base/B6_RTS` - RTS documentation
- `app/knowledge_base/B7_Company_Rules` - Company rules and guidelines
- `app/knowledge_base/B8_Templates` - Document templates

### Data Directories
- `data/raw` - Raw input data
- `data/processed` - Processed data
- `data/results` - Output results

### Logs
- `logs/claude_calls` - Claude API call logs
- `logs/gpt4_calls` - GPT-4 API call logs

### Web Assets
- `web/static/css` - Stylesheets
- `web/static/js` - JavaScript files
- `web/assets` - Other web assets (images, fonts, etc.)

## Notes

- `.gitkeep` files have been added to maintain empty directories in version control
- `__init__.py` files have been added to make directories Python packages
