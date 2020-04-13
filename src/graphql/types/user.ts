import { gql, ApolloError } from 'apollo-server-lambda'
import * as scoreManager from '../../score/scoreManager'
import { dynamoDbRepository } from '../../data/DynamoDbRepository'

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
    Mutation: {
        updateUserInfo: async (_parent: any, args: any, context: any, _info: any) => {
            const userId = getUserIdFromContext(context)
            const username = args.input.username
            await dynamoDbRepository.updateUsername(userId, username) //TODO:
            return {
                "id": userId,
                "username": username
            }
        }
    },

    Query: {
        currentUser: async (_parent: any, _args: any, context: any, _info: any) => {
            const id = getUserIdFromContext(context)
            const oneDayMillis = 24 * 60 * 60 * 1000
            const yesterdayMillis = Date.now() - oneDayMillis
            const startTime = new Date(yesterdayMillis).toISOString()
            const { user, events } = await dynamoDbRepository.getUserAndEventsFromStartTime(id, startTime)
            if (!user || !events) {
                throw new ApolloError("Current user could not be resolved")
            }

            let score = 0
            if (events.length == 0) {
                //No events in the last 24 hours, get latest event to calculate score
                const event = await dynamoDbRepository.getLatestEventForUser(id)
                score = scoreManager.calculateScoreIfNoEventsIn24Hours(event)
            } else {
                score = scoreManager.calculateScore(events)
            }
            return {
                user: {
                    id: user.userId,
                    username: user.username,
                    followingCount: user.followingCount,
                    followerCount: user.followerCount,
                    score: score
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