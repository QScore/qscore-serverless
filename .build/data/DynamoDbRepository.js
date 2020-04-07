"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const AWS = require("aws-sdk");
const documentClient = new AWS.DynamoDB.DocumentClient();
const userTableName = process.env.USERS_TABLE_NAME;
const eventsTableName = process.env.GEOFENCE_EVENTS_TABLE_NAME;
class DynamoDbRepository {
    constructor(documentClient, userTableName, eventsTableName) {
        this.documentClient = documentClient;
        this.userTableName = userTableName;
        this.eventsTableName = eventsTableName;
    }
    async updateUserScore(userId, score) {
        const userParams = {
            TableName: userTableName,
            Key: { id: userId },
            UpdateExpression: 'set #score = :score',
            ExpressionAttributeNames: {
                '#score': 'score'
            },
            ExpressionAttributeValues: {
                ':score': score
            }
        };
        await documentClient.update(userParams).promise();
    }
    async getEventsFromStartTime(userId, startTimestamp) {
        const eventParams = {
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
        };
        const result = await documentClient.query(eventParams).promise();
        return result.Items;
    }
    async updateUsername(userId, username) {
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
        };
        await documentClient.update(params).promise();
    }
    async getCurrentuser(userId) {
        const params = {
            TableName: userTableName,
            Key: { id: userId }
        };
        const result = await documentClient.get(params).promise();
        if (!result.Item) {
            return undefined;
        }
        return {
            "id": result.Item.id,
            "username": result.Item.username,
            "score": result.Item.score
        };
    }
}
exports.DynamoDbRepository = DynamoDbRepository;
exports.default = new DynamoDbRepository(new AWS.DynamoDB.DocumentClient(), process.env.USERS_TABLE_NAME, process.env.GEOFENCE_EVENTS_TABLE_NAME);
//# sourceMappingURL=DynamoDbRepository.js.map