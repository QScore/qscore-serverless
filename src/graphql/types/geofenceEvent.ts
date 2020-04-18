import { gql } from 'apollo-server-lambda'
import { dynamoDbRepository } from '../../data/DynamoDbRepository'
import { Event } from '../../data/model/Types'

export const typeDef = gql`
type GeofenceEvent {
    timestamp: String!
    eventType: GeofenceEventType!
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
            const input: Event = {
                eventType: eventType,
                timestamp: new Date().toISOString(),
                userId: userId
            }
            const event = await dynamoDbRepository.createEvent(input)
            const result = {
                "geofenceEvent": event
            }
            return result
        }
    }
}