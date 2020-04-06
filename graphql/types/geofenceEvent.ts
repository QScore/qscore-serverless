import { gql, ApolloError } from 'apollo-server-lambda'
import { v4 as uuid } from 'uuid';
import * as AWS from 'aws-sdk';
const client = new AWS.DynamoDB.DocumentClient

export const typeDef = gql`
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
`

export const resolvers = {
    Mutation: {
        createGeofenceEvent: async (_parent: any, args: any, context: any, _info: any) => {
            const geofenceEventsTableName = process.env.GEOFENCE_EVENTS_TABLE_NAME
            if (!geofenceEventsTableName) {
                throw new ApolloError("Unable to find Geofence Events table name")
            }

            console.log(JSON.stringify(context.event.requestContext))
            const params: AWS.DynamoDB.DocumentClient.PutItemInput = {
                TableName: geofenceEventsTableName,
                Item: {
                    id: uuid(),
                    timestamp: Date.now(),
                    eventType: args.input.eventType,
                    userLocationLat: args.input.userLocationLat,
                    userLocationLng: args.input.userLocationLng,
                    userId: context.event.requestContext.authorizer.userId
                }
            }
            await client.put(params).promise()
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
            }
        }
    }
}