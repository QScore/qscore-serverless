"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const apollo_server_lambda_1 = require("apollo-server-lambda");
const scoreManager_1 = require("../../score/scoreManager");
const DynamoDbRepository_1 = require("../../data/DynamoDbRepository");
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
            const score = await scoreManager_1.calculateScore(userId, DynamoDbRepository_1.default);
            await DynamoDbRepository_1.default.updateUserScore(userId, score);
            return score;
        }
    },
    Mutation: {
        updateUserInfo: async (_parent, args, context, _info) => {
            const userId = getUserIdFromContext(context);
            const username = args.input.username;
            await DynamoDbRepository_1.default.updateUsername(userId, username);
            return {
                "id": userId,
                "username": username
            };
        }
    },
    Query: {
        currentUser: async (_parent, _args, context, _info) => {
            const id = getUserIdFromContext(context);
            const user = await DynamoDbRepository_1.default.getCurrentuser(id);
            if (!user) {
                throw new apollo_server_lambda_1.ApolloError("Current user could not be resolved");
            }
            return {
                "user": {
                    "id": user.id,
                    "username": user.username
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