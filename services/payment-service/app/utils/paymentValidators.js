import { allowedPaymentMethods } from "../constants/paymentConstants.js";

export function validateCreatePaymentPayload(payload) {
  const { amount, customerId, currency, method, orderId } = payload || {};

  if (!orderId || !customerId || !currency || !method || amount === undefined) {
    return "orderId, customerId, amount, currency and method are required";
  }

  if (Number.isNaN(Number(amount)) || Number(amount) <= 0) {
    return "amount must be a number greater than 0";
  }

  if (!allowedPaymentMethods.has(String(method).toUpperCase())) {
    return "method must be one of CARD, UPI, NET_BANKING, WALLET";
  }

  return null;
}
