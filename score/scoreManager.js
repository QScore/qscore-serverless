const AWS = require("aws-sdk")
const userTableName = process.env.USERS_TABLE_NAME
const eventsTableName = process.env.GEOFENCE_EVENTS_TABLE_NAME
const documentClient = new AWS.DynamoDB.DocumentClient()
const oneDayMillis = (24 * 60 * 60 * 1000)
const now = new Date().getTime()
const yesterdayMillis = now - oneDayMillis
const debug = false

export async function updateScore(userId) {
    const eventsResult = await getAllEvents(userId)
    const events = eventsResult.Items.map(event => {
        let output = {
            "timestamp": event.timestamp,
            "atHome": event.eventType
        }
        return output
    })
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
        if (debug) console.log("Filtering previous event: " + (!previousEvent || previousEvent.atHome) + " current: " + event.atHome)
        return !previousEvent || previousEvent.atHome != event.atHome
    })

    if (debug) {
        console.log("Filtered event size: " + filteredEvents.length)
        filteredEvents.forEach((event) => {
            console.log(event.atHome + " " + event.timestamp)
        })
    }

    //If there's only one event all time, automatic 100% score
    if (filteredEvents.length == 1) {
        console.log("Only 1 event, automatic 100%")
        await updateUserScore(userId, 100)
        return 100
    }

    const last24HoursEvents = filteredEvents

    if (debug) {
        console.log("Last 24 hours events: " + last24HoursEvents.length)
        last24HoursEvents.forEach((event) => {
            console.log(event.atHome + " " + event.timestamp)
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
    if (last24HoursEvents && last24HoursEvents[0].atHome == "AWAY") {
        if (debug) console.log("Adding fake first event")
        const fakeEvent = {
            "timestamp": yesterdayMillis,
            "atHome": "HOME"
        }
        last24HoursEvents.unshift(fakeEvent)
    }

    //Handle edge case where last event in last 24 hours is HOME.
    //That means user was home for the remaining part of 24 hr period.
    //We can assume a fake home event 24 hours ago if they were away
    if (last24HoursEvents && last24HoursEvents[last24HoursEvents.length - 1].atHome == "HOME") {
        if (debug) console.log("Adding fake last event")
        const fakeEvent = {
            "timestamp": now,
            "atHome": "AWAY"
        }
        last24HoursEvents.push(fakeEvent)
    }

    //Filter out events in the last 24 hours
    if (debug) {
        console.log("Last 24 hours events updated: " + last24HoursEvents.length)
        last24HoursEvents.forEach((event) => {
            console.log(event.atHome + " " + event.timestamp)
        })
    }

    //Find time at home
    var timeAtHome = 0
    last24HoursEvents.forEach((event, index) => {
        const previousEvent = last24HoursEvents[index - 1]
        if (previousEvent && event.atHome == "AWAY" && previousEvent.atHome == "HOME") {
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

async function updateUserScore(userId, score) {
    //Update user table
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
    }

    return documentClient.update(userParams).promise()
}

async function getAllEvents(userId) {
    // Query and build score
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
    }

    return documentClient.query(eventParams).promise()
}