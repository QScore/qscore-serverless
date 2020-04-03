import { ApolloServer } from 'apollo-server-lambda';
import { makeExecutableSchema, mergeSchemas } from "graphql-tools"
import { typeDef as geofenceEventTypeDef, resolvers as geofenceEventResolvers} from './types/geofenceEvent.js';
import { typeDef as userTypeDef, resolvers as userResolvers} from './types/user.js';

const schema = mergeSchemas({
  schemas: [
      makeExecutableSchema({
          typeDefs: geofenceEventTypeDef,
          resolvers: geofenceEventResolvers
      }),
      makeExecutableSchema({
          typeDefs: userTypeDef,
          resolvers: userResolvers
      })
  ]
})

const server = new ApolloServer({
  schema: schema,
  context: ({ event, context }) => ({
    headers: event.headers,
    functionName: context.functionName,
    event,
    context
  })
})

exports.graphqlHandler = (event, context, callback) => {
  const handler = server.createHandler({
    cors: {
      origin: "*",
      credentials: true,
      methods: ["POST", "GET"],
      allowedHeaders: ["Content-Type", "Origin", "Accept"]
    }
  });
  return handler(event, context, callback);
}