# scripts/dangerous/

Scripts here perform **destructive operations** on production resources.
Read the file before running. Never copy-paste blindly.

## Files

### `clear-production-db.sql`

Truncates production tables. Originally written as a one-off cleanup
during early portal development. Kept for reference only.

**Before running:**
1. Confirm target database (production vs staging vs local).
2. Take a fresh backup (`pg_dump`).
3. Get explicit approval from the repo owner.

If you are unsure why this file exists, do not run it.
