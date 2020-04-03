import { gql } from 'apollo-server-lambda'
import dynamodb from 'serverless-dynamodb-client';
const client = dynamodb.doc

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

type Mutation {
    updateUserInfo(input: UpdateUserInfoInput!): UpdateUserInfoPayload!
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

type Query {
    currentUser: CurrentUserPayload!
}
`

export const resolvers = {
    Mutation: {
        updateUserInfo: async (parent, args, context, info) => {
            const id = context.event.requestContext.authorizer.userId
            const username = args.input.username
            const params = {
                TableName: process.env.USERS_TABLE_NAME,
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
            const id = context.event.requestContext.authorizer.userId
            const params = {
                TableName: process.env.USERS_TABLE_NAME,
                Key: { id: id }
            }
            const result = await client.get(params).promise()
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