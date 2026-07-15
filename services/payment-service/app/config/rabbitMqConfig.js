export function loadRabbitMqConfig() {
  return {
    url: process.env.RABBITMQ_URL || "amqp://guest:guest@localhost:5672/",
    exchange: process.env.RABBITMQ_EXCHANGE || "ecom.events",
    orderCreatedQueue:
      process.env.RABBITMQ_ORDER_CREATED_QUEUE || "payment.order-created.queue",
    orderCreatedRoutingKey:
      process.env.RABBITMQ_ORDER_CREATED_KEY || "order.OrderCreated"
  };
}
