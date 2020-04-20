export type EventType = "HOME" | "AWAY"

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

export interface Follow {
    readonly userId: string,
    readonly followingUserId: string
}

export interface LeaderboardScore {
    readonly rank: number,
    readonly userId: string,
    readonly username: string,
    readonly score: number
}

export type DynamoType = "Event" | "User" | "Follow"

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

export interface FollowDynamo {
    readonly PK: string,
    readonly SK: string,
    readonly GS1PK: string,
    readonly GS1SK: string,
    readonly itemType: DynamoType,
    readonly userId: string,
    readonly followingUserId: string
}