/**
 * Zeleznice-Planner — Backend server entry (Express).
 */
import { createApp } from './src/app.js';

const PORT = process.env.PORT || 3004;
const app = createApp();

app.listen(PORT, () => {
  console.log(`[zeleznice-planner-api] listening on :${PORT}`);
});
