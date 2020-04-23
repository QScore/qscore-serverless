/* eslint-disable @typescript-eslint/no-explicit-any */
import { gql } from 'apollo-server-lambda'
import { mainResolver } from '../../data/injector';
import { UpdateUserInfoPayloadGql, CurrentUserPayloadGql, SearchUsersPayloadGql, FollowUserPayloadGql, UnfollowUserPayloadGql, GetUserPayloadGql, FollowedUsersPayloadGql, FollowingUsersPayloadGql } from './userInterfaces';

export const typeDef = gql`
schema {
    mutation: Mutation
    query: Query
}

type User {
    id: ID!
    username: String!
    score?: Float
    allTimeScore?: Float
    isCurrentUserFollowing?: Boolean
    followingCount?: Int
    followerCount?: Int
}

input UpdateUserInfoInput {
    username: String!
}

type UpdateUserInfoPayload {
    id: ID!,
    username: String!
}

type CurrentUserPayload {
    user: User!
}

input SearchUsersInput {
    searchQuery: String
}

type SearchUsersPayload {
    users: [User!]!
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
    userId: ID!
}

input UnfollowUserInput {
    userId: ID!
}

type UnfollowUserPayload {
    userId: ID!
}

type FollowedUsersPayload {
    users: [User!]!
}

type FollowingUsersPayload {
    users: [User!]!
}

type Mutation {
    updateUserInfo(input: UpdateUserInfoInput!): UpdateUserInfoPayload!
    followUser(input: FollowUserInput!): FollowUserPayload!
    unfollowUser(input: UnfollowUserInput!): UnfollowUserPayload!
}

type Query {
    currentUser: CurrentUserPayload!
    searchUsers(input: SearchUsersInput!): SearchUsersPayload!
    getUser(input: GetUserInput!): GetUserPayload!
    followedUsers: FolloweredUsersPayload!
    followers: FollowingUsersPayload!
}
`

function getUserIdFromContext(context: any): string {
    return context.event.requestContext.authorizer.userId
}

export const resolvers = {
    Mutation: {
        updateUserInfo: async (_parent: any, args: any, context: any, _info: any): Promise<UpdateUserInfoPayloadGql> => {
            const userId = getUserIdFromContext(context)
            const username = args.input.username
            return mainResolver.updateUserInfo(userId, username)
        },

        followUser: async (_parent: any, args: any, context: any, _info: any): Promise<FollowUserPayloadGql> => {
            const currentUserId = getUserIdFromContext(context)
            const userIdToFollow = args.input.userId
            return mainResolver.followUser(currentUserId, userIdToFollow)
        },

        unfollowUser: async (_parent: any, args: any, context: any, _info: any): Promise<UnfollowUserPayloadGql> => {
            const currentUserId = getUserIdFromContext(context)
            const userIdToUnfollow = args.input.userId
            return mainResolver.unfollowUser(currentUserId, userIdToUnfollow)
        }
    },

    Query: {
        currentUser: async (parent: any, args: any, context: any): Promise<CurrentUserPayloadGql> => {
            const userId = getUserIdFromContext(context)
            return await mainResolver.getCurrentUser(userId)
        },

        searchUsers: async (parent: any, args: any, context: any): Promise<SearchUsersPayloadGql> => {
            const userId = getUserIdFromContext(context)
            const searchQuery = args.input.searchQuery
            return await mainResolver.searchUsers(userId, searchQuery)
        },

        getUser: async (parent: any, args: any, context: any): Promise<GetUserPayloadGql> => {
            const userId = getUserIdFromContext(context)
            return await mainResolver.getUser(userId)
        },

        followers: async (parent: any, args: any, context: any): Promise<FollowedUsersPayloadGql> => {
            const userId = getUserIdFromContext(context)
            return await mainResolver.getFollowers(userId)
        },

        followedUsers: async (parent: any, args: any, context: any): Promise<FollowingUsersPayloadGql> => {
            const userId = getUserIdFromContext(context)
            return await mainResolver.getFollowedUsers(userId)
        },
    }
}
