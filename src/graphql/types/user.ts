import { gql, ApolloError } from 'apollo-server-lambda'
import { dynamoDbRepository } from '../../data/DynamoDbRepository'
import { User, Event } from '../../data/model/Types';
import { Repository } from '../../data/Repository';
import { UserResolver } from '../resolvers/UserResolver';

export const typeDef = gql`
schema {
    mutation: Mutation
    query: Query
}

type User {
    id: ID!
    username: String!
    score: Float
    isCurrentUserFollowing: Boolean
    followingCount: Int
    followerCount: Int
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

type Mutation {
    updateUserInfo(input: UpdateUserInfoInput!): UpdateUserInfoPayload!
}

type Query {
    currentUser: CurrentUserPayload!
    searchUsers(input: SearchUsersInput!): SearchUsersPayload!
}
`

export interface UserGql {
    readonly id: string,
    readonly username: string,
    readonly score?: number,
    readonly isCurrentUserFollowing?: boolean,
    readonly followingCount?: number,
    readonly followerCount?: number
}

export interface SearchUsersPayloadGql {
    readonly users: UserGql[]
}

export interface CurrentUserPayloadGql {
    readonly user: UserGql
}

export interface UpdateUserInfoPayloadGql {
    readonly id: string,
    readonly username: string
}

const userResolver = new UserResolver(dynamoDbRepository)

export const resolvers = {
    Mutation: {
        updateUserInfo: async (_parent: any, args: any, context: any, _info: any): Promise<UpdateUserInfoPayloadGql> => {
            const userId = getUserIdFromContext(context)
            const username = args.input.username
            return userResolver.updateUserInfo(userId, username)
        }
    },

    Query: {
        currentUser: async (parent: any, args: any, context: any, info: any): Promise<CurrentUserPayloadGql> => {
            const userId = getUserIdFromContext(context)
            return userResolver.getCurrentUser(userId)
        },

        searchUsers: async (parent: any, args: any, context: any, info: any): Promise<SearchUsersPayloadGql> => {
            const userId = getUserIdFromContext(context)
            const searchQuery = args.input.searchQuery
            return userResolver.searchUsers(userId, searchQuery)
        }
    }
}

function getUserIdFromContext(context: any): string {
    return context.event.requestContext.authorizer.userId
}