# FIX: Portal "Vaše projekty" - Master-Detail Pattern

## 📋 Проблема

Секция "Vaše projekty" выглядела как необработанный HTML без стилей:
- Карточки проектов — просто текст без визуального разделения
- Кнопки выглядели как битые ссылки
- Панель деталей открывалась инлайн, разрывая список карточек
- Статус дублировался
- Нет пустого состояния для правой панели

## ✅ Решение

Реализован **Master-Detail паттерн** с двумя независимыми колонками:

```
┌──────────────────────┬─────────────────────────────────────┐
│   СПИСОК ПРОЕКТОВ    │        ДЕТАЛИ ВЫБРАННОГО             │
│   (левая колонка)    │        (правая колонка)              │
│                      │                                      │
│  [ + Přidat projekt] │  🏢 Frt  •  Budova                  │
│  ─────────────────── │  🔴 Neanalyzováno                    │
│  🌉 В8   Most   🔴   │                                      │
│  📋 D6   Vlastní 🔴  │  📤 Nahrát soubor                   │
│  🏢 Frt  Budova  🔴  │  ┌────────────────────────────────┐ │
│  📋 7777 Vlastní 🔴  │  │ Přetáhněte Excel / PDF         │ │
│                      │  └────────────────────────────────┘ │
│                      │                                      │
│                      │  📄 Soubory projektu: žádné         │
│                      │  🔗 Propojené kiosky: žádné         │
│                      │                                      │
│                      │  [ Odeslat do CORE ]                │
└──────────────────────┴─────────────────────────────────────┘
```

## 🎯 Изменения

### Левая колонка (380px)
- **Компактные строки** (52px высота)
- **Цветная полоска** слева по типу проекта
- **Иконка + название + тип** в одной строке
- **Статус-бейдж** справа (🔴/🟢)
- **Active state** при выборе (подсветка фона)
- **Hover effect** для невыбранных строк

### Правая колонка (flex 1fr)
- **Заголовок проекта** с иконкой и статусом
- **Dropzone** для загрузки файлов
- **Список файлов** (пустое состояние)
- **Propojené kiosky** (пустое состояние)
- **Кнопка "Odeslat do CORE"** (full-width)
- **Пустое состояние** когда проект не выбран

### Удалено
- ❌ Секция "Stats" (3 карточки со статистикой)
- ❌ Группировка по stavba_name
- ❌ Grid layout с карточками
- ❌ Модальное окно CorePanel
- ❌ Компонент ProjectCard

## 📁 Файлы

### Modified:
- `stavagent-portal/frontend/src/pages/PortalPage.tsx`
  - Удалена секция Stats (3 карточки)
  - Реализован Master-Detail layout
  - Левая колонка: список проектов (компактные строки)
  - Правая колонка: детали выбранного проекта
  - Убрано модальное окно CorePanel

### Unchanged:
- `stavagent-portal/frontend/src/components/portal/ProjectCard.tsx` (не используется)
- `stavagent-portal/frontend/src/components/portal/CorePanel.tsx` (не используется)

## 🎨 Стили

### Левая колонка - строка проекта:
```tsx
{
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '12px 16px',
  borderLeft: '4px solid {color}',  // Цвет по типу
  borderBottom: '1px solid var(--border-color)',
  background: isActive ? '#f8fafc' : 'transparent',
  cursor: 'pointer',
  minHeight: '52px'
}
```

### Правая колонка - dropzone:
```tsx
{
  border: '2px dashed var(--border-color)',
  borderRadius: '8px',
  padding: '32px 24px',
  textAlign: 'center',
  cursor: 'pointer',
  background: '#f8fafc'
}
```

## 🚀 Поведение

### Desktop (> 768px):
- Grid: `380px 1fr` (левая колонка фиксированная, правая растягивается)
- Клик на проект → обновляется правая панель
- Левая колонка скроллится независимо (max-height: 70vh)

### Mobile (< 768px):
- Grid: `1fr` (одна колонка)
- Клик на проект → переход на отдельный экран (TODO)

## 📝 Пустые состояния

### Нет проектов:
```
📄 Zatím žádné projekty
Začněte vytvořením prvního projektu
[ + Vytvořit první projekt ]
```

### Проект не выбран:
```
📄 Vyberte projekt ze seznamu
Klikněte na projekt vlevo pro zobrazení detailů
```

### Нет файлов:
```
Žádné soubory
```

### Нет киосков:
```
Žádné propojené kiosky
```

## ✅ Исправлено

- ✅ Карточки проектов теперь компактные строки с визуальным разделением
- ✅ Кнопки имеют правильные стили
- ✅ Панель деталей в отдельной колонке (не инлайн)
- ✅ Статус показывается один раз (в строке проекта)
- ✅ Пустое состояние для правой панели
- ✅ Исправлена диакритика: "Propojené kiosky"
- ✅ Убрана секция "Jak to funguje" из деталей

## 🔜 TODO (опционально)

- [ ] Mobile layout (переход на отдельный экран)
- [ ] Интеграция с реальным CorePanel для загрузки файлов
- [ ] Анимация перехода между проектами
- [ ] Keyboard navigation (стрелки вверх/вниз)

---

**Status:** ✅ COMPLETE  
**Type:** UI Fix  
**Priority:** High  
**Breaking Changes:** None (старые компоненты не удалены)
