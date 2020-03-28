import { gql } from 'apollo-server-lambda'
import uuid from 'uuid/v1'
import dynamodb from 'serverless-dynamodb-client';
const client = dynamodb.doc

export const typeDef = gql`
type GeofenceEvent {
    id: ID!
    timestamp: String!
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
        createGeofenceEvent: async (parent, args, context, info) => {
            const params = {
                TableName: process.env.GEOFENCE_EVENTS_TABLE_NAME,
                Item: {
                    id: uuid(),
                    timestamp: Date.now().toString(),
                    eventType: args.input.eventType,
                    userLocationLat: args.input.userLocationLat,
                    userLocationLng: args.input.userLocationLng,
                    userId: context.event.requestContext.identity.cognitoIdentityId
                }
            }
            const result = await client.put(params).promise()
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