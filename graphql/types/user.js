import { gql } from 'apollo-server-lambda'
import dynamodb from 'serverless-dynamodb-client';
const client = dynamodb.doc
const userTableName = process.env.USERS_TABLE_NAME
import { updateScore } from '../../score/scoreManager'

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
        score: async (parent, args, context, info) => {
            const userId = getUserIdFromContext(context)
            const result = await updateScore(userId)
            return result
        }
    },

    Mutation: {
        updateUserInfo: async (parent, args, context, info) => {
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
        currentUser: async (parent, args, context, info) => {
            const id = getUserIdFromContext(context)
            const params = {
                TableName: userTableName,
                Key: { id: id }
            }
            const result = await client.get(params).promise()
            return {
                "user": {
                    "id": result.Item.id,
                    "username": result.Item.username || ""
                }
            }
        },

        searchUsers: async (parent, args, context, info) => {
            const query = args.input.searchQuery
            const params = {
                TableName: userTableName,
                IndexName: "username-index",
                KeyConditionExpression: 'begins_with(username, :query)',
                ExpressionAttributeValues: {
                    ':query': query
                }
            }
            const result = await client.query(params).promise()
            return {
                "user": {
                    "id": result.Item.id,
                    "username": result.Item.username || "",
                    "score": result.Item.score || 100
                }
            }
        }
    }
}

function getUserIdFromContext(context) {
    return context.event.requestContext.authorizer.userId
}