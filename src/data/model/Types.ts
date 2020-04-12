export type EventType = "HOME" | "AWAY"

export type DynamoType = "Event" | "User"

export interface EventV2 {
    readonly userId: string
    readonly eventType: EventType
    readonly timestamp: string
}

export interface UserV2 {
    readonly userId: string,
    readonly followerCount: number,
    readonly followingCount: number,
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
    readonly userId: string,
    readonly followerCount: number,
    readonly followingCount: number,
    readonly username: string,
    readonly usernameLowercase: string
    readonly type: DynamoType
}

export interface EventDynamo {
    readonly PK: string,
    readonly SK: string,
    readonly type: DynamoType,
    readonly timestamp: string,
    readonly eventType: EventType,
    readonly userId: string
}

export interface FollowerDynamo {
    readonly PK: string,
    readonly SK: string,
    readonly type: string,
    readonly userId: string,
    readonly followerUserId: string
}

export interface FollowingDynamo {
    readonly PK: string,
    readonly SK: string,
    readonly type: string,
    readonly userId: string,
    readonly followingUserId: string
}