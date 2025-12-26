# 🚀 Шаблон для начала следующей сессии

**Копируй и вставляй это сообщение в начале новой сессии**

---

```
Привет! Продолжаю работу над STAVAGENT.

Контекст:
- Последняя сессия: Security Updates + Time Norms Design (2025-12-26)
- Ветка: claude/add-project-documentation-LowCg
- Последние коммиты:
  - e967324 - FIX: Remove npm cache from test-coverage workflow
  - 75cd282 - SECURITY: Upgrade Node.js 18.20.4 → 20.11.0 + npm vulnerabilities fix
- Статус:
  ✅ Node.js 20.11.0 обновлён (EOL resolved)
  ✅ npm vulnerabilities: 1/2 fixed (jws ✅, xlsx ⚠️)
  ✅ CI/CD workflows исправлены
  🟢 Time Norms Design готов к реализации

Приоритет сегодня:
⭐ РЕКОМЕНДУЮ: Реализовать Time Norms Automation (4-6 часов)

План:
1. Backend service (timeNormsService.js) - 1-2h
2. API endpoint (POST /api/positions/:id/suggest-days) - 30min
3. Frontend UI (кнопка "💡 AI náврh") - 1-2h
4. Feature flag (FF_AI_DAYS_SUGGEST = true) - 5min
5. Testing (3 сценария) - 1h

Детальный план см. в NEXT_SESSION.md
Design документ: Monolit-Planner/docs/TIME_NORMS_AUTOMATION.md

Начинаю...
```

---

## 📚 Полезные файлы

- **NEXT_SESSION.md** - Детальная сводка последней сессии + план следующей
- **CLAUDE.md** - Полная документация всей системы
- **Monolit-Planner/docs/TIME_NORMS_AUTOMATION.md** - Design документ (8 страниц, 631 строка)

---

## 🔗 Быстрые команды

```bash
# Проверить статус
cd /home/user/STAVAGENT
git status
git log --oneline -5

# Посмотреть дизайн Time Norms
cat Monolit-Planner/docs/TIME_NORMS_AUTOMATION.md

# Создать service файл
touch Monolit-Planner/backend/src/services/timeNormsService.js

# Запустить тесты
cd Monolit-Planner/shared && npm test  # 34 formula tests
```

---

## 🎯 Альтернативные задачи (если не Time Norms)

### Вариант B: Production Improvements (2-3 часа)
- Add Dependency Review workflow
- Implement npm cache in CI (optional)
- Fix Integration Tests ES module mocking

### Вариант C: xlsx Vulnerability Mitigation (2-3 hours)
- Migrate from `xlsx` to `exceljs` for Excel parsing
- Risk: Medium (Excel parsing is critical)

---

**Создано:** 2025-12-26
**Для:** Следующей сессии работы над STAVAGENT
