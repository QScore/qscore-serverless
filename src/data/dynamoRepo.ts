import * as AWS from "aws-sdk"
import {EventDynamo, FollowDynamo, UserDynamo, UserListDynamo} from "./model/dynamoTypes";
import {decrypt, encrypt} from "../util/encryption/encryptor";
import {EventType} from "./model/Types";

const mainTable = process.env.MAIN_TABLE as string

export interface UserInfoParams {
    readonly userId: string
    readonly username?: string
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

export class DynamoRepo {
    constructor(private readonly documentClient: AWS.DynamoDB.DocumentClient) {

    }

    async getWhichUserIdsAreFollowed(currentUserId: string, userIdsToCheck: string[]): Promise<string[]> {
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

    async getFollowedUsersWithCursor(currentUserId: string, cursor: string): Promise<UserListDynamo> {
        const queryInput = JSON.parse(decrypt(cursor)) as AWS.DynamoDB.DocumentClient.QueryInput
        return await this.fetchUsers(queryInput, "followingUserId")
    }

    async getFollowersWithCursor(currentUserId: string, cursor: string): Promise<UserListDynamo> {
        const queryInput = JSON.parse(decrypt(cursor)) as AWS.DynamoDB.DocumentClient.QueryInput
        return await this.fetchUsers(queryInput, "userId")
    }

    async searchQueryWithCursor(currentUserId: string, cursor: string): Promise<UserListDynamo> {
        const queryInput = JSON.parse(decrypt(cursor)) as AWS.DynamoDB.DocumentClient.QueryInput
        return await this.fetchUsers(queryInput, "userId")
    }

    async searchUsers(searchQuery: string, currentUserId: string, limit: number): Promise<UserListDynamo> {
        const queryInput: AWS.DynamoDB.DocumentClient.QueryInput = {
            TableName: mainTable,
            IndexName: "GS1",
            KeyConditionExpression: '#GS1PK = :GS1PK And begins_with(#GS1SK, :GS1SK)',
            ExpressionAttributeNames: {
                '#GS1PK': "GS1PK",
                '#GS1SK': "GS1SK"
            },
            ExpressionAttributeValues: {
                ':GS1PK': 'SEARCH',
                ':GS1SK': searchQuery.toLowerCase(),
            },
            Limit: limit
        }
        const result = await this.documentClient.query(queryInput).promise()
        const users = result.Items as UserDynamo[]
        return {
            userDynamos: users,
            nextCursor: this.buildCursorFromQuery(queryInput, result)
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

    //TODO: Do limit correctly
    async getFollowedUsers(currentUserId: string, userId: string, limit = 30): Promise<UserListDynamo> {
        //Run the query
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
        return this.fetchUsers(queryParams, "followingUserId")
    }

    async getFollowers(currentUserId: string, userId: string): Promise<UserListDynamo> {
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

    async createEvent(userId: string, eventType: EventType, timestamp: string): Promise<EventDynamo> {
        //Set latest event in dynamodb
        const inputItem: EventDynamo = {
            PK: `USER#${userId}`,
            SK: `EVENT#${timestamp}`,
            itemType: `Event`,
            eventType: eventType,
            timestamp: timestamp,
            userId: userId
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
        return inputItem
    }

    async updateUserInfo(userInfoParams: UserInfoParams): Promise<void> {
        //Check for existing user:
        const {userId, avatar, username} = userInfoParams
        const transactItems: AWS.DynamoDB.DocumentClient.TransactWriteItemList = []
        const update: AWS.DynamoDB.DocumentClient.TransactWriteItem = {
            Update: {
                TableName: mainTable,
                Key: {
                    "PK": `USER#${userId}`,
                    "SK": `EVENT#9999`
                },
                UpdateExpression: ((): string => {
                    const setExpressions: string[] = []
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

    async createUser(userId: string, username: string, avatar?: string): Promise<void> {
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
        const user: UserDynamo = userResult as UserDynamo
        const events = queryResult.Items as EventDynamo[]
        return {
            user: user,
            events: events
        }
    }

    async getLatestEventForUser(userId: string): Promise<EventDynamo | undefined> {
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
        const latestEvent = result.Items?.pop() as EventDynamo
        if (!latestEvent) {
            return undefined
        }
        return latestEvent
    }

    async getUser(currentUserId: string, userId: string): Promise<UserDynamo | undefined> {
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
        return result.Item as UserDynamo
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
        await this.documentClient.update(params).promise()
    }

    async checkUsernameExists(username: string): Promise<boolean> {
        const queryInput: AWS.DynamoDB.DocumentClient.QueryInput = {
            TableName: mainTable,
            IndexName: "GS1",
            KeyConditionExpression: '#GS1PK = :GS1PK And #GS1SK = :GS1SK',
            ExpressionAttributeNames: {
                '#GS1PK': "GS1PK",
                '#GS1SK': "GS1SK"
            },
            ExpressionAttributeValues: {
                ':GS1PK': 'SEARCH',
                ':GS1SK': username.toLowerCase(),
            }
        }

        const queryOutput = await this.documentClient.query(queryInput).promise()
        if (!queryOutput.Items) {
            return false
        }
        return queryOutput.Items.length > 0
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

    private async queryGs1BeginsWith(gs1Pk: string, gs1Sk: string, limit: number): Promise<QueryInputAndOutput> {
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

    private async fetchUsers(queryInput: AWS.DynamoDB.DocumentClient.QueryInput, userIdProperty: string): Promise<UserListDynamo> {
        const queryResult = await this.documentClient.query(queryInput).promise()
        if (!queryResult.Items || queryResult.Items.length == 0) {
            return {
                userDynamos: [],
                nextCursor: undefined
            }
        }

        //Batch get users
        const userIds = queryResult.Items.map(item => {
            return item[userIdProperty]
        })

        const users = await this.batchGetUsers(userIds)

        return {
            userDynamos: users,
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

    async batchGetUsers(userIds: string[]): Promise<UserDynamo[]> {
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
        return results.Responses?.[mainTable] as UserDynamo[] ?? []
    }
}

export interface GetUserAndEventsResult {
    readonly user?: UserDynamo
    readonly events: EventDynamo[]
}