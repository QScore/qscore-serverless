import { gql } from 'apollo-server-lambda'
import { mainResolver } from '../../data/injector';

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

export interface GeofenceEventGql {
    readonly timestamp: string,
    readonly userId: string,
    readonly eventType: "HOME" | "AWAY"
}

export interface CreateGeofenceEventPayloadGql {
    readonly geofenceEvent: GeofenceEventGql
}

export const resolvers = {
    Mutation: {
        createGeofenceEvent: async (_parent: any, args: any, context: any, _info: any): Promise<CreateGeofenceEventPayloadGql> => {
            const userId = context.event.requestContext.authorizer.userId
            const eventType = args.input.eventType
            return await mainResolver.createEvent(userId, eventType)
        }
    }
}