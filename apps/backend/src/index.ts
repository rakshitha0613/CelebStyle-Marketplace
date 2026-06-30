import { createApp } from "./app.js";
import { config } from "./env.js";

const app = createApp();

app.listen(config.port, () => {
  console.log(`CelebStyle backend listening on port ${config.port}`);
});
