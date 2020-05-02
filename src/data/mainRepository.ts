import * as AWS from "aws-sdk"
import {Repository} from "./repository"
import {Event, Follow, SearchResult, User} from './model/types'
import {EventDynamo, FollowDynamo, SearchDynamo, UserDynamo} from "./model/dynamoTypes";
import {LeaderboardScoreRedis, RedisCache} from './redisCache';
import {decrypt, encrypt} from "../util/encryption/encryptor";

const mainTable = process.env.MAIN_TABLE as string

export interface UserInfoParams {
    readonly userId: string,
    readonly username?: string,
    readonly avatar?: string
}

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

    async saveAllTimeScore(userId: string, score: number, latestEvent?: Event): Promise<void> {
        if (latestEvent) {
            const updatedEvent = Object.assign(latestEvent, {timestamp: Date.now()})
            await this.redisCache.setLatestEvent(updatedEvent)
        }
        await this.redisCache.saveScoreToLeaderboard(userId, score)
    }

    async getAllTimeLeaderboardRank(userId: string): Promise<number> {
        return await this.redisCache.getLeaderboardRank(userId) + 1
    }

    async getLeaderboardScoreRange(min: number, max: number): Promise<User[]> {
        const scores = await this.redisCache.getLeaderboardScoreRange(min, max)
        const userIds = scores.map(score => {
            return score.userId
        })

        if (userIds.length == 0) {
            return []
        }
        const users = await this.batchGetUsers(userIds)
        const userMap = new Map(users.map(user => [user.userId, user]));

        //Filter scores that do not have a corresponding user 
        const sortedScores: LeaderboardScoreRedis[] = scores.sort((a, b) => (a.rank > b.rank) ? 1 : -1)

        const filteredUsers = sortedScores.reduce((output, score) => {
            const user = userMap.get(score.userId)
            if (user) {
                console.log(">>UPDATED USER: " + JSON.stringify(score.score))
                const updatedUser: User =
                    Object.assign(user, {allTimeScore: score.score, rank: score.rank})
                //array push
                output.push(updatedUser)
            }
            return output
        }, [] as User[]);

        //Handle duplicate scores and assign the same rank
        let newRank = 0
        const finalResult: User[] = filteredUsers.map((user, index) => {
            const previousItem = sortedScores[index - 1]
            if (!previousItem) {
                newRank = 1
            } else if (user.allTimeScore && previousItem.score > user.allTimeScore) {
                newRank++
            }
            return {
                userId: user.userId,
                username: user.username,
                followerCount: user.followerCount,
                followingCount: user.followingCount,
                allTimeScore: user.allTimeScore,
                avatar: user.avatar,
                rank: newRank
            }
        })
        return finalResult
    }

    //TODO: Paginate this
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

    async searchUsersWithCursor(cursor: string): Promise<SearchResult> {
        const queryInput = JSON.parse(decrypt(cursor)) as AWS.DynamoDB.DocumentClient.QueryInput
        return await this.doSearch(queryInput)
    }

    async searchUsers(searchQuery: string, limit: number): Promise<SearchResult> {
        const queryInput: AWS.DynamoDB.DocumentClient.QueryInput = {
            TableName: mainTable,
            KeyConditionExpression: '#PK = :PK And begins_with(#SK, :SK)',
            ExpressionAttributeNames: {
                '#PK': "PK",
                '#SK': "SK"
            },
            ExpressionAttributeValues: {
                ':PK': `SEARCH`,
                ':SK': searchQuery.toLowerCase(),
            },
            Limit: limit
        }
        return await this.doSearch(queryInput)
    }

    private async doSearch(queryInput: AWS.DynamoDB.DocumentClient.QueryInput): Promise<SearchResult> {
        const queryResult = await this.documentClient.query(queryInput).promise()
        if (!queryResult.Items || queryResult.Items.length == 0) {
            return {
                users: [],
                nextCursor: undefined
            }
        }

        //Batch get users
        const userIds = queryResult.Items.map(user => {
            return user.userId
        })

        const users = await this.batchGetUsers(userIds)
        return {
            users: users,
            nextCursor: ((): string | undefined => {
                const lastKey = queryResult?.LastEvaluatedKey
                if (!lastKey) {
                    return undefined
                }

                const newQuery = queryInput
                newQuery.ExclusiveStartKey = queryResult?.LastEvaluatedKey
                return encrypt(JSON.stringify(newQuery))
            })()
        }
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

        const userIds = users.map((user) => {
            return user.followingUserId
        })

        return await this.batchGetUsers(userIds)
    }

    private async batchGetUsers(userIds: string[]): Promise<User[]> {
        //Batch get users
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
        const results = await this.documentClient.batchGet(batchGetParams).promise()
        return results.Responses?.[mainTable].map((user: UserDynamo) => {
            return {
                userId: user.userId,
                username: user.username,
                followerCount: user.followerCount,
                followingCount: user.followingCount,
                allTimeScore: user.allTimeScore,
                avatar: user.avatar
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
            return user.userId
        })

        return await this.batchGetUsers(keys)
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

    async updateUserInfo(userInfoParams: UserInfoParams): Promise<void> {
        //Check for existing user:
        const {userId, avatar, username} = userInfoParams
        const existingUser = await this.getUser(userId)

        const transactItems: AWS.DynamoDB.DocumentClient.TransactWriteItemList = []
        const update: AWS.DynamoDB.DocumentClient.TransactWriteItem = {
            Update: {
                TableName: mainTable,
                Key: {
                    "PK": `USER#${userId}`,
                    "SK": `EVENT#9999`
                },
                UpdateExpression: ((): string => {
                    let setExpressions: string[] = []
                    if (username) {
                        setExpressions.push("username = :username")
                    }
                    if (avatar) {
                        setExpressions.push("avatar = :avatar")
                    }

                    let result = ""
                    if (setExpressions.length > 0) result += " set " + setExpressions.join(",")
                    return result
                })(),
                ExpressionAttributeValues: ((): AWS.DynamoDB.DocumentClient.ExpressionAttributeValueMap => {
                    const result: AWS.DynamoDB.DocumentClient.ExpressionAttributeValueMap = {}
                    result[":username"] = username
                    result[":avatar"] = avatar
                    return result
                })()
            }
        }
        transactItems.push(update)

        if (username && existingUser?.username != username) {
            //Username changed, update it
            transactItems.push({
                Delete: {
                    TableName: mainTable,
                    Key: {
                        "PK": `SEARCH`,
                        "SK": existingUser?.username.toLowerCase()
                    }
                }
            })
            transactItems.push({
                Put: {
                    TableName: mainTable,
                    Item: {
                        PK: `SEARCH`,
                        SK: username.toLowerCase(),
                        username: username,
                        userId: userId,
                        itemType: "Search"
                    }
                }
            })
        }

        const params: AWS.DynamoDB.DocumentClient.TransactWriteItemsInput = {
            TransactItems: transactItems
        }
        await this.documentClient.transactWrite(params).promise()
    }

    async createUser(userId: string, username: string, avatar?: string): Promise<User> {
        const userItem: UserDynamo = {
            PK: `USER#${userId}`,
            SK: `EVENT#9999`,
            GS1PK: `SCORE#ALL_TIME`,
            GS1SK: "0",
            itemType: `User`,
            avatar: avatar,
            userId: userId,
            username: username,
            followerCount: 0,
            followingCount: 0,
            allTimeScore: 0,
        }

        const searchItem: SearchDynamo = {
            PK: `SEARCH`,
            SK: username.toLowerCase(),
            username: username,
            userId: userId,
            itemType: "Search"
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
            followingCount: 0,
            avatar: avatar
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
            allTimeScore: userResult.allTimeScore,
            avatar: userResult.avatar
        }
        const events = queryResult.Items as Event[]
        return {
            user: user,
            events: events
        }
    }

    async getLatestEventForUser(userId: string): Promise<Event | undefined> {
        const latestEvent = await this.redisCache.getLatestEvent(userId)
        if (!latestEvent) {
            //Couldn't find in redis, get from dynamodb
            const params: AWS.DynamoDB.DocumentClient.QueryInput = {
                TableName: mainTable,
                KeyConditionExpression: '#PK = :PK And #SK < :SK',
                ExpressionAttributeNames: {
                    '#PK': "PK",
                    '#SK': "SK"
                },
                ExpressionAttributeValues: {
                    ':PK': `USER#${userId}`,
                    ':SK': `EVENT#9999`
                },
                ScanIndexForward: false,
                Limit: 1
            }
            const result = await this.documentClient.query(params).promise()
            const latestEvent = result.Items?.pop() as Event
            if (!latestEvent) {
                return undefined
            }
            await this.redisCache.setLatestEvent(latestEvent)
            return latestEvent
        }
        return {
            eventType: latestEvent.eventType,
            timestamp: latestEvent.timestamp,
            userId: latestEvent.userId
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
            allTimeScore: result.Item.allTimeScore,
            avatar: result.Item.avatar
        }
    }
}

export interface GetUserAndEventsResult {
    readonly user?: User
    readonly events: Event[]
}