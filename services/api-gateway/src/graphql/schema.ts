import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLString,
  GraphQLInt,
  GraphQLFloat,
  GraphQLBoolean,
  GraphQLList,
  GraphQLNonNull
} from "graphql";

function firstDefined<T>(...values: Array<T | null | undefined>): T | undefined {
  return values.find((value) => value !== undefined && value !== null);
}

// Product type
const ProductType = new GraphQLObjectType({
  name: "Product",
  description: "Product from catalog service",
  fields: () => ({
    id: {
      type: new GraphQLNonNull(GraphQLString),
      resolve: (product: any) => firstDefined(product.id, product.product_id)
    },
    productId: {
      type: new GraphQLNonNull(GraphQLString),
      resolve: (product: any) => firstDefined(product.productId, product.product_id, product.id)
    },
    name: { type: new GraphQLNonNull(GraphQLString) },
    price: { type: new GraphQLNonNull(GraphQLFloat) },
    stock: { type: new GraphQLNonNull(GraphQLInt) },
    description: { type: GraphQLString },
    category: { type: GraphQLString },
    available: {
      type: GraphQLBoolean,
      resolve: (product: any) => firstDefined(product.available, (product.stock ?? 0) > 0)
    }
  })
});

// OrderItem type
const OrderItemType = new GraphQLObjectType({
  name: "OrderItem",
  description: "Item in an order",
  fields: () => ({
    productId: {
      type: new GraphQLNonNull(GraphQLString),
      resolve: (item: any) => firstDefined(item.productId, item.product_id)
    },
    quantity: { type: new GraphQLNonNull(GraphQLInt) },
    price: {
      type: GraphQLFloat,
      resolve: (item: any) => firstDefined(item.price, item.unit_price)
    },
    unitPrice: {
      type: GraphQLFloat,
      resolve: (item: any) => firstDefined(item.unitPrice, item.unit_price, item.price)
    },
    lineTotal: {
      type: GraphQLFloat,
      resolve: (item: any) => firstDefined(item.lineTotal, item.line_total)
    },
    name: { type: GraphQLString }
  })
});

// Order type
const OrderType = new GraphQLObjectType({
  name: "Order",
  description: "Order from order service",
  fields: () => ({
    id: {
      type: new GraphQLNonNull(GraphQLString),
      resolve: (order: any) => firstDefined(order.id, order.order_id, order.orderId)
    },
    orderId: {
      type: new GraphQLNonNull(GraphQLString),
      resolve: (order: any) => firstDefined(order.orderId, order.order_id, order.id)
    },
    customerId: {
      type: new GraphQLNonNull(GraphQLString),
      resolve: (order: any) => firstDefined(order.customerId, order.customer_id)
    },
    status: { type: new GraphQLNonNull(GraphQLString) },
    items: { type: new GraphQLList(OrderItemType) },
    total: {
      type: GraphQLFloat,
      resolve: (order: any) => firstDefined(order.total, order.subtotal)
    },
    createdAt: {
      type: GraphQLString,
      resolve: (order: any) => firstDefined(order.createdAt, order.created_at)
    },
    updatedAt: {
      type: GraphQLString,
      resolve: (order: any) => firstDefined(order.updatedAt, order.updated_at)
    }
  })
});

const NotificationType = new GraphQLObjectType({
  name: "Notification",
  description: "Notification from notification service",
  fields: () => ({
    id: {
      type: new GraphQLNonNull(GraphQLString),
      resolve: (notification: any) =>
        firstDefined(notification.id, notification.notification_id, notification.notificationId)
    },
    notificationId: {
      type: new GraphQLNonNull(GraphQLString),
      resolve: (notification: any) =>
        firstDefined(notification.notificationId, notification.notification_id, notification.id)
    },
    customerId: {
      type: new GraphQLNonNull(GraphQLString),
      resolve: (notification: any) => firstDefined(notification.customerId, notification.customer_id)
    },
    orderId: {
      type: GraphQLString,
      resolve: (notification: any) => firstDefined(notification.orderId, notification.order_id)
    },
    eventType: {
      type: new GraphQLNonNull(GraphQLString),
      resolve: (notification: any) => firstDefined(notification.eventType, notification.event_type)
    },
    message: { type: new GraphQLNonNull(GraphQLString) },
    read: { type: new GraphQLNonNull(GraphQLBoolean) },
    createdAt: {
      type: new GraphQLNonNull(GraphQLString),
      resolve: (notification: any) => firstDefined(notification.createdAt, notification.created_at)
    }
  })
});

const CustomerDashboardType = new GraphQLObjectType({
  name: "CustomerDashboard",
  description: "Composed customer dashboard view",
  fields: () => ({
    orders: { type: new GraphQLNonNull(new GraphQLList(OrderType)) },
    notifications: { type: new GraphQLNonNull(new GraphQLList(NotificationType)) }
  })
});

// Root Query type
const QueryType = new GraphQLObjectType({
  name: "Query",
  fields: () => ({
    products: {
      type: new GraphQLList(ProductType),
      description: "List all products from catalog service",
      resolve: (_source, _args, context: any) => context.productsResolver()
    },
    customerOrders: {
      type: new GraphQLList(OrderType),
      description: "Get orders for authenticated customer",
      resolve: (_source, _args, context: any) => context.ordersResolver()
    },
    customerDashboard: {
      type: new GraphQLNonNull(CustomerDashboardType),
      description: "Get a composed dashboard with customer orders and notifications",
      args: {
        customerId: { type: GraphQLString }
      },
      resolve: async (_source, args: { customerId?: string }, context: any) => {
        const authenticatedCustomerId = context.user?.sub;

        if (!authenticatedCustomerId) {
          throw new Error("Authentication required to fetch customer dashboard");
        }

        if (args.customerId && args.customerId !== authenticatedCustomerId) {
          throw new Error("Cannot access another customer's dashboard");
        }

        const [orders, notifications] = await Promise.all([
          context.ordersResolver(),
          context.notificationsResolver()
        ]);

        return {
          orders,
          notifications
        };
      }
    }
  })
});

// Create schema
export const graphqlSchema = new GraphQLSchema({
  query: QueryType
});
