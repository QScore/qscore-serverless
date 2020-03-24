const schema = `type GeofenceEvent {
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

type User {
    id: ID!
    username: String!
}

schema {
    mutation: RootMutation
}

type RootMutation {
    createGeofenceEvent(input: CreateGeofenceEventInput!): CreateGeofenceEventPayload
    createUser(input CreateUserEventInput!): CreateUserEventPayload
}

input GeofenceEventInput {
    timestamp: String!
    eventType: GeofenceEventType!
    userLocationLat: String!
    userLocationLng: String!
    userId: String!
}

type GeofenceEventPayload {
    geofenceEvent: GeofenceEvent
}

input CreateUserEventInput {
    username: String!
}

type CreateUserEventPayload {
    user: User
}

type Query {
    getUserScore(userId: String!): Float!
}`

export { schema }
