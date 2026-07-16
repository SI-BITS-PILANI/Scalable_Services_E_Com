import amqplib from "amqplib";

export async function publishPaymentOutcomeEvent(rabbitMqConfig, eventType, payload) {
  const connection = await amqplib.connect(rabbitMqConfig.url);
  const channel = await connection.createConfirmChannel();

  try {
    await channel.assertExchange(rabbitMqConfig.exchange, "topic", { durable: true });

    const routingKey = `payment.${eventType}`;
    const body = JSON.stringify(payload);

    channel.publish(
      rabbitMqConfig.exchange,
      routingKey,
      Buffer.from(body),
      { persistent: true }
    );
    await channel.waitForConfirms();

    console.info(
      `[payment-service] published ${routingKey} for order_id=${payload.order_id}`
    );
  } catch (error) {
    console.error(
      `[payment-service] failed to publish payment outcome event ${eventType}:`,
      error
    );
    throw error;
  } finally {
    await channel.close();
    await connection.close();
  }
}
