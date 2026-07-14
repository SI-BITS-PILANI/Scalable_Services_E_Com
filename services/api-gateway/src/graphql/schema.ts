import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLField,
  GraphQLString,
  GraphQLInt,
  GraphQLFloat,
  GraphQLList,
  GraphQLNonNull
} from "graphql";

// Product type
const ProductType = new GraphQLObjectType({
  name: "Product",
  description: "Product from catalog service",
  fields: () => ({
    id: { type: new GraphQLNonNull(GraphQLString) },
    name: { type: new GraphQLNonNull(GraphQLString) },
    price: { type: new GraphQLNonNull(GraphQLFloat) },
    stock: { type: new GraphQLNonNull(GraphQLInt) },
    description: { type: GraphQLString }
  })
});

// OrderItem type
const OrderItemType = new GraphQLObjectType({
  name: "OrderItem",
  description: "Item in an order",
  fields: () => ({
    productId: { type: new GraphQLNonNull(GraphQLString) },
    quantity: { type: new GraphQLNonNull(GraphQLInt) },
    price: { type: GraphQLFloat }
  })
});

// Order type
const OrderType = new GraphQLObjectType({
  name: "Order",
  description: "Order from order service",
  fields: () => ({
    id: { type: new GraphQLNonNull(GraphQLString) },
    customerId: { type: new GraphQLNonNull(GraphQLString) },
    status: { type: new GraphQLNonNull(GraphQLString) },
    items: { type: new GraphQLList(OrderItemType) },
    total: { type: GraphQLFloat },
    createdAt: { type: GraphQLString },
    updatedAt: { type: GraphQLString }
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
    }
  })
});

// Create schema
export const graphqlSchema = new GraphQLSchema({
  query: QueryType
});
