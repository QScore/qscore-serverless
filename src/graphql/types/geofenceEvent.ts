import { gql } from 'apollo-server-lambda'
import { dynamoDbRepository } from '../../data/DynamoDbRepository'

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
        createGeofenceEvent: async (_parent: any, args: any, context: any, _info: any) => {
            const userId = context.event.requestContext.authorizer.userId
            const eventType = args.input.eventType
            const userLocation = {
                lat: args.input.userLocationLat,
                lng: args.input.userLocationLng
            }
            console.log("userLocation: " + JSON.stringify(userLocation))
            const event = await dynamoDbRepository.createEvent(userId, eventType, userLocation)
            const result = {
                "geofenceEvent": event
            }
            return result
        }
    }
}