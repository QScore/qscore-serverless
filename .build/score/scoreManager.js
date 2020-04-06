"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const AWS = require("aws-sdk");
const userTableName = process.env.USERS_TABLE_NAME;
const eventsTableName = process.env.GEOFENCE_EVENTS_TABLE_NAME;
const documentClient = new AWS.DynamoDB.DocumentClient();
const oneDayMillis = (24 * 60 * 60 * 1000);
const yesterdayMillis = new Date().getTime() - oneDayMillis;
const debug = false;
async function updateScore(userId) {
    const eventsResult = await getAllEvents(userId);
    if (!eventsResult.Items) {
        console.log("Unable to get events");
        return 0;
    }
    const events = eventsResult.Items;
    if (debug)
        console.log("Queried all events: " + JSON.stringify(events.length));
    if (events.length == 0) {
        console.log("No events found for this user, automatic 0");
        await updateUserScore(userId, 0);
        return 0;
    }
    const filteredEvents = events.filter((event, index) => {
        const previousEvent = events[index - 1];
        if (debug)
            console.log("Filtering previous event: " + (!previousEvent || previousEvent.eventType) + " current: " + event.eventType);
        return !previousEvent || previousEvent.eventType != event.eventType;
    });
    if (debug) {
        console.log("Filtered event size: " + filteredEvents.length);
        filteredEvents.forEach((event) => {
            console.log(event.eventType + " " + event.timestamp);
        });
    }
    const last24HoursEvents = filteredEvents;
    if (debug) {
        console.log("Last 24 hours events: " + last24HoursEvents.length);
        last24HoursEvents.forEach((event) => {
            console.log(event.eventType + " " + event.timestamp);
        });
    }
    if (last24HoursEvents.length == 0) {
        console.log("No events in the last 24 hours");
        return;
    }
    if (last24HoursEvents && last24HoursEvents[0].eventType == "AWAY") {
        if (debug)
            console.log("Adding fake first event");
        const fakeEvent = {
            timestamp: yesterdayMillis,
            eventType: "HOME"
        };
        last24HoursEvents.unshift(fakeEvent);
    }
    if (last24HoursEvents && last24HoursEvents[last24HoursEvents.length - 1].eventType == "HOME") {
        if (debug)
            console.log("Adding fake last event");
        const fakeEvent = {
            timestamp: new Date().getTime(),
            eventType: "AWAY"
        };
        last24HoursEvents.push(fakeEvent);
    }
    if (debug) {
        console.log("Last 24 hours events updated: " + last24HoursEvents.length);
        last24HoursEvents.forEach((event) => {
            console.log(event.eventType + " " + event.timestamp);
        });
    }
    var timeAtHome = 0;
    last24HoursEvents.forEach((event, index) => {
        const previousEvent = last24HoursEvents[index - 1];
        if (previousEvent && event.eventType == "AWAY" && previousEvent.eventType == "HOME") {
            timeAtHome += event.timestamp - previousEvent.timestamp;
            if (debug)
                console.log("Added to timeAtHome: " + timeAtHome + " 24 hours == " + oneDayMillis);
        }
    });
    const finalScore = timeAtHome / oneDayMillis * 100;
    if (debug)
        console.log(`Final score: ${finalScore}`);
    await updateUserScore(userId, finalScore);
    console.log(`Successfully updated score ${finalScore} for user ${userId}`);
    return finalScore;
}
exports.updateScore = updateScore;
async function updateUserScore(userId, score) {
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
    return documentClient.update(userParams).promise();
}
async function getAllEvents(userId) {
    const eventParams = {
        TableName: eventsTableName,
        IndexName: "time-index",
        KeyConditionExpression: '#userId = :userId AND #timestamp >= :yesterdayMillis',
        ExpressionAttributeNames: {
            '#userId': "userId",
            '#timestamp': "timestamp"
        },
        ExpressionAttributeValues: {
            ':userId': userId,
            ':yesterdayMillis': yesterdayMillis
        }
    };
    return documentClient.query(eventParams).promise();
}
//# sourceMappingURL=scoreManager.js.map