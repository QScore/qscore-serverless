import { ApolloServer } from "apollo-server-lambda";
import { typeDef as userTypeDef, resolvers as userResolvers } from './types/user';
import { Context, Callback } from 'aws-lambda';

const server = new ApolloServer({
  typeDefs: userTypeDef,
  resolvers: userResolvers,
  context: ({ event, context }) => ({
    headers: event.headers,
    functionName: context.functionName,
    event,
    context
  })
})

exports.graphqlHandler = (event: any, context: Context, callback: Callback) => {
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