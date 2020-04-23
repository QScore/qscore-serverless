import * as AWS from "aws-sdk"
import { Repository } from "./repository"
import { User, Event, EventDynamo, UserDynamo, FollowDynamo, Follow, LeaderboardScore, SearchDynamo } from './model/Types'
import { RedisCache, LeaderboardScoreRedis } from './redisCache';

const mainTable = process.env.MAIN_TABLE as string

export class MainRepository implements Repository {
    private documentClient: AWS.DynamoDB.DocumentClient
    private redisCache: RedisCache

    constructor(
        documentClient: AWS.DynamoDB.DocumentClient,
        redisCache: RedisCache
    ) {
        this.documentClient = documentClient
        this.redisCache = redisCache
    }

    async getAllTimeScore(userId: string): Promise<number> {
        return await this.redisCache.getAllTimeScore(userId)
    }

    async saveAllTimeScore(userId: string, score: number): Promise<void> {
        await this.redisCache.saveScoreToLeaderboard(userId, score)
    }

    async getAllTimeLeaderboardRank(userId: string): Promise<number> {
        return await this.redisCache.getLeaderboardRank(userId) + 1
    }

    async getLeaderboardScoreRange(min: number, max: number): Promise<LeaderboardScore[]> {
        const scores = await this.redisCache.getLeaderboardScoreRange(min, max)

        const userIds = scores.map(score => {
            return score.userId
        })

        //Batch get all usernames from scores
        const keys = userIds.map(userId => {
            return {
                PK: `USER#${userId}`,
                SK: `EVENT#9999`
            }
        })
        const batchGetParams: AWS.DynamoDB.DocumentClient.BatchGetItemInput = {
            RequestItems: {
                [mainTable]: {
                    Keys: keys
                }
            }
        }
        const batchGetResults = await this.documentClient.batchGet(batchGetParams).promise()
        const resultItems = batchGetResults.Responses?.[mainTable] ?? []

        const users: User[] = resultItems.map(resultItem => {
            return {
                userId: resultItem.userId,
                username: resultItem.username
            }
        })
        const userMap = new Map(users.map(user => [user.userId, user]));

        //Filter scores that do not have a corresponding user 
        const sortedScores: LeaderboardScoreRedis[] = scores.sort((a, b) => (a.rank > b.rank) ? 1 : -1)

        const filteredScores = sortedScores.reduce((output, score, index) => {
            if (userMap.has(score.userId)) {
                //array push
                output.push({
                    user: userMap[score.userId],
                    rank: score.rank,
                    score: score.score
                })
            }
            return output
        }, [] as LeaderboardScore[]);

        //Handle duplicate scores and assign the same rank
        const finalResult: LeaderboardScore[] = filteredScores.map((score, index) => {
            const previousItem = sortedScores[index - 1]
            if (previousItem) {
                let newRank = 0
                if (previousItem.score == score.score) {
                    newRank = previousItem.rank
                } else {
                    newRank = previousItem.rank + 1
                }
                return {
                    user: score.user,
                    rank: newRank,
                    score: score.score
                }
            } else {
                return {
                    user: score.user,
                    rank: score.rank,
                    score: score.score
                }
            }
        })
        return finalResult
    }

    async getWhichUsersAreFollowed(currentUserId: string, userIdsToCheck: string[]): Promise<string[]> {
        const keys = userIdsToCheck.map(userId => {
            return {
                PK: `USER#${currentUserId}`,
                SK: `FOLLOWING#${userId}`
            }
        })

        const batchGetParams: AWS.DynamoDB.DocumentClient.BatchGetItemInput = {
            RequestItems: {
                [mainTable]: {
                    Keys: keys
                }
            }
        }
        const results = await this.documentClient.batchGet(batchGetParams).promise()
        return results.Responses?.[mainTable].map((user: FollowDynamo) => {
            return user.followingUserId
        }) ?? []
    }

    async searchUsers(searchQuery: string): Promise<User[]> {
        const eventParams: AWS.DynamoDB.DocumentClient.QueryInput = {
            TableName: mainTable,
            KeyConditionExpression: '#PK = :PK And begins_with(#SK, :SK)',
            ExpressionAttributeNames: {
                '#PK': "PK",
                '#SK': "SK"
            },
            ExpressionAttributeValues: {
                ':PK': `SEARCH`,
                ':SK': searchQuery.toLowerCase(),
            }
        }
        const queryResult = await this.documentClient.query(eventParams).promise()
        if (!queryResult.Items || queryResult.Items.length == 0) {
            return []
        }
        const users = queryResult.Items.map(item => {
            const user: User = {
                userId: item.userId,
                username: item.username,
                followerCount: item.followerCount,
                followingCount: item.followingCount,
                allTimeScore: item.allTimeScore,
                score: item.score
            }
            return user
        })
        return users
    }

    async unfollowUser(currentUserId: string, targetUserId: string): Promise<void> {
        const params: AWS.DynamoDB.DocumentClient.TransactWriteItemsInput = {
            TransactItems: [
                {
                    Delete: {
                        TableName: mainTable,
                        Key: {
                            PK: `USER#${currentUserId}`,
                            SK: `FOLLOWING#${targetUserId}`,
                        }
                    }
                },
                {
                    Update: {
                        TableName: mainTable,
                        Key: {
                            PK: `USER#${currentUserId}`,
                            SK: `EVENT#9999`
                        },
                        UpdateExpression: `Set #followingCount = #followingCount - :inc`,
                        ExpressionAttributeNames: {
                            '#followingCount': 'followingCount'
                        },
                        ExpressionAttributeValues: {
                            ':inc': 1
                        }
                    }
                },
                {
                    Update: {
                        TableName: mainTable,
                        Key: {
                            PK: `USER#${targetUserId}`,
                            SK: `EVENT#9999`
                        },
                        UpdateExpression: `Set #followerCount = #followerCount - :inc`,
                        ExpressionAttributeNames: {
                            '#followerCount': 'followerCount'
                        },
                        ExpressionAttributeValues: {
                            ':inc': 1
                        }
                    }
                }
            ]
        }
        await this.documentClient.transactWrite(params).promise()
    }

    async followUser(currentUserId: string, targetUserId: string): Promise<void> {
        const followingItem: FollowDynamo = {
            PK: `USER#${currentUserId}`,
            SK: `FOLLOWING#${targetUserId}`,
            GS1PK: `USER#${targetUserId}`,
            GS1SK: `FOLLOWER#${currentUserId}`,
            itemType: `Follow`,
            followingUserId: targetUserId,
            userId: currentUserId
        }

        const params: AWS.DynamoDB.DocumentClient.TransactWriteItemsInput = {
            TransactItems: [
                {
                    Put: {
                        TableName: mainTable,
                        Item: followingItem
                    }
                },
                {
                    Update: {
                        TableName: mainTable,
                        Key: {
                            PK: `USER#${currentUserId}`,
                            SK: `EVENT#9999`
                        },
                        UpdateExpression: `Set #followingCount = #followingCount + :inc`,
                        ExpressionAttributeNames: {
                            '#followingCount': 'followingCount'
                        },
                        ExpressionAttributeValues: {
                            ':inc': 1
                        }
                    }
                },
                {
                    Update: {
                        TableName: mainTable,
                        Key: {
                            PK: `USER#${targetUserId}`,
                            SK: `EVENT#9999`
                        },
                        UpdateExpression: `Set #followerCount = #followerCount + :inc`,
                        ExpressionAttributeNames: {
                            '#followerCount': 'followerCount'
                        },
                        ExpressionAttributeValues: {
                            ':inc': 1
                        }
                    }
                }
            ]
        }
        await this.documentClient.transactWrite(params).promise()
    }

    async getFollowedUsers(currentUserId: string): Promise<User[]> {
        //Run the query
        const queryParams: AWS.DynamoDB.DocumentClient.QueryInput = {
            TableName: mainTable,
            KeyConditionExpression: '#PK = :PK And begins_with(#SK, :SK)',
            ExpressionAttributeNames: {
                '#PK': "PK",
                '#SK': "SK"
            },
            ExpressionAttributeValues: {
                ':PK': `USER#${currentUserId}`,
                ':SK': `FOLLOWING#`
            },
            ScanIndexForward: false
        }
        const queryResult = await this.documentClient.query(queryParams).promise()
        const users: Follow[] = queryResult.Items?.map(item => {
            return {
                userId: item.userId,
                followingUserId: item.followingUserId
            }
        }) ?? []
        if (users.length == 0) {
            return []
        }

        //Batch get users
        const keys = users.map(user => {
            return {
                PK: `USER#${user.followingUserId}`,
                SK: `EVENT#9999`
            }
        })

        const batchGetParams: AWS.DynamoDB.DocumentClient.BatchGetItemInput = {
            RequestItems: {
                [mainTable]: {
                    Keys: keys
                }
            }
        }
        const results = await this.documentClient.batchGet(batchGetParams).promise()
        return results.Responses?.[mainTable].map((user: UserDynamo) => {
            return {
                userId: user.userId,
                username: user.username,
                followerCount: user.followerCount,
                followingCount: user.followingCount,
                allTimeScore: user.allTimeScore,
            }
        }) ?? []
    }

    async getFollowers(userId: string): Promise<User[]> {
        //Run the query
        const queryParams: AWS.DynamoDB.DocumentClient.QueryInput = {
            TableName: mainTable,
            IndexName: 'GS1',
            KeyConditionExpression: '#GS1PK = :GS1PK And begins_with(#GS1SK, :GS1SK)',
            ExpressionAttributeNames: {
                '#GS1PK': "GS1PK",
                '#GS1SK': "GS1SK"
            },
            ExpressionAttributeValues: {
                ':GS1PK': `USER#${userId}`,
                ':GS1SK': `FOLLOWER#`
            },
            ScanIndexForward: false
        }
        const queryResult = await this.documentClient.query(queryParams).promise()
        const followerUsers: Follow[] = queryResult.Items?.map(item => {
            return {
                userId: item.userId,
                followingUserId: item.followingUserId
            }
        }) ?? []

        if (followerUsers.length == 0) {
            return []
        }

        //Batch get users
        const keys = followerUsers.map(user => {
            return {
                PK: `USER#${user.userId}`,
                SK: `EVENT#9999`
            }
        })

        const batchGetParams: AWS.DynamoDB.DocumentClient.BatchGetItemInput = {
            RequestItems: {
                [mainTable]: {
                    Keys: keys
                }
            }
        }
        const results = await this.documentClient.batchGet(batchGetParams).promise()
        return results.Responses?.[mainTable].map((user: UserDynamo) => {
            return {
                userId: user.userId,
                username: user.username,
                followerCount: user.followerCount,
                followingCount: user.followingCount,
                allTimeScore: user.allTimeScore
            }
        }) ?? []
    }

    async createEvent(event: Event): Promise<Event> {
        //Get most recent event and see if it is alternating event type, otherwise ignore.
        const latestEvent = await this.getLatestEventForUser(event.userId)
        if (latestEvent && latestEvent.eventType === event.eventType) {
            return latestEvent
        }

        //Set latest event in redis
        await this.redisCache.setLatestEvent(event)

        //Set latest event in dynamodb
        const inputItem: EventDynamo = {
            PK: `USER#${event.userId}`,
            SK: `EVENT#${event.timestamp}`,
            itemType: `Event`,
            eventType: event.eventType,
            timestamp: event.timestamp,
            userId: event.userId
        }

        const params: AWS.DynamoDB.DocumentClient.PutItemInput = {
            TableName: mainTable,
            Item: inputItem,
            ConditionExpression: "attribute_not_exists(#PK)",
            ExpressionAttributeNames: {
                "#PK": "PK"
            }
        }
        await this.documentClient.put(params).promise()
        return event
    }

    //This functions as a create sometimes
    async updateUsername(userId: string, username: string): Promise<void> {
        //Check for existing user:
        const existingUser = await this.getUser(userId)
        if (existingUser) {
            const params: AWS.DynamoDB.DocumentClient.TransactWriteItemsInput = {
                TransactItems: [
                    {
                        Update: {
                            TableName: mainTable,
                            Key: {
                                "PK": `USER#${userId}`,
                                "SK": `EVENT#9999`
                            },
                            UpdateExpression: "set username = :username",
                            ExpressionAttributeValues: {
                                ":username": username,
                            }
                        }
                    },
                    {
                        Delete: {
                            TableName: mainTable,
                            Key: {
                                "PK": `SEARCH`,
                                "SK": existingUser.username.toLowerCase()
                            }
                        }
                    },
                    {
                        Put: {
                            TableName: mainTable,
                            Item: {
                                PK: `SEARCH`,
                                SK: username.toLowerCase(),
                                username: username,
                                userId: userId
                            }
                        }
                    }
                ]
            }
            await this.documentClient.transactWrite(params).promise()
        } else {
            await this.createUser(userId, username)
        }
    }

    async createUser(userId: string, username: string): Promise<User> {
        const userItem: UserDynamo = {
            PK: `USER#${userId}`,
            SK: `EVENT#9999`,
            GS1PK: `SCORE#ALL_TIME`,
            GS1SK: "0",
            itemType: `User`,
            userId: userId,
            username: username,
            followerCount: 0,
            followingCount: 0,
            allTimeScore: 0
        }

        const searchItem: SearchDynamo = {
            PK: `SEARCH`,
            SK: username.toLowerCase(),
            username: username,
            userId: userId
        }

        const params: AWS.DynamoDB.DocumentClient.TransactWriteItemsInput = {
            TransactItems: [
                {
                    Put: {
                        TableName: mainTable,
                        Item: userItem,
                        ConditionExpression: "attribute_not_exists(#PK)",
                        ExpressionAttributeNames: {
                            "#PK": "PK"
                        }
                    }
                },
                {
                    Put: {
                        TableName: mainTable,
                        Item: searchItem,
                        ConditionExpression: "attribute_not_exists(#PK)",
                        ExpressionAttributeNames: {
                            "#PK": "PK"
                        }
                    }
                }
            ]
        }
        await this.documentClient.transactWrite(params).promise()
        return {
            userId: userId,
            username: username,
            allTimeScore: 0,
            followerCount: 0,
            followingCount: 0
        }
    }

    async getUserAndEventsFromStartTime(userId: string, startTimestamp: string): Promise<GetUserAndEventsResult> {
        //Run the query
        const eventParams: AWS.DynamoDB.DocumentClient.QueryInput = {
            TableName: mainTable,
            KeyConditionExpression: '#PK = :PK And #SK BETWEEN :SK and :END',
            ExpressionAttributeNames: {
                '#PK': "PK",
                '#SK': "SK"
            },
            ExpressionAttributeValues: {
                ':PK': `USER#${userId}`,
                ':SK': `EVENT#${startTimestamp}`,
                ':END': `EVENT#9999`
            },
            ScanIndexForward: true
        }
        const queryResult = await this.documentClient.query(eventParams).promise()

        const userResult = queryResult.Items?.pop()
        if (!userResult) {
            return {
                user: undefined,
                events: []
            }
        }

        //Return results
        const user: User = {
            userId: userResult.userId,
            username: userResult.username,
            followerCount: userResult.followerCount,
            followingCount: userResult.followingCount,
            allTimeScore: userResult.allTimeScore
        }
        const events = queryResult.Items as Event[]
        return {
            user: user,
            events: events
        }
    }

    async getLatestEventForUser(userId: string): Promise<Event | undefined> {
        const latestEventRedis = await this.redisCache.getLatestEvent(userId)
        if (!latestEventRedis) {
            return undefined
        }
        return {
            eventType: latestEventRedis.eventType,
            timestamp: latestEventRedis.timestamp,
            userId: latestEventRedis.userId
        }
    }

    async getUser(userId: string): Promise<User | undefined> {
        const params: AWS.DynamoDB.DocumentClient.GetItemInput = {
            TableName: mainTable,
            Key: {
                PK: `USER#${userId}`,
                SK: 'EVENT#9999'
            }
        }
        const result = await this.documentClient.get(params).promise()
        if (!result.Item) {
            return undefined
        }
        return {
            userId: result.Item.userId,
            username: result.Item.username,
            followerCount: result.Item.followerCount,
            followingCount: result.Item.followingCount,
            allTimeScore: result.Item.allTimeScore
        }
    }
}

export interface GetUserAndEventsResult {
    readonly user?: User
    readonly events: Event[]
}