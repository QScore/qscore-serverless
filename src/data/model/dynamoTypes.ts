import {EventType} from "./types"

export type DynamoType = "Event" | "User" | "Follow" | "Search"

export interface UserDynamo {
    readonly PK: string
    readonly SK: string
    readonly GS1PK: string
    readonly GS1SK: string
    readonly userId: string
    readonly followerCount: number
    readonly followingCount: number
    readonly username: string
    readonly itemType: DynamoType
    readonly allTimeScore: number
    readonly avatar?: string
}

export interface EventDynamo {
    readonly PK: string
    readonly SK: string
    readonly itemType: DynamoType
    readonly timestamp: string
    readonly eventType: EventType
    readonly userId: string
}

export interface FollowDynamo {
    readonly PK: string
    readonly SK: string
    readonly GS1PK: string
    readonly GS1SK: string
    readonly itemType: DynamoType
    readonly userId: string
    readonly followingUserId: string
}

export interface SearchDynamo {
    readonly PK: string
    readonly SK: string
    readonly username: string
    readonly userId: string
    readonly itemType: DynamoType
}
