import * as AWS from 'aws-sdk'
import { gql, ApolloError } from 'apollo-server-lambda'
import { updateScore } from '../../score/scoreManager'

const client = new AWS.DynamoDB.DocumentClient()
const userTableName = process.env.USERS_TABLE_NAME

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
            const result = await updateScore(userId)
            return result
        }
    },

    Mutation: {
        updateUserInfo: async (_parent: any, args: any, context: any, _info: any) => {
            if (!userTableName) {
                throw new ApolloError("User table name could not be resolved")
            }
            const id = getUserIdFromContext(context)
            const username = args.input.username
            const params = {
                TableName: userTableName,
                Key: { id: id },
                UpdateExpression: 'SET #username = :username',
                ExpressionAttributeNames: {
                    '#username': 'username'
                },
                ExpressionAttributeValues: {
                    ':username': username
                }
            }

            await client.update(params).promise()
            return {
                "id": id,
                "username": username
            }
        }
    },

    Query: {
        currentUser: async (_parent: any, _args: any, context: any, _info: any) => {
            if (!userTableName) {
                throw new ApolloError("User table name could not be resolved")
            }

            const id = getUserIdFromContext(context)
            const params: AWS.DynamoDB.DocumentClient.GetItemInput = {
                TableName: userTableName,
                Key: { id: id }
            }

            const result = await client.get(params).promise()
            if (!result.Item) {
                throw new ApolloError("Current user could not be resolved")
            }

            return {
                "user": {
                    "id": result.Item.id,
                    "username": result.Item.username || ""
                }
            }
        },

        searchUsers: async (_parent: any, _args: any, _context: any, _info: any) => {
            return ""
        }
    }
}

function getUserIdFromContext(context: any): string {
    return context.event.requestContext.authorizer.userId
}