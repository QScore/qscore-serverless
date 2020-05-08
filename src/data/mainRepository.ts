import * as AWS from "aws-sdk"
import {Event, User, UserListResult} from './model/types'
import {EventDynamo, FollowDynamo, UserDynamo} from "./model/dynamoTypes";
import {LeaderboardScoreRedis, RedisCache} from './redisCache';
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

export type LeaderboardType = "SOCIAL" | "GLOBAL"

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
        await this.redisCache.saveSocialScore(userId, userId, score)
    }

    async getAllTimeLeaderboardRank(userId: string): Promise<number> {
        return await this.redisCache.getLeaderboardRank(userId) + 1
    }

    async getSocialLeaderboard(currentUserId: string, start: number, end: number): Promise<User[]> {
        //Check for redis sorted set
        let scores = await this.redisCache.getSocialLeaderboardScoreRange(currentUserId, start, end)
        if (scores.length > 0) {
            //Update all social scores
            for (const score of scores) {
                const updated = await this.redisCache.getAllTimeScore(score.userId)
                await this.redisCache.saveSocialScore(currentUserId, score.userId, score.score)
            }
        } else {
            //Build a new sorted set with info from dynamodb
            //Get all followed userIds
            const allUserIds: string[] = []
            let startKey: AWS.DynamoDB.Key | undefined = undefined
            do {
                const queryInput = this.getFollowedUsersQuery(currentUserId, 100, startKey)
                const result = await this.documentClient.query(queryInput).promise()
                startKey = result.LastEvaluatedKey
                const followedUserIds = result.Items?.map((item: FollowDynamo) => item.followingUserId) ?? []
                allUserIds.push(...followedUserIds)
            } while (startKey)
            allUserIds.push(currentUserId)

            //Update all items to sorted set
            for (const followedUserId of allUserIds) {
                const score = await this.redisCache.getAllTimeScore(followedUserId)
                await this.redisCache.saveSocialScore(currentUserId, followedUserId, score)
            }

            //Query scores again
            scores = await this.redisCache.getSocialLeaderboardScoreRange(currentUserId, start, end)
        }

        //Set 5 minute expiration on the scores
        await this.redisCache.setSocialLeaderboardExpiration(currentUserId, 300)

        if (scores.length == 0) {
            return []
        }

        //Convert leaderboard scores to a map of userId -> Score
        const userIdToScoreMap = new Map(scores.map(score => [score.userId, score]));

        const leaderboardUserIds = scores.map(score => score.userId)
        const users = await this.batchGetUsers(leaderboardUserIds)

        //Assign scores to each user
        await this.assignScoresToUsers(users, userIdToScoreMap, currentUserId);

        //Return users
        return users
    }

    async getLeaderboardScoreRange(currentUserId: string, min: number, max: number): Promise<User[]> {
        //Get leaderboard scores from redis
        let scores = await this.redisCache.getLeaderboardScoreRange(min, max)

        //If no scores, early return
        if (scores.length == 0) {
            return []
        }

        //Get users for scores
        const leaderboardUserIds = scores.map(score => {
            return score.userId
        })
        const users = await this.batchGetUsers(leaderboardUserIds)

        //If any users are missing from scores, remove their score
        for (const leaderboardId of leaderboardUserIds) {
            const userIds = users.map(user => user.userId)
            if (!userIds.includes(leaderboardId)) {
                await this.redisCache.removeScore(leaderboardId)
                scores = await this.redisCache.getLeaderboardScoreRange(min, max)
            }
        }

        //Convert leaderboard scores to a map of userId -> Score
        const userIdToScoreMap = new Map(scores.map(score => [score.userId, score]))

        //Assign scores to each user
        await this.assignScoresToUsers(users, userIdToScoreMap, currentUserId)

        //Return users
        return users
    }

    async getWhichUsersAreFollowed(currentUserId: string, userIdsToCheck: string[]): Promise<string[]> {
        if (userIdsToCheck.length == 0) {
            return []
        }
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

    async getFollowedUsersWithCursor(currentUserId: string, cursor: string): Promise<UserListResult> {
        const queryInput = JSON.parse(decrypt(cursor)) as AWS.DynamoDB.DocumentClient.QueryInput
        const result = await this.fetchUsers(queryInput, "followingUserId")
        await this.setCurrentUserFollowingStatus(currentUserId, result.users)
        return result
    }

    async getFollowersWithCursor(currentUserId: string, cursor: string): Promise<UserListResult> {
        const queryInput = JSON.parse(decrypt(cursor)) as AWS.DynamoDB.DocumentClient.QueryInput
        const result = await this.fetchUsers(queryInput, "userId")
        await this.setCurrentUserFollowingStatus(currentUserId, result.users)
        return result
    }

    async searchQueryWithCursor(currentUserId: string, cursor: string): Promise<UserListResult> {
        const queryInput = JSON.parse(decrypt(cursor)) as AWS.DynamoDB.DocumentClient.QueryInput
        const result = await this.fetchUsers(queryInput, "userId")
        await this.setCurrentUserFollowingStatus(currentUserId, result.users)
        return result
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
        await this.setRankOnUsers(searchResult.users)
        return searchResult
    }

    async setRankOnUsers(users: User[]) {
        for (const user of users) {
            const rank = await this.redisCache.getLeaderboardRank(user.userId)
            if (rank > 0) {
                Object.assign(user, {rank: rank})
            }
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

        //Save social score for user so they show up in the social leaderboards
        const score = await this.redisCache.getAllTimeScore(targetUserId)
        await this.redisCache.saveSocialScore(currentUserId, targetUserId, score)
    }

    //TODO: this needs pagination
    async getFollowedUsers(currentUserId: string, userId: string): Promise<UserListResult> {
        //Run the query
        const queryInput = this.getFollowedUsersQuery(userId, 30)
        const result = await this.fetchUsers(queryInput, "followingUserId")
        await this.setCurrentUserFollowingStatus(currentUserId, result.users)
        return result
    }

    async getFollowers(currentUserId: string, userId: string): Promise<UserListResult> {
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
        const result = await this.fetchUsers(queryParams, "userId")
        await this.setCurrentUserFollowingStatus(currentUserId, result.users)
        return result
    }

    async createEvent(event: Event): Promise<Event> {
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

    async saveLatestEvent(input: Event) {
        await this.redisCache.setLatestEvent(input)
    }

    async getLastUpdatedTime(userId: string): Promise<number | undefined> {
        return await this.redisCache.getLastUpdatedTime(userId)
    }

    async updateLastUpdatedTime(userId: string) {
        return await this.redisCache.updateLastUpdatedTime(userId)
    }

    private async assignScoresToUsers(users: User[], userIdToScoreMap: Map<string, LeaderboardScoreRedis>, currentUserId: string) {
        users.forEach(user => {
            const scoreForUser = userIdToScoreMap.get(user.userId)
            Object.assign(user, {allTimeScore: scoreForUser?.score, rank: scoreForUser?.rank})
        })

        users.sort((a: User, b: User) => {
            return (a.rank ?? 0) - (b.rank ?? 0)
        })

        await this.setCurrentUserFollowingStatus(currentUserId, users)
    }

    private getFollowedUsersQuery(userId: string, limit: number, startKey: AWS.DynamoDB.Key | undefined = undefined): AWS.DynamoDB.DocumentClient.QueryInput {
        const queryParams: AWS.DynamoDB.DocumentClient.QueryInput = {
            TableName: mainTable,
            KeyConditionExpression: '#PK = :PK And begins_with(#SK, :SK)',
            ExpressionAttributeNames: {
                '#PK': "PK",
                '#SK': "SK"
            },
            ExpressionAttributeValues: {
                ':PK': `USER#${userId}`,
                ':SK': `FOLLOWING#`
            },
            ScanIndexForward: false,
            Limit: limit
        }
        if (startKey) {
            queryParams["ExclusiveStartKey"] = startKey
        }
        return queryParams
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