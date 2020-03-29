import { ApolloServer } from 'apollo-server-lambda';
import { makeExecutableSchema } from 'graphql-tools';
import { merge } from 'lodash';
import { typeDef as geofenceEventTypeDef, resolvers as geofenceEventResolvers} from './data/types/geofenceEvent.js';

// Resolvers
const schema = makeExecutableSchema({
  typeDefs: [geofenceEventTypeDef],
  resolvers: merge(geofenceEventResolvers)
});

const server = new ApolloServer({
  schema,
  context: ({ event, context }) => ({
    headers: event.headers,
    functionName: context.functionName,
    event,
    context
  })
})

exports.graphqlHandler = (event, context, callback) => {
  console.log(`>>RUNNING`)
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

exports.record = (event, context, callback) => {
  event.Records.forEach((record) => {
    console.log(record.eventID);
    console.log(record.eventName);
    console.log('DynamoDB Record: %j', record.dynamodb);
  });
  callback(null, `Successfully processed ${event.Records.length} records.`);
}