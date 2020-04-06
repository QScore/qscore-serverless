"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const AWS = require("aws-sdk");
const apollo_server_lambda_1 = require("apollo-server-lambda");
const scoreManager_1 = require("../../score/scoreManager");
const client = new AWS.DynamoDB.DocumentClient();
const userTableName = process.env.USERS_TABLE_NAME;
exports.typeDef = apollo_server_lambda_1.gql `
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
`;
exports.resolvers = {
    User: {
        score: async (_parent, _args, context, _info) => {
            const userId = getUserIdFromContext(context);
            const result = await scoreManager_1.updateScore(userId);
            return result;
        }
    },
    Mutation: {
        updateUserInfo: async (_parent, args, context, _info) => {
            if (!userTableName) {
                throw new apollo_server_lambda_1.ApolloError("User table name could not be resolved");
            }
            const id = getUserIdFromContext(context);
            const username = args.input.username;
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
            };
            await client.update(params).promise();
            return {
                "id": id,
                "username": username
            };
        }
    },
    Query: {
        currentUser: async (_parent, _args, context, _info) => {
            if (!userTableName) {
                throw new apollo_server_lambda_1.ApolloError("User table name could not be resolved");
            }
            const id = getUserIdFromContext(context);
            const params = {
                TableName: userTableName,
                Key: { id: id }
            };
            const result = await client.get(params).promise();
            if (!result.Item) {
                throw new apollo_server_lambda_1.ApolloError("Current user could not be resolved");
            }
            return {
                "user": {
                    "id": result.Item.id,
                    "username": result.Item.username || ""
                }
            };
        },
        searchUsers: async (_parent, _args, _context, _info) => {
            return "";
        }
    }
};
function getUserIdFromContext(context) {
    return context.event.requestContext.authorizer.userId;
}
//# sourceMappingURL=user.js.map