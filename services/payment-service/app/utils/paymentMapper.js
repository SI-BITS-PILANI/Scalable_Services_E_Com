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

// v2 mapper adds non-breaking fields: processingFee, totalAmount, feeDescription, serviceVersion
// v1 clients still work (they just ignore the new fields); v2-aware clients get richer data
export function mapPaymentRowV2(paymentRow) {
  const amount = Number(paymentRow.amount);
  const processingFee = Number((amount * 0.02).toFixed(2));
  const totalAmount = Number((amount + processingFee).toFixed(2));

  return {
    // v1 fields (unchanged for backward compatibility)
    paymentId: paymentRow.payment_id,
    orderId: paymentRow.order_id,
    customerId: paymentRow.customer_id,
    amount,
    currency: paymentRow.currency,
    method: paymentRow.method,
    status: paymentRow.status,
    transactionRef: paymentRow.transaction_ref,
    createdAt: paymentRow.created_at,
    updatedAt: paymentRow.updated_at,
    // v2 additions (non-breaking, optional fields)
    processingFee,
    totalAmount,
    feeDescription: "2% processing fee applies to all credit/debit card transactions",
    serviceVersion: "2.0"
  };
}
