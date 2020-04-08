import * as moment from 'moment'
import '../data/Repository'

const debug = false

export async function calculateScore(userId: string, repository: Repository): Promise<number> {
    const oneDayMillis = moment.duration(1,'d').asMilliseconds()
    const yesterdayMillis = moment().subtract(1, 'day').unix()
    const events = await repository.getEventsFromStartTime(userId, yesterdayMillis)

    if (debug) console.log("Queried all events: " + JSON.stringify(events.length))

    //Handler case where there are no events for this user, this should never happen
    if (events.length == 0) {
        console.log("No events found for this user, automatic 0")
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
        return -1
    }

    //Handle edge case where first event in last 24 hours is AWAY.
    //That means user was home for part of the beginning of 24 hr period.
    //We can assume a fake home event 24 hours ago if they were away
    if (last24HoursEvents && last24HoursEvents[0].eventType == EventType.AWAY) {
        if (debug) console.log("Adding fake first event")
        const fakeEvent: Event = {
            timestamp: yesterdayMillis,
            eventType: EventType.HOME
        }
        last24HoursEvents.unshift(fakeEvent)
    }

    //Handle edge case where last event in last 24 hours is HOME.
    //That means user was home for the remaining part of 24 hr period.
    //We can assume a fake home event 24 hours ago if they were away
    if (last24HoursEvents && last24HoursEvents[last24HoursEvents.length - 1].eventType == EventType.HOME) {
        if (debug) console.log("Adding fake last event")
        const fakeEvent: Event = {
            timestamp: new Date().getTime(),
            eventType: EventType.AWAY
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
        if (previousEvent && event.eventType == EventType.AWAY && previousEvent.eventType == EventType.HOME) {
            timeAtHome += event.timestamp - previousEvent.timestamp
            if (debug) console.log("Added to timeAtHome: " + timeAtHome + " 24 hours == " + oneDayMillis)
        }
    })

    //Create score:
    const finalScore = timeAtHome / oneDayMillis * 100
    if (debug) console.log(`Final score: ${finalScore}`)

    if (debug) console.log(`Successfully updated score ${finalScore} for user ${userId}`)
    return finalScore
}