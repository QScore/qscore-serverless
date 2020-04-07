"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const moment = require("moment");
const debug = false;
async function calculateScore(userId, repository) {
    const oneDayMillis = moment.duration(1, 'd').asMilliseconds();
    const yesterdayMillis = moment().subtract(1, 'day').unix();
    const events = await repository.getEventsFromStartTime(userId, yesterdayMillis);
    if (debug)
        console.log("Queried all events: " + JSON.stringify(events.length));
    if (events.length == 0) {
        console.log("No events found for this user, automatic 0");
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
        return -1;
    }
    if (last24HoursEvents && last24HoursEvents[0].eventType == EventType.AWAY) {
        if (debug)
            console.log("Adding fake first event");
        const fakeEvent = {
            timestamp: yesterdayMillis,
            eventType: EventType.HOME
        };
        last24HoursEvents.unshift(fakeEvent);
    }
    if (last24HoursEvents && last24HoursEvents[last24HoursEvents.length - 1].eventType == EventType.HOME) {
        if (debug)
            console.log("Adding fake last event");
        const fakeEvent = {
            timestamp: new Date().getTime(),
            eventType: EventType.AWAY
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
        if (previousEvent && event.eventType == EventType.AWAY && previousEvent.eventType == EventType.HOME) {
            timeAtHome += event.timestamp - previousEvent.timestamp;
            if (debug)
                console.log("Added to timeAtHome: " + timeAtHome + " 24 hours == " + oneDayMillis);
        }
    });
    const finalScore = timeAtHome / oneDayMillis * 100;
    if (debug)
        console.log(`Final score: ${finalScore}`);
    if (debug)
        console.log(`Successfully updated score ${finalScore} for user ${userId}`);
    return finalScore;
}
exports.calculateScore = calculateScore;
//# sourceMappingURL=scoreManager.js.map