export function mapPaymentRow(paymentRow) {
  return {
    paymentId: paymentRow.payment_id,
    orderId: paymentRow.order_id,
    customerId: paymentRow.customer_id,
    amount: Number(paymentRow.amount),
    currency: paymentRow.currency,
    method: paymentRow.method,
    status: paymentRow.status,
    transactionRef: paymentRow.transaction_ref,
    createdAt: paymentRow.created_at,
    updatedAt: paymentRow.updated_at
  };
}
