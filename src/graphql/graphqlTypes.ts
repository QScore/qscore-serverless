import {User} from '../data/model/types';

export interface SearchUsersPayloadGql {
    readonly users: User[]
    readonly nextCursor: (string | undefined)
}


export interface CreateUserPayloadGql {
    readonly user: User
}

export interface CurrentUserPayloadGql {
    readonly user: User
}

export interface UpdateUserInfoPayloadGql {
    readonly id: string
    readonly username?: string
    readonly avatar?: string
}

export interface FollowUserPayloadGql {
    readonly userId?: string
}

export interface UnfollowUserPayloadGql {
    readonly userId?: string
}

export interface GetUserPayloadGql {
    readonly user?: User
}

export interface FollowedUsersPayloadGql {
    readonly users: User[]
}

export interface FollowingUsersPayloadGql {
    readonly users: User[]
}

export interface LeaderboardRangePayloadGql {
    readonly users: User[]
}

export interface GeofenceEventGql {
    readonly timestamp: string
    readonly userId: string
    readonly eventType: "HOME" | "AWAY"
}

export interface CreateGeofenceEventPayloadGql {
    readonly geofenceEvent: GeofenceEventGql
}
