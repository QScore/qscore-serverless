import * as AWS from "aws-sdk"
const documentClient = new AWS.DynamoDB.DocumentClient()
const userTableName: string = process.env.USERS_TABLE_NAME!
const eventsTableName = process.env.GEOFENCE_EVENTS_TABLE_NAME!

export class DynamoDbRepository implements Repository {
    documentClient: AWS.DynamoDB.DocumentClient
    userTableName: string
    eventsTableName: string

    constructor(documentClient: AWS.DynamoDB.DocumentClient, userTableName: string, eventsTableName: string) {
        this.documentClient = documentClient
        this.userTableName = userTableName
        this.eventsTableName = eventsTableName
    }

    async updateUserScore(userId: string, score: number) {
        const userParams: AWS.DynamoDB.DocumentClient.UpdateItemInput = {
            TableName: userTableName,
            Key: { id: userId },
            UpdateExpression: 'set #score = :score',
            ExpressionAttributeNames: {
                '#score': 'score'
            },
            ExpressionAttributeValues: {
                ':score': score
            }
        }
        await documentClient.update(userParams).promise()
    }

    async getEventsFrom(userId: string, startTimestamp: number): Promise<Event[]> {
        const eventParams: AWS.DynamoDB.DocumentClient.QueryInput = {
            TableName: eventsTableName,
            IndexName: "time-index",
            KeyConditionExpression: '#userId = :userId AND #timestamp >= :startTimestamp',
            ExpressionAttributeNames: {
                '#userId': "userId",
                '#timestamp': "timestamp"
            },
            ExpressionAttributeValues: {
                ':userId': userId,
                ':startTimestamp': startTimestamp
            }
        }

        const result = await documentClient.query(eventParams).promise()
        return result.Items as Event[]
    }

    async updateUsername(userId: string, username: string) {
        const params = {
            TableName: userTableName,
            Key: { id: userId },
            UpdateExpression: 'SET #username = :username',
            ExpressionAttributeNames: {
                '#username': 'username'
            },
            ExpressionAttributeValues: {
                ':username': username
            }
        }
        await documentClient.update(params).promise()
    }

    async getCurrentuser(userId: string): Promise<User | undefined> {
        const params: AWS.DynamoDB.DocumentClient.GetItemInput = {
            TableName: userTableName,
            Key: { id: userId }
        }
        const result = await documentClient.get(params).promise()
        if (!result.Item) {
            return undefined
        }
        return {
            "id": result.Item.id,
            "username": result.Item.username,
            "score": result.Item.score
        }
    }
}

export default new DynamoDbRepository(
    new AWS.DynamoDB.DocumentClient(),
    process.env.USERS_TABLE_NAME!,
    process.env.GEOFENCE_EVENTS_TABLE_NAME!
)