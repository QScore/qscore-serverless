export type EventType = "HOME" | "AWAY"

export type DynamoType = "Event" | "User" | "Follower" | "Following"

export interface Event {
    readonly userId: string
    readonly eventType: EventType
    readonly timestamp: string
}

export interface User {
    readonly userId: string,
    readonly followerCount?: number,
    readonly followingCount?: number,
    readonly username: string
}

export interface Following {
    readonly userId: string,
    readonly followingUserId: string
}

export interface Follower {
    readonly userId: string,
    readonly followerUserId: string
}

export interface UserDynamo {
    readonly PK: string,
    readonly SK: string,
    readonly GS1PK: string,
    readonly GS1SK: string,
    readonly userId: string,
    readonly followerCount?: number,
    readonly followingCount?: number,
    readonly username: string,
    readonly itemType: DynamoType
}

export interface EventDynamo {
    readonly PK: string,
    readonly SK: string,
    readonly itemType: DynamoType,
    readonly timestamp: string,
    readonly eventType: EventType,
    readonly userId: string
}

export interface FollowerDynamo {
    readonly PK: string,
    readonly SK: string,
    readonly itemType: string,
    readonly userId: string,
    readonly followerUserId: string
}

export interface FollowingDynamo {
    readonly PK: string,
    readonly SK: string,
    readonly itemType: string,
    readonly userId: string,
    readonly followingUserId: string
}