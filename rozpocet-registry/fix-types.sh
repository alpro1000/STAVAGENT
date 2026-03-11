#!/bin/bash

# Fix ItemsTable.tsx
sed -i 's/  SortingState,/  type SortingState,/' src/components/items/ItemsTable.tsx
sed -i 's/setItemSkupina(projectId, item.id, e.target.value || null)/setItemSkupina(projectId, item.id, e.target.value || null!)/' src/components/items/ItemsTable.tsx

# Fix Modal.tsx
sed -i 's/import { ReactNode/import { type ReactNode/' src/components/ui/Modal.tsx

# Fix project.ts
sed -i "s/import { ParsedItem } from '.\/item';/import type { ParsedItem } from '.\/item';/" src/types/project.ts
sed -i "s/import { ImportConfig } from '.\/config';/import type { ImportConfig } from '.\/config';/" src/types/project.ts

# Fix search.ts
sed -i "s/import { ParsedItem } from '.\/item';/import type { ParsedItem } from '.\/item';/" src/types/search.ts
