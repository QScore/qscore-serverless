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

type Query {
    currentUser: User!
}
`

export const resolvers = {
    Mutation: {
        updateUserInfo: async (parent, args, context, info) => {
            console.log(JSON.stringify(context.event.requestContext))

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
    }
}