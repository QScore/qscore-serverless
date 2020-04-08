import { gql, ApolloError } from 'apollo-server-lambda'
import { calculateScore } from '../../score/scoreManager'
import repository from '../../data/DynamoDbRepository'

export const typeDef = gql`
type User {
    id: ID!
    username: String!
    score: Float!
}

schema {
    mutation: Mutation
    query: Query
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

export const resolvers = {
    User: {
        score: async (_parent: any, _args: any, context: any, _info: any) => {
            const userId = getUserIdFromContext(context)
            const score = await calculateScore(userId, repository)
            await repository.updateUserScore(userId, score)
            return score
        }
    },

    Mutation: {
        updateUserInfo: async (_parent: any, args: any, context: any, _info: any) => {
            const userId = getUserIdFromContext(context)
            const username = args.input.username
            await repository.updateUsername(userId, username)
            return {
                "id": userId,
                "username": username
            }
        }
    },

    Query: {
        currentUser: async (_parent: any, _args: any, context: any, _info: any) => {
            const id = getUserIdFromContext(context)
            const user = await repository.getCurrentUser(id)
            if (!user) {
                throw new ApolloError("Current user could not be resolved")
            }

            return {
                "user": {
                    "id": user.id,
                    "username": user.username
                    //score will get calculated separately
                }
            }
        },

        searchUsers: async (_parent: any, _args: any, _context: any, _info: any) => {
            //TODO: refactor db to support this
            return ""
        }
    }
}

function getUserIdFromContext(context: any): string {
    return context.event.requestContext.authorizer.userId
}