import { closeDatabaseConnection } from "./database.js";
import { createApp } from "./app.js";
import { loadRabbitMqConfig } from "./config/rabbitMqConfig.js";
import { startOrderCreatedConsumer } from "./events/orderCreatedConsumer.js";

const port = Number(process.env.PORT) || 8003;
const app = createApp();
const rabbitMqConfig = loadRabbitMqConfig();
let consumerHandle = null;

app.listen(port, () => {
  console.log(`payment-service running on port ${port}`);
  // Log config values to make startup diagnostics easy.
  console.log(
    `rabbitmq configured: exchange=${rabbitMqConfig.exchange}, queue=${rabbitMqConfig.orderCreatedQueue}, key=${rabbitMqConfig.orderCreatedRoutingKey}`
  );

  startOrderCreatedConsumer(rabbitMqConfig)
    .then((handle) => {
      consumerHandle = handle;
      console.log("[payment-service] order.OrderCreated consumer is running");
    })
    .catch((error) => {
      console.error("[payment-service] failed to start order.OrderCreated consumer:", error);
    });
});

process.on("SIGTERM", () => {
  Promise.all([
    consumerHandle?.stop?.().catch(() => {
      // Intentionally ignored to avoid blocking termination.
    }),
    closeDatabaseConnection()
  ])
    .catch(() => {
      // Intentionally ignored to avoid blocking termination.
    })
    .finally(() => {
      process.exit(0);
    });
});

process.on("SIGINT", () => {
  Promise.all([
    consumerHandle?.stop?.().catch(() => {
      // Intentionally ignored to avoid blocking termination.
    }),
    closeDatabaseConnection()
  ])
    .catch(() => {
      // Intentionally ignored to avoid blocking termination.
    })
    .finally(() => {
      process.exit(0);
    });
});
