import * as AWS from "aws-sdk"
import { Repository } from "./Repository";
import { User, Event, EventDynamo, UserDynamo, FollowerDynamo, FollowingDynamo, Following, Follower } from './model/Types';

const userTableV2 = process.env.USERS_TABLE_V2

export class DynamoDbRepository implements Repository {
    private documentClient: AWS.DynamoDB.DocumentClient

    constructor(documentClient: AWS.DynamoDB.DocumentClient = new AWS.DynamoDB.DocumentClient()) {
        this.documentClient = documentClient
    }

    async getWhichUsersAreFollowed(currentUserId: string, userIdsToCheck: string[]): Promise<string[]> {
        //Batch get users
        const keys = userIdsToCheck.map(userId => {
            return {
                PK: `USER#${userId}`,
                SK: `FOLLOWER#${currentUserId}`
            }
        })

        const batchGetParams: AWS.DynamoDB.DocumentClient.BatchGetItemInput = {
            RequestItems: {
                [userTableV2]: {
                    Keys: keys
                }
            }
        }
        const results = await this.documentClient.batchGet(batchGetParams).promise()
        return results.Responses[userTableV2].map((user: FollowerDynamo) => {
            return user.userId
        })
    }

    async searchUsers(searchQuery: string): Promise<User[]> {
        const eventParams: AWS.DynamoDB.DocumentClient.QueryInput = {
            TableName: userTableV2,
            IndexName: 'GS1',
            KeyConditionExpression: '#GS1PK = :GS1PK And begins_with(#GS1SK, :GS1SK)',
            ExpressionAttributeNames: {
                '#GS1PK': "GS1PK",
                '#GS1SK': "GS1SK"
            },
            ExpressionAttributeValues: {
                ':GS1PK': `SEARCH#USER`,
                ':GS1SK': searchQuery.toLowerCase(),
            }
        }
        const queryResult = await this.documentClient.query(eventParams).promise()
        const users = queryResult.Items.map(item => {
            const user: User = {
                userId: item.userId,
                username: item.username,
                followerCount: item.followerCount,
                followingCount: item.followingCount
            }
            return user
        })
        return users
    }

    async unfollowUser(currentUserId: string, targetUserId: string) {
        const params: AWS.DynamoDB.DocumentClient.TransactWriteItemsInput = {
            TransactItems: [
                {
                    Delete: {
                        TableName: userTableV2,
                        Key: {
                            PK: `USER#${currentUserId}`,
                            SK: `FOLLOWING#${targetUserId}`,
                        }
                    }
                },
                {
                    Delete: {
                        TableName: userTableV2,
                        Key: {
                            PK: `USER#${targetUserId}`,
                            SK: `FOLLOWER#${currentUserId}`
                        }
                    }
                },
                {
                    Update: {
                        TableName: userTableV2,
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
                        TableName: userTableV2,
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
        const followingItem: FollowingDynamo = {
            PK: `USER#${currentUserId}`,
            SK: `FOLLOWING#${targetUserId}`,
            itemType: `Following`,
            followingUserId: targetUserId,
            userId: currentUserId
        }

        const followerItem: FollowerDynamo = {
            PK: `USER#${targetUserId}`,
            SK: `FOLLOWER#${currentUserId}`,
            itemType: `Follower`,
            followerUserId: currentUserId,
            userId: targetUserId
        }

        const params: AWS.DynamoDB.DocumentClient.TransactWriteItemsInput = {
            TransactItems: [
                {
                    Put: {
                        TableName: userTableV2,
                        Item: followingItem
                    }
                },
                {
                    Put: {
                        TableName: userTableV2,
                        Item: followerItem
                    }
                },
                {
                    Update: {
                        TableName: userTableV2,
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
                        TableName: userTableV2,
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
            TableName: userTableV2,
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
        const users: Following[] = queryResult.Items.map(item => {
            return {
                userId: item.userId,
                followingUserId: item.followingUserId
            }
        })
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
                [userTableV2]: {
                    Keys: keys
                }
            }
        }
        const results = await this.documentClient.batchGet(batchGetParams).promise()
        return results.Responses[userTableV2].map((user: UserDynamo) => {
            return {
                userId: user.userId,
                username: user.username,
                followerCount: user.followerCount,
                followingCount: user.followingCount
            }
        })
    }

    async getFollowers(userId: string): Promise<User[]> {
        //Run the query
        const queryParams: AWS.DynamoDB.DocumentClient.QueryInput = {
            TableName: userTableV2,
            KeyConditionExpression: '#PK = :PK And begins_with(#SK, :SK)',
            ExpressionAttributeNames: {
                '#PK': "PK",
                '#SK': "SK"
            },
            ExpressionAttributeValues: {
                ':PK': `USER#${userId}`,
                ':SK': `FOLLOWER#`
            },
            ScanIndexForward: false
        }
        const queryResult = await this.documentClient.query(queryParams).promise()
        const users: Follower[] = queryResult.Items.map(item => {
            return {
                followerUserId: item.followerUserId,
                userId: item.userId
            }
        })

        if (users.length == 0) {
            return []
        }

        //Batch get users
        const keys = users.map(user => {
            return {
                PK: `USER#${user.followerUserId}`,
                SK: `EVENT#9999`
            }
        })

        const batchGetParams: AWS.DynamoDB.DocumentClient.BatchGetItemInput = {
            RequestItems: {
                [userTableV2]: {
                    Keys: keys
                }
            }
        }
        const results = await this.documentClient.batchGet(batchGetParams).promise()
        return results.Responses[userTableV2].map((user: UserDynamo) => {
            return {
                userId: user.userId,
                username: user.username,
                followerCount: user.followerCount,
                followingCount: user.followingCount
            }
        })
    }

    async createEvent(event: Event): Promise<Event> {
        //Get most recent event and see if it is alternating event type, otherwise ignore.
        const latestEvent = await this.getLatestEventForUser(event.userId)
        if (latestEvent && latestEvent.eventType === event.eventType) {
            return latestEvent
        }

        const inputItem: EventDynamo = {
            PK: `USER#${event.userId}`,
            SK: `EVENT#${event.timestamp}`,
            itemType: `Event`,
            eventType: event.eventType,
            timestamp: event.timestamp,
            userId: event.userId
        }

        const params: AWS.DynamoDB.DocumentClient.PutItemInput = {
            TableName: userTableV2,
            Item: inputItem,
            ConditionExpression: "attribute_not_exists(#PK)",
            ExpressionAttributeNames: {
                "#PK": "PK"
            }
        }
        await this.documentClient.put(params).promise()
        return event
    }

    async updateUser(user: User): Promise<void> {
        const params: AWS.DynamoDB.DocumentClient.UpdateItemInput = {
            TableName: userTableV2,
            Key: {
                "PK": `USER#${user.userId}`,
                "SK": `EVENT#9999`
            },
            UpdateExpression: "set GS1PK = :GS1PK, " +
                "GS1SK = :GS1SK, " +
                "itemType = :itemType, " +
                "userId = :userId, " +
                "username = :username",
            ExpressionAttributeValues: {
                ":GS1PK": `SEARCH#USER`,
                ":GS1SK": user.username.toLowerCase(),
                ":itemType": `User`,
                ":userId": user.userId,
                ":username": user.username
            }
        }
        await this.documentClient.update(params).promise()
    }

    async createUser(user: User) {
        const inputItem: UserDynamo = {
            PK: `USER#${user.userId}`,
            SK: `EVENT#9999`,
            GS1PK: `SEARCH#USER`,
            GS1SK: user.username.toLowerCase(),
            itemType: `User`,
            userId: user.userId,
            username: user.username
        }

        const params: AWS.DynamoDB.DocumentClient.PutItemInput = {
            TableName: userTableV2,
            Item: inputItem,
            ConditionExpression: "attribute_not_exists(#PK)",
            ExpressionAttributeNames: {
                "#PK": "PK"
            }
        }
        return await this.documentClient.put(params).promise()
    }

    async getUserAndEventsFromStartTime(userId: string, startTimestamp: string): Promise<GetUserAndEventsResult> {
        //Run the query
        const eventParams: AWS.DynamoDB.DocumentClient.QueryInput = {
            TableName: userTableV2,
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
            ScanIndexForward: false
        }
        const queryResult = await this.documentClient.query(eventParams).promise()

        //Handle empty case
        if (queryResult.Items.length == 0) {
            return {
                user: undefined,
                events: []
            }
        }

        //Return results
        const userResult = queryResult.Items.shift()
        const user: User = {
            userId: userResult.userId,
            username: userResult.username,
            followerCount: userResult.followerCount,
            followingCount: userResult.followingCount
        }
        const events = queryResult.Items as Event[]
        return {
            user: user,
            events: events
        }
    }

    async getLatestEventForUser(userId: string): Promise<Event | undefined> {
        const params: AWS.DynamoDB.DocumentClient.QueryInput = {
            TableName: userTableV2,
            KeyConditionExpression: '#PK = :PK AND #SK < :SK',
            ExpressionAttributeNames: {
                '#PK': "PK",
                '#SK': "SK"
            },
            ExpressionAttributeValues: {
                ':PK': `USER#${userId}`,
                ':SK': 'EVENT#9999'
            },
            Limit: 1,
            ScanIndexForward: false
        }

        const result = await this.documentClient.query(params).promise()
        if (!result.Items || result.Items.length == 0) {
            return undefined
        }
        const item = result.Items[0]
        return <Event>{
            eventType: item.eventType,
            timestamp: item.timestamp,
            userId: item.userId
        }
    }

    async getUser(userId: string): Promise<User | undefined> {
        const params: AWS.DynamoDB.DocumentClient.GetItemInput = {
            TableName: userTableV2,
            Key: {
                PK: `USER#${userId}`,
                SK: 'EVENT#9999'
            }
        }
        const result = await this.documentClient.get(params).promise()
        if (!result.Item) {
            return undefined
        }
        return <User>{
            userId: result.Item.userId,
            username: result.Item.username,
            followerCount: result.Item.followerCount,
            followingCount: result.Item.followingCount
        }
    }
}



export interface GetUserAndEventsResult {
    readonly user?: User,
    readonly events: Event[]
}

export const dynamoDbRepository = new DynamoDbRepository()