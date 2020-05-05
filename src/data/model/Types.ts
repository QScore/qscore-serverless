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
    readonly avatar: (string | undefined)
    readonly isCurrentUserFollowing?: boolean
    readonly rank?: number
}

export interface UserListResult {
    readonly users: User[]
    readonly nextCursor: (string | undefined)
}

export interface Follow {
    readonly userId: string
    readonly followingUserId: string
}

