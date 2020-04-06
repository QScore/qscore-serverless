"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const apollo_server_lambda_1 = require("apollo-server-lambda");
const uuid_1 = require("uuid");
const AWS = require("aws-sdk");
const client = new AWS.DynamoDB.DocumentClient;
exports.typeDef = apollo_server_lambda_1.gql `
type GeofenceEvent {
    id: ID!
    timestamp: Int!
    eventType: GeofenceEventType!
    userLocation: Location!
    userId: String!
}

enum GeofenceEventType { 
    HOME
    AWAY
}

type Location {
    latitude: String!
    longitude: String!
}

schema {
    mutation: Mutation
    query: Query
}

type Mutation {
    createGeofenceEvent(input: CreateGeofenceEventInput!): CreateGeofenceEventPayload
}

input CreateGeofenceEventInput {
    eventType: GeofenceEventType!
    userLocationLat: String!
    userLocationLng: String!
}

type CreateGeofenceEventPayload {
    geofenceEvent: GeofenceEvent
}

type Query {
    test: String
}
`;
exports.resolvers = {
    Mutation: {
        createGeofenceEvent: async (_parent, args, context, _info) => {
            const geofenceEventsTableName = process.env.GEOFENCE_EVENTS_TABLE_NAME;
            if (!geofenceEventsTableName) {
                throw new apollo_server_lambda_1.ApolloError("Unable to find Geofence Events table name");
            }
            console.log(JSON.stringify(context.event.requestContext));
            const params = {
                TableName: geofenceEventsTableName,
                Item: {
                    id: uuid_1.v4(),
                    timestamp: Date.now(),
                    eventType: args.input.eventType,
                    userLocationLat: args.input.userLocationLat,
                    userLocationLng: args.input.userLocationLng,
                    userId: context.event.requestContext.authorizer.userId
                }
            };
            await client.put(params).promise();
            return {
                "geofenceEvent": {
                    "id": params.Item.id,
                    "timestamp": params.Item.timestamp,
                    "eventType": params.Item.eventType,
                    "userLocation": {
                        "latitude": params.Item.userLocationLat,
                        "longitude": params.Item.userLocationLng
                    },
                    "userId": params.Item.userId
                }
            };
        }
    }
};
//# sourceMappingURL=geofenceEvent.js.map