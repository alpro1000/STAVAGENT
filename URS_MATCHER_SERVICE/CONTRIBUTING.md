# Contributing to URS Matcher Service

Thank you for interest in contributing! This document explains how to participate in development.

## Development Setup

### Prerequisites
- Node.js 18+
- Docker & Docker Compose
- Git
- Text editor (VS Code recommended)

### Quick Start

```bash
# Clone repository
git clone <repo-url>
cd URS_MATCHER_SERVICE

# Run with Docker
docker-compose up

# Or local development:
cd backend && npm install && npm run dev
# In another terminal:
cd frontend && npm install && npm start
```

---

## Project Structure

```
├── backend/          # Express.js API
│   ├── src/
│   │   ├── api/      # Routes & middleware
│   │   ├── services/ # Business logic
│   │   ├── db/       # Database
│   │   └── utils/    # Utilities
│   └── tests/        # Unit tests
├── frontend/         # Web UI (vanilla JS)
│   └── public/       # HTML, CSS, JS
├── docker-compose.yml
├── Dockerfile.backend
└── Dockerfile.frontend
```

---

## Making Changes

### 1. Create a Feature Branch

```bash
git checkout -b feature/your-feature-name
```

### 2. Make Your Changes

**Backend:**
- Follow Express.js conventions
- Add error handling
- Add logging with `logger.info()` / `logger.error()`
- Write tests for new logic

**Frontend:**
- Keep it simple (vanilla JS)
- Use semantic HTML
- Follow CSS naming (BEM or similar)
- Test in browser

### 3. Test Your Changes

```bash
# Backend tests
cd backend
npm test

# Manual API testing
curl -X GET http://localhost:3001/health
```

### 4. Commit & Push

```bash
git add .
git commit -m "Feature: description of changes"
git push origin feature/your-feature-name
```

---

## Code Style

### JavaScript (Backend)

```javascript
// Use ES6 modules
import express from 'express';

// Use async/await
async function processFile(path) {
  try {
    const data = await readFile(path);
    logger.info('File processed');
    return data;
  } catch (error) {
    logger.error(`Error: ${error.message}`);
    throw error;
  }
}

// Add JSDoc comments
/**
 * Process Excel file
 * @param {string} filePath - Path to file
 * @returns {Promise<Array>} Parsed rows
 */
export async function parseExcelFile(filePath) {
  // ...
}
```

### CSS

```css
/* BEM naming convention */
.button { }
.button--primary { }
.button--primary:hover { }

.results-table { }
.results-table__row { }
.results-table__cell { }
```

---

## Adding Features

### To Add a New API Endpoint:

1. Create route in `backend/src/api/routes/`
2. Add service logic in `backend/src/services/`
3. Document in `API.md`
4. Add tests
5. Test locally

Example:
```javascript
// backend/src/api/routes/newfeature.js
import express from 'express';
const router = express.Router();

router.get('/', async (req, res) => {
  res.json({ message: 'Hello' });
});

export default router;
```

### To Modify UI:

1. Edit `frontend/public/index.html` (structure)
2. Update `frontend/public/styles.css` (styling)
3. Update `frontend/public/app.js` (logic)
4. Test in browser
5. Check responsive design (mobile, tablet, desktop)

---

## Testing

### Unit Tests

```bash
cd backend
npm test
```

### Writing Tests

```javascript
// backend/tests/myfeature.test.js
import { myFunction } from '../src/services/myservice.js';

describe('myFunction', () => {
  it('should return expected result', () => {
    const result = myFunction('input');
    expect(result).toBe('expected');
  });
});
```

### Manual API Testing

```bash
# Test endpoint
curl -X GET http://localhost:3001/api/health

# Test with data
curl -X POST http://localhost:3001/api/jobs/text-match \
  -H "Content-Type: application/json" \
  -d '{"text":"Beton"}'
```

---

## Documentation

### Update When:
- Adding new endpoints → `API.md`
- Changing architecture → `ARCHITECTURE.md`
- Adding setup steps → `README.md`
- Adding deployment steps → `DEPLOYMENT.md`

### Format:
- Use Markdown
- Include code examples
- Keep it clear and concise
- Add table of contents for long docs

---

## Pull Request Process

1. **Ensure code is tested**
   - Unit tests pass
   - Manual testing done
   - No console errors

2. **Update documentation**
   - README.md if user-facing change
   - Code comments for complex logic
   - API.md if new endpoint

3. **Create pull request**
   - Clear title: "Feature: XYZ" or "Fix: XYZ"
   - Describe changes in detail
   - Link to related issues

4. **Code review**
   - Address feedback
   - Keep commits clean
   - Squash if needed

5. **Merge**
   - Once approved
   - Delete feature branch

---

## Common Tasks

### Add a New URS Item Type

1. Edit `backend/src/db/init.js` → `seedSampleData()`
2. Add to database:
   ```javascript
   await db.run(
     'INSERT INTO urs_items (urs_code, urs_name, unit) VALUES (?, ?, ?)',
     ['123456', 'New Work', 'unit']
   );
   ```
3. Test in API

### Add a Tech Rule

1. Edit `backend/src/services/techRules.js`
2. Add to `TECH_RULES` array:
   ```javascript
   {
     id: 'rule_id',
     trigger: /regex_pattern/i,
     generates: [
       { urs_code: '123456', reason: 'explanation' }
     ]
   }
   ```
3. Test via text-match endpoint

### Update Environment Variable

1. Edit `backend/.env.example`
2. Add to `docker-compose.yml` environment section
3. Document in `README.md`
4. Update `.env` files

---

## Debugging

### Backend Logs

```bash
# View logs
docker-compose logs -f backend

# Increase log level
# Edit .env: LOG_LEVEL=debug
```

### Database Inspection

```bash
# For SQLite
sqlite3 data/urs_matcher.db
SELECT * FROM urs_items LIMIT 5;

# For PostgreSQL
psql urs_matcher
SELECT * FROM urs_items LIMIT 5;
```

### Frontend Debugging

1. Open browser DevTools (F12)
2. Console tab shows errors
3. Network tab shows API calls
4. Elements tab shows DOM structure

---

## Performance Tips

### Backend
- Use indexes for database queries
- Cache frequently accessed data
- Avoid N+1 queries
- Use database pooling

### Frontend
- Minimize reflows/repaints
- Lazy load images
- Debounce input handlers
- Cache API responses

---

## Common Issues

### "Database locked"
```bash
docker-compose restart backend
```

### "Port already in use"
```bash
# Kill process on port 3001
lsof -i :3001
kill -9 <PID>

# Or use different port
docker-compose up -d -p 3002:3001
```

### "Module not found"
```bash
# Reinstall dependencies
cd backend
rm -rf node_modules package-lock.json
npm install
```

---

## Before You Start

- Read existing code and match style
- Check if feature already exists
- Test thoroughly
- Document changes
- Keep commits small and focused

---

## Getting Help

- **Questions:** Open GitHub Discussion
- **Bugs:** Open GitHub Issue with details
- **Security:** Email maintainers privately
- **Ideas:** Start Discussion thread

---

## Code of Conduct

- Be respectful and inclusive
- Give constructive feedback
- Accept criticism gracefully
- Focus on code, not people

---

**Thank you for contributing! 🎉**

For detailed architecture, see `ARCHITECTURE.md`
For API documentation, see `API.md`
