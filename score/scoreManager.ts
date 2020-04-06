import * as AWS  from "aws-sdk"
const userTableName: string = process.env.USERS_TABLE_NAME!
const eventsTableName = process.env.GEOFENCE_EVENTS_TABLE_NAME!
const documentClient = new AWS.DynamoDB.DocumentClient()
const oneDayMillis = (24 * 60 * 60 * 1000)
const yesterdayMillis = new Date().getTime() - oneDayMillis
const debug = false

interface Event {
    readonly timestamp: number
    readonly eventType: "HOME" | "AWAY"
}

export async function  updateScore(userId: string) {
    const eventsResult = await getAllEvents(userId)
    if (!eventsResult.Items) {
        console.log("Unable to get events")
        return 0
    }

    const events = eventsResult.Items as Event[]
    if (debug) console.log("Queried all events: " + JSON.stringify(events.length))

    //Handler case where there are no events for this user, this should never happen
    if (events.length == 0) {
        console.log("No events found for this user, automatic 0")
        await updateUserScore(userId, 0)
        return 0
    }

    //Filter out duplicate atHome status events
    const filteredEvents = events.filter((event, index) => {
        const previousEvent = events[index - 1]
        if (debug) console.log("Filtering previous event: " + (!previousEvent || previousEvent.eventType) + " current: " + event.eventType)
        return !previousEvent || previousEvent.eventType != event.eventType
    })

    if (debug) {
        console.log("Filtered event size: " + filteredEvents.length)
        filteredEvents.forEach((event) => {
            console.log(event.eventType + " " + event.timestamp)
        })
    }

    const last24HoursEvents = filteredEvents

    if (debug) {
        console.log("Last 24 hours events: " + last24HoursEvents.length)
        last24HoursEvents.forEach((event) => {
            console.log(event.eventType + " " + event.timestamp)
        })
    }

    //Handle error case where no events in last 24 hours.
    if (last24HoursEvents.length == 0) {
        console.log("No events in the last 24 hours")
        return
    }

    //Handle edge case where first event in last 24 hours is AWAY.
    //That means user was home for part of the beginning of 24 hr period.
    //We can assume a fake home event 24 hours ago if they were away
    if (last24HoursEvents && last24HoursEvents[0].eventType == "AWAY") {
        if (debug) console.log("Adding fake first event")
        const fakeEvent: Event = {
            timestamp: yesterdayMillis,
            eventType: "HOME"
        }
        last24HoursEvents.unshift(fakeEvent)
    }

    //Handle edge case where last event in last 24 hours is HOME.
    //That means user was home for the remaining part of 24 hr period.
    //We can assume a fake home event 24 hours ago if they were away
    if (last24HoursEvents && last24HoursEvents[last24HoursEvents.length - 1].eventType == "HOME") {
        if (debug) console.log("Adding fake last event")
        const fakeEvent: Event = {
            timestamp: new Date().getTime(),
            eventType: "AWAY"
        }
        last24HoursEvents.push(fakeEvent)
    }

    //Filter out events in the last 24 hours
    if (debug) {
        console.log("Last 24 hours events updated: " + last24HoursEvents.length)
        last24HoursEvents.forEach((event) => {
            console.log(event.eventType + " " + event.timestamp)
        })
    }

    //Find time at home
    var timeAtHome = 0
    last24HoursEvents.forEach((event, index) => {
        const previousEvent = last24HoursEvents[index - 1]
        if (previousEvent && event.eventType == "AWAY" && previousEvent.eventType == "HOME") {
            timeAtHome += event.timestamp - previousEvent.timestamp
            if (debug) console.log("Added to timeAtHome: " + timeAtHome + " 24 hours == " + oneDayMillis)
        }
    })

    //Create score:
    const finalScore = timeAtHome / oneDayMillis * 100
    if (debug) console.log(`Final score: ${finalScore}`)

    await updateUserScore(userId, finalScore)
    console.log(`Successfully updated score ${finalScore} for user ${userId}`)
    return finalScore
}

async function updateUserScore(userId: string, score: number) {
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

    return documentClient.update(userParams).promise()
}

async function getAllEvents(userId: string) {
    // Query and build score
    const eventParams: AWS.DynamoDB.DocumentClient.QueryInput = {
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
    }

    return documentClient.query(eventParams).promise()
}