import axios from "axios";
import { config } from "../config.js";
import type { AuthenticatedUser } from "../auth/types.js";

/**
 * Resolver context for GraphQL queries
 * Contains functions to fetch data from upstream services
 */
export function createGraphQLContext(request: any) {
  const user = request.user as AuthenticatedUser | undefined;
  const customerId = user?.sub;

  return {
    user,
    /**
     * Fetch products from catalog service
     */
    productsResolver: async () => {
      try {
        const response = await axios.get(`${config.CATALOG_BASE_URL}/api/v1/products`, {
          timeout: 5000
        });
        return response.data || [];
      } catch (error: any) {
        console.error("[graphql-products] Error fetching products:", error.message);
        return [];
      }
    },
    /**
     * Fetch orders for authenticated customer from order service
     * Injects X-Customer-Id header from JWT claim
     */
    ordersResolver: async () => {
      if (!customerId) {
        throw new Error("Authentication required to fetch orders");
      }

      try {
        const response = await axios.get(`${config.ORDER_BASE_URL}/api/v1/orders`, {
          headers: {
            "X-Customer-Id": customerId
          },
          timeout: 5000
        });
        return response.data || [];
      } catch (error: any) {
        console.error(
          `[graphql-orders] Error fetching orders for customer ${customerId}:`,
          error.message
        );
        return [];
      }
    },
    /**
     * Fetch notifications for authenticated customer from notification service
     */
    notificationsResolver: async () => {
      if (!customerId) {
        throw new Error("Authentication required to fetch notifications");
      }

      try {
        const response = await axios.get(`${config.NOTIFICATION_BASE_URL}/api/v1/notifications`, {
          headers: {
            "X-Customer-Id": customerId
          },
          timeout: 5000
        });
        return response.data || [];
      } catch (error: any) {
        console.error(
          `[graphql-notifications] Error fetching notifications for customer ${customerId}:`,
          error.message
        );
        return [];
      }
    }
  };
}
