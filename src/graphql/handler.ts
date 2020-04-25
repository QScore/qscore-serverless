/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ApolloServer } from "apollo-server-lambda";
import { typeDef as userTypeDef, buildResolver } from './types/user';
import { Context, Callback } from 'aws-lambda';
import { mainResolver } from '../data/injector';
import { testResolver } from '../data/testInjector';


let resolver
if (process.env.TEST_RESOLVER as boolean | undefined == true) {
  resolver = buildResolver(testResolver)
} else {
  resolver = buildResolver(mainResolver)
}

const server = new ApolloServer({
  typeDefs: userTypeDef,
  resolvers: resolver,
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
  })
  return handler(event, context, callback)
}