import { EventType, Event } from '../data/model/Event'
import { Repository } from '../data/Repository'

const debug = false

export async function calculateScore(userId: string, repository: Repository): Promise<number> {
    const oneDayMillis = 24*60*60*1000
    const yesterdayMillis = Date.now() - oneDayMillis

    let start = Date.now()
    const events = await repository.getEventsFromStartTime(userId, yesterdayMillis)
    let elapsed = Date.now() - start
    console.log(">>Fetching events took: " + elapsed)

    //Handler case where there are no events for this user, this should never happen
    if (events.length == 0) {
        return 0
    }

    //Filter out duplicate atHome status events
    const filteredEvents = events.filter((event, index) => {
        const previousEvent = events[index - 1]
        return !previousEvent || previousEvent.eventType != event.eventType
    })

    const last24HoursEvents = filteredEvents

    //Handle error case where no events in last 24 hours.
    //TODO: This is actually not an error
    if (last24HoursEvents.length == 0) {
        return -1
    }

    //Handle edge case where first event in last 24 hours is AWAY.
    //That means user was home for part of the beginning of 24 hr period.
    //We can assume a fake home event 24 hours ago if they were away
    if (last24HoursEvents && last24HoursEvents[0].eventType == EventType.AWAY) {
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
        const fakeEvent: Event = {
            timestamp: new Date().getTime(),
            eventType: EventType.AWAY
        }
        last24HoursEvents.push(fakeEvent)
    }

    //Find time at home
    var timeAtHome = 0
    last24HoursEvents.forEach((event, index) => {
        const previousEvent = last24HoursEvents[index - 1]
        if (previousEvent && event.eventType == EventType.AWAY && previousEvent.eventType == EventType.HOME) {
            timeAtHome += event.timestamp - previousEvent.timestamp
            // if (debug) console.log("Added to timeAtHome: " + timeAtHome + " 24 hours == " + oneDayMillis)
        }
    })

    //Create score:
    const finalScore = Math.min(timeAtHome / oneDayMillis * 100, 100)
    return finalScore
}