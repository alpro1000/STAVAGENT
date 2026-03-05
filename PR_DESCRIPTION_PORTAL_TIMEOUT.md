# FIX: Portal Backend Timeout Message for Professional Plan

## 🎯 Проблема

На Professional Render плане сервисы работают 24/7 без cold starts, но сообщение "Backend se probouzí" вводило пользователей в заблуждение.

## ✅ Решение

Обновлено сообщение при таймауте подключения:

**Было:**
```
Probíhá načítání...
Server neodpovídá, zkuste to znovu
```

**Стало:**
```
Připojování k serveru...
První načtení může trvat déle (až 30 s)
```

## 📝 Изменения

### `stavagent-portal/frontend/src/pages/PortalPage.tsx`

- Заголовок: "Probíhá načítání..." → "Připojování k serveru..."
- Подзаголовок: "Server neodpovídá, zkuste to znovu" → "První načtení může trvat déle (až 30 s)"
- Timeout остался 30s (соответствует Professional плану)

## 🧪 Тестирование

- ✅ Сообщение отображается при таймауте
- ✅ Кнопка "Načíst znovu" работает
- ✅ Текст на чешском языке корректен

## 📊 Влияние

- Улучшена UX для пользователей
- Честное объяснение задержки без упоминания "пробуждения"
- Соответствует реальной инфраструктуре (Professional plan)

---

**Branch:** `fix/portal-backend-timeout-message`  
**Commit:** `53799d4`  
**Files Changed:** 1  
**Lines:** +5 -5
