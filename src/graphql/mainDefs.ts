/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {gql} from 'apollo-server-lambda';
import {
    CreateGeofenceEventPayloadGql,
    CreateUserPayloadGql,
    CurrentUserPayloadGql,
    FollowedUsersPayloadGql,
    FollowingUsersPayloadGql,
    FollowUserPayloadGql,
    GetUserPayloadGql,
    LeaderboardRangePayloadGql,
    SearchUsersPayloadGql,
    UnfollowUserPayloadGql,
    UpdateUserInfoPayloadGql
} from './graphqlTypes';
import {MainResolver} from '../data/mainResolver';

export const typeDef = gql`
    schema {
        mutation: Mutation
        query: Query
    }

    type User {
        userId: ID!
        username: String!
        score: Float
        allTimeScore: Float
        rank: Int
        avatar: String
        isCurrentUserFollowing: Boolean
        followingCount: Int
        followerCount: Int
    }

    input UpdateUserInfoInput {
        username: String
        avatar: String
    }

    type UpdateUserInfoPayload {
        id: ID!,
        username: String,
        avatar: String
    }

    type CurrentUserPayload {
        user: User!
    }

    input SearchUsersInput {
        searchQuery: String!
        limit: Int!
    }

    input SearchUsersWithCursorInput {
        cursor: String!
    }

    type SearchUsersPayload {
        users: [User!]!
        nextCursor: String
    }

    input GetUserInput {
        userId: ID!
    }

    type GetUserPayload {
        user: User
    }

    input FollowUserInput {
        userId: ID!
    }

    type FollowUserPayload {
        userId: ID
    }

    input UnfollowUserInput {
        userId: ID!
    }

    type UnfollowUserPayload {
        userId: ID
    }

    type FollowedUsersPayload {
        users: [User!]!
    }

    type FollowingUsersPayload {
        users: [User!]!
    }

    input LeaderboardRangeInput {
        start: Int!,
        end: Int!
    }

    type LeaderboardRangePayload {
        leaderboardScores: [LeaderboardScore!]!
    }

    type LeaderboardScore {
        user: User,
        rank: Int,
        score: String
    }

    input CreateGeofenceEventInput {
        eventType: GeofenceEventType!
    }

    type CreateGeofenceEventPayload {
        geofenceEvent: GeofenceEvent
    }

    input CreateUserInput {
        username: String!
    }

    type CreateUserPayload {
        user: User!
    }

    enum GeofenceEventType {
        HOME
        AWAY
    }

    type GeofenceEvent {
        timestamp: String!
        eventType: GeofenceEventType!
        userId: String!
    }

    type Mutation {
        updateUserInfo(input: UpdateUserInfoInput!): UpdateUserInfoPayload!
        followUser(input: FollowUserInput!): FollowUserPayload!
        unfollowUser(input: UnfollowUserInput!): UnfollowUserPayload!
        createGeofenceEvent(input: CreateGeofenceEventInput!): CreateGeofenceEventPayload!
        createUser(input: CreateUserInput!): CreateUserPayload!
    }

    type Query {
        currentUser: CurrentUserPayload!
        searchUsers(input: SearchUsersInput!): SearchUsersPayload!
        searchUsersWithCursor(input: SearchUsersWithCursorInput!): SearchUsersPayload!
        getUser(input: GetUserInput!): GetUserPayload!
        followedUsers: FollowedUsersPayload!
        followers: FollowingUsersPayload!
        getLeaderboardRange(input: LeaderboardRangeInput!): LeaderboardRangePayload!
    }
`

function getUserIdFromContext(context: any): string {
    return context.event.requestContext.authorizer.userId
}

export function buildResolver(resolver: MainResolver): any {
    return {
        Mutation: {
            createUser: async (_parent: any, args: any, context: any, _info: any): Promise<CreateUserPayloadGql> => {
                const userId = getUserIdFromContext(context)
                const username = args.input.username
                return resolver.createUser(userId, username)
            },

            updateUserInfo: async (_parent: any, args: any, context: any, _info: any): Promise<UpdateUserInfoPayloadGql> => {
                const userId = getUserIdFromContext(context)
                const username = args.input.username
                const avatar = args.input.avatar
                return resolver.updateUserInfo({userId, username, avatar})
            },

            followUser: async (_parent: any, args: any, context: any, _info: any): Promise<FollowUserPayloadGql> => {
                const currentUserId = getUserIdFromContext(context)
                const userIdToFollow = args.input.userId
                return resolver.followUser(currentUserId, userIdToFollow)
            },

            unfollowUser: async (_parent: any, args: any, context: any, _info: any): Promise<UnfollowUserPayloadGql> => {
                const currentUserId = getUserIdFromContext(context)
                const userIdToUnfollow = args.input.userId
                return resolver.unfollowUser(currentUserId, userIdToUnfollow)
            },
            createGeofenceEvent: async (_parent: any, args: any, context: any, _info: any): Promise<CreateGeofenceEventPayloadGql> => {
                const userId = context.event.requestContext.authorizer.userId
                const eventType = args.input.eventType
                return await resolver.createEvent(userId, eventType)
            }
        },

        Query: {
            currentUser: async (parent: any, args: any, context: any): Promise<CurrentUserPayloadGql> => {
                const userId = getUserIdFromContext(context)
                return await resolver.getCurrentUser(userId)
            },

            searchUsers: async (parent: any, args: any, context: any): Promise<SearchUsersPayloadGql> => {
                const userId = getUserIdFromContext(context)
                const searchQuery = args.input.searchQuery
                const limit = args.input.limit
                return await resolver.searchUsers(userId, searchQuery, limit)
            },

            searchUsersWithCursor: async (parent: any, args: any, context: any): Promise<SearchUsersPayloadGql> => {
                const cursor = args.input.cursor
                return await resolver.searchUsersWithCursor(cursor)
            },

            getUser: async (parent: any, args: any, context: any): Promise<GetUserPayloadGql> => {
                const userId = getUserIdFromContext(context)
                return await resolver.getUser(userId)
            },

            followers: async (parent: any, args: any, context: any): Promise<FollowedUsersPayloadGql> => {
                const userId = getUserIdFromContext(context)
                return await resolver.getFollowers(userId)
            },

            followedUsers: async (parent: any, args: any, context: any): Promise<FollowingUsersPayloadGql> => {
                const userId = getUserIdFromContext(context)
                return await resolver.getFollowedUsers(userId)
            },

            getLeaderboardRange: async (parent: any, args: any, context: any): Promise<LeaderboardRangePayloadGql> => {
                const start: number = args.input.start
                const end: number = args.input.end
                return await resolver.getLeaderboardRange(start, end)
            },
        }
    }
}
