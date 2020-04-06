"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const apollo_server_lambda_1 = require("apollo-server-lambda");
const graphql_tools_1 = require("graphql-tools");
const geofenceEvent_js_1 = require("./types/geofenceEvent.js");
const user_js_1 = require("./types/user.js");
const schema = graphql_tools_1.mergeSchemas({
    schemas: [
        graphql_tools_1.makeExecutableSchema({
            typeDefs: geofenceEvent_js_1.typeDef,
            resolvers: geofenceEvent_js_1.resolvers
        }),
        graphql_tools_1.makeExecutableSchema({
            typeDefs: user_js_1.typeDef,
            resolvers: user_js_1.resolvers
        })
    ]
});
const server = new apollo_server_lambda_1.ApolloServer({
    schema: schema,
    context: ({ event, context }) => ({
        headers: event.headers,
        functionName: context.functionName,
        event,
        context
    })
});
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
};
//# sourceMappingURL=handler.js.map