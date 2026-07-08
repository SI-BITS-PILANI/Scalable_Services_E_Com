import { closeDatabaseConnection } from "./database.js";
import { createApp } from "./app.js";

const port = Number(process.env.PORT) || 8003;
const app = createApp();

app.listen(port, () => {
  console.log(`payment-service running on port ${port}`);
});

process.on("SIGTERM", () => {
  closeDatabaseConnection()
    .catch(() => {
      // Intentionally ignored to avoid blocking termination.
    })
    .finally(() => {
      process.exit(0);
    });
});

process.on("SIGINT", () => {
  closeDatabaseConnection()
    .catch(() => {
      // Intentionally ignored to avoid blocking termination.
    })
    .finally(() => {
      process.exit(0);
    });
});
