import * as AWS from "aws-sdk"
import {Event, User, UserListResult} from './model/types'
import {EventDynamo, FollowDynamo, UserDynamo} from "./model/dynamoTypes";
import {RedisCache} from './redisCache';
import {decrypt, encrypt} from "../util/encryption/encryptor";

const mainTable = process.env.MAIN_TABLE as string

export interface UserInfoParams {
    readonly userId: string,
    readonly username?: string,
    readonly avatar?: string
}

export interface PrimaryKey {
    readonly PK: string
    readonly SK: string
}

export interface QueryInputAndOutput {
    readonly queryInput: AWS.DynamoDB.DocumentClient.QueryInput
    readonly queryOutput: AWS.DynamoDB.DocumentClient.QueryOutput
}

export class MainRepository {
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
        //Get leaderboard scores from redis
        const scores = await this.redisCache.getLeaderboardScoreRange(min, max)

        //If no scores, early return
        if (scores.length == 0) {
            return []
        }

        //Get users for scores
        const leaderboardUserIds = scores.map(score => {
            return score.userId
        })
        const users = await this.batchGetUsers(leaderboardUserIds)

        //Convert leaderboard scores to a map of userId -> Score
        const userIdToScoreMap = new Map(scores.map(score => [score.userId, score]));

        //Assign scores to each user
        users.forEach(user => {
            const scoreForUser = userIdToScoreMap.get(user.userId)
            Object.assign(user, {allTimeScore: scoreForUser?.score, rank: scoreForUser?.rank})
        })

        users.sort((a: User, b: User) => {
            return (b.allTimeScore ?? 0) - (a.allTimeScore ?? 0)
        })

        //Return users
        return users
    }

    async getWhichUsersAreFollowed(currentUserId: string, userIdsToCheck: string[]): Promise<string[]> {
        const keys: PrimaryKey[] = userIdsToCheck.map(userId => {
            return {
                PK: `USER#${currentUserId}`,
                SK: `FOLLOWING#${userId}`
            }
        })

        const results = await this.batchGet(keys)
        return results?.map((user: FollowDynamo) => {
            return user.followingUserId
        }) ?? []
    }

    async getFollowedUsersWithCursor(cursor: string): Promise<UserListResult> {
        const queryInput = JSON.parse(decrypt(cursor)) as AWS.DynamoDB.DocumentClient.QueryInput
        return await this.fetchUsers(queryInput, "followingUserId")
    }

    async getFollowersWithCursor(cursor: string): Promise<UserListResult> {
        const queryInput = JSON.parse(decrypt(cursor)) as AWS.DynamoDB.DocumentClient.QueryInput
        return await this.fetchUsers(queryInput, "userId")
    }

    async searchQueryWithCursor(cursor: string): Promise<UserListResult> {
        const queryInput = JSON.parse(decrypt(cursor)) as AWS.DynamoDB.DocumentClient.QueryInput
        return await this.fetchUsers(queryInput, "userId")
    }

    async searchUsers(searchQuery: string, currentUserId: string, limit: number): Promise<UserListResult> {
        const searchResult = await this.querySearchItems(searchQuery, limit)
        if (searchResult.users.length == 0) {
            return {
                users: [],
                nextCursor: undefined
            }
        }
        await this.setCurrentUserFollowingStatus(currentUserId, searchResult.users)
        return searchResult
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

    async getFollowedUsers(currentUserId: string): Promise<UserListResult> {
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
        return await this.fetchUsers(queryParams, "followingUserId")
    }

    async getFollowers(userId: string): Promise<UserListResult> {
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
        return await this.fetchUsers(queryParams, "userId")
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
                        setExpressions.push("GS1SK = :GS1SK")
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
                    result[":GS1SK"] = username?.toLowerCase()
                    return result
                })()
            }
        }
        transactItems.push(update)

        const params: AWS.DynamoDB.DocumentClient.TransactWriteItemsInput = {
            TransactItems: transactItems
        }
        await this.documentClient.transactWrite(params).promise()
    }

    async createUser(userId: string, username: string, avatar?: string): Promise<User> {
        const userItem: UserDynamo = {
            PK: `USER#${userId}`,
            SK: `EVENT#9999`,
            GS1PK: `SEARCH`,
            GS1SK: username.toLowerCase(),
            itemType: `User`,
            avatar: avatar,
            userId: userId,
            username: username,
            followerCount: 0,
            followingCount: 0,
            allTimeScore: 0,
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

    async save24HourScore(userId: string, score24: number): Promise<void> {
        const params: AWS.DynamoDB.DocumentClient.UpdateItemInput = {
            TableName: mainTable,
            Key: {
                PK: `USER#${userId}`,
                SK: 'EVENT#9999'
            },
            UpdateExpression: 'set score24 = :score24',
            ExpressionAttributeValues: {
                ":score24": score24
            }
        }
        this.documentClient.update(params)
    }

    private async batchGet(keys: PrimaryKey[]) {
        const batchGetParams: AWS.DynamoDB.DocumentClient.BatchGetItemInput = {
            RequestItems: {
                [mainTable]: {
                    Keys: keys
                }
            }
        }
        const results = await this.documentClient.batchGet(batchGetParams).promise()
        return results.Responses?.[mainTable]
    }

    private async setCurrentUserFollowingStatus(currentUserId: string, users: User[]) {
        const userIdsToCheck: string[] = this.mapUsersToUserIds(users)
        const followedUserIds = await this.getWhichUsersAreFollowed(currentUserId, userIdsToCheck)
        const followedMap = this.convertUserIdsToMap(followedUserIds)
        users.forEach(user => {
            Object.assign(user, {isCurrentUserFollowing: followedMap.get(user.userId) ?? false})
        })
    }

    private convertUserIdsToMap(userIds: string[]) {
        return new Map(userIds.map(userId => [userId, true]));
    }

    private mapUsersToUserIds(users: User[]) {
        return users.map(item => {
            return item.userId
        })
    }

    private async querySearchItems(searchQuery: string, limit: number): Promise<UserListResult> {
        const result = await this.queryGs1BeginsWith('SEARCH', searchQuery.toLowerCase(), limit)
        const users = this.mapItemsToUsers(result.queryOutput.Items)
        return {
            users: users,
            nextCursor: this.buildCursorFromQuery(result.queryInput, result.queryOutput)
        }
    }

    private async queryGs1BeginsWith(gs1Pk: String, gs1Sk: String, limit: number): Promise<QueryInputAndOutput> {
        const queryInput: AWS.DynamoDB.DocumentClient.QueryInput = {
            TableName: mainTable,
            IndexName: "GS1",
            KeyConditionExpression: '#GS1PK = :GS1PK And begins_with(#GS1SK, :GS1SK)',
            ExpressionAttributeNames: {
                '#GS1PK': "GS1PK",
                '#GS1SK': "GS1SK"
            },
            ExpressionAttributeValues: {
                ':GS1PK': gs1Pk,
                ':GS1SK': gs1Sk,
            },
            Limit: limit
        }
        const queryOutput = await this.documentClient.query(queryInput).promise()
        return {
            queryInput: queryInput,
            queryOutput: queryOutput
        }
    }

    private buildCursorFromQuery(queryInput: AWS.DynamoDB.DocumentClient.QueryInput,
                                 queryOutput: AWS.DynamoDB.DocumentClient.QueryOutput): string | undefined {
        const lastKey = queryOutput?.LastEvaluatedKey
        if (!lastKey) {
            return undefined
        }

        const newQuery = queryInput
        newQuery.ExclusiveStartKey = queryOutput?.LastEvaluatedKey
        return encrypt(JSON.stringify(newQuery))
    }

    private mapItemsToUsers(items?: AWS.DynamoDB.DocumentClient.ItemList): User[] {
        return items?.map((item: User) => {
            return {
                userId: item.userId,
                username: item.username,
                allTimeScore: item.allTimeScore,
                avatar: item.avatar,
                followerCount: item.followerCount,
                followingCount: item.followingCount,
                score: item.score,
                rank: item.rank
            }
        }) ?? []
    }

    private async fetchUsers(queryInput: AWS.DynamoDB.DocumentClient.QueryInput, userIdProperty: string): Promise<UserListResult> {
        const queryResult = await this.documentClient.query(queryInput).promise()
        if (!queryResult.Items || queryResult.Items.length == 0) {
            return {
                users: [],
                nextCursor: undefined
            }
        }

        //Batch get users
        const userIds = queryResult.Items.map(item => {
            return item[userIdProperty]
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

    private convertUsersToMap(users: User[]) {
        return new Map(users.map(user => [user.userId, user]));
    }
}

export interface GetUserAndEventsResult {
    readonly user?: User
    readonly events: Event[]
}