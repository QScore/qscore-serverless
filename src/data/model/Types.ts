import {UserDynamo} from "./dynamoTypes";

export type EventType = "HOME" | "AWAY"

export interface Event {
    readonly userId: string
    readonly eventType: EventType
    readonly timestamp: string
}

export interface User {
    readonly userId: string
    readonly followerCount?: number
    readonly followingCount?: number
    readonly username: string
    readonly allTimeScore?: number
    readonly score?: number
    readonly avatar?: string
    readonly isCurrentUserFollowing?: boolean
    readonly rank?: number
    readonly geofenceStatus?: EventType
}

export interface Follow {
    readonly userId: string
    readonly followingUserId: string
}