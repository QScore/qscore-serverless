import { Event } from '../data/model/Types'

export function calculateScore(events: Event[]): number {
    const oneDayMillis = 24 * 60 * 60 * 1000
    const yesterdayMillis = Date.now() - oneDayMillis

    //Filter out duplicate atHome status events
    const filteredEvents = events.filter((event, index) => {
        const previousEvent = events[index - 1]
        return !previousEvent || previousEvent.eventType != event.eventType
    })

    const last24HoursEvents = filteredEvents

    //Handle edge case where first event in last 24 hours is AWAY.
    //That means user was home for part of the beginning of 24 hr period.
    //We can assume a fake home event 24 hours ago if they were away
    if (last24HoursEvents && last24HoursEvents[0].eventType === "AWAY") {
        const fakeEvent: Event = {
            userId: "fake",
            timestamp: new Date(yesterdayMillis).toISOString(),
            eventType: "HOME"
        }
        last24HoursEvents.unshift(fakeEvent)
    }

    //Handle edge case where last event in last 24 hours is HOME.
    //That means user was home for the remaining part of 24 hr period.
    //We can assume a fake home event 24 hours ago if they were away
    if (last24HoursEvents && last24HoursEvents[last24HoursEvents.length - 1].eventType === "HOME") {
        const fakeEvent: Event = {
            userId: "fake",
            timestamp: new Date().toISOString(),
            eventType: "AWAY"
        }
        last24HoursEvents.push(fakeEvent)
    }

    //Find time at home
    var timeAtHome = 0
    last24HoursEvents.forEach((event, index) => {
        const previousEvent = last24HoursEvents[index - 1]
        if (previousEvent && event.eventType == "AWAY" && previousEvent.eventType == "HOME") {
            timeAtHome += new Date(event.timestamp).getTime() - new Date(previousEvent.timestamp).getTime()
        }
    })

    //Create score:
    const finalScore = Math.min(timeAtHome / oneDayMillis * 100, 100)
    return finalScore
}

//Find last known event for user
export function calculateScoreIfNoEventsIn24Hours(event: Event): number {
    if (event.eventType === "HOME") {
        return 100
    } else {
        return 0
    }
}