/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {ApolloServer} from "apollo-server-lambda";
import {buildResolver, typeDef as userTypeDef} from './mainDefs';
import {Callback, Context} from 'aws-lambda';
import {injector} from '../data/injector';
import {testInjector} from "../data/testInjector";

let resolver
if (process.env.SLS_OFFLINE) {
    resolver = buildResolver(testInjector.localResolver)
} else {
    resolver = buildResolver(injector.mainResolver)
}

const server = new ApolloServer({
    typeDefs: userTypeDef,
    resolvers: resolver,
    context: ({event, context}) => ({
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