import { Repository } from "../../data/repository"
import { promisify } from 'util'
import { User, Event, EventType } from '../../data/model/Types';
import { ApolloError } from "apollo-server-lambda";
import { UpdateUserInfoPayloadGql, SearchUsersPayloadGql, CurrentUserPayloadGql, UserGql } from '../types/user';
import { CreateGeofenceEventPayloadGql } from "../types/geofenceEvent";

export class MainResolver {
    private repository: Repository

    constructor(repository: Repository) {
        this.repository = repository
    }

    async createEvent(userId: string, eventType: EventType): Promise<CreateGeofenceEventPayloadGql> {
        const input: Event = {
            eventType: eventType,
            timestamp: new Date().toISOString(),
            userId: userId
        }
        const event = await this.repository.createEvent(input)

        const latestEvent = await this.repository.getLatestEventForUser(userId)
        if (latestEvent?.eventType == "AWAY") {
            await this.updateAllTimeScore(userId, latestEvent)
        }

        return {
            geofenceEvent: {
                userId: event.userId,
                eventType: event.eventType,
                timestamp: event.timestamp
            }
        }
    }

    async searchUsers(currentUserId: string, searchQuery: string): Promise<SearchUsersPayloadGql> {
        const users = await this.repository.searchUsers(searchQuery)
        const userIds = users.map(user => {
            return user.userId
        })
        const followedUserIds = await this.repository.getWhichUsersAreFollowed(currentUserId, userIds)
        return {
            users: users.map(user => {
                const userGql: UserGql = {
                    id: user.userId,
                    username: user.username,
                    isCurrentUserFollowing: followedUserIds.includes(user.userId),
                    followingCount: user.followingCount,
                    followerCount: user.followerCount
                }
                return userGql
            })
        }
    }

    async updateUserInfo(userId: string, username: string): Promise<UpdateUserInfoPayloadGql> {
        await this.repository.updateUsername(userId, username)
        const result: UpdateUserInfoPayloadGql = {
            id: userId,
            username: username
        }
        return result
    }

    async getCurrentUser(userId: string): Promise<CurrentUserPayloadGql> {
        const startTime = this.getYesterdayISOString()
        const { user, events } = await this.repository.getUserAndEventsFromStartTime(userId, startTime)
        if (!user || !events) {
            throw new ApolloError("Current user could not be resolved")
        }

        //Calculate 24 hour score and add to redis
        const score = await this.calculate24HourScore(userId, events)
        this.repository.save24HourScore(userId, score)

        //Calculate all time score
        //Current time - last calc time
        //Set last calc time to current time

        const latestEvent = await this.repository.getLatestEventForUser(userId)
        if (latestEvent?.eventType == "HOME") {
            await this.updateAllTimeScore(userId, latestEvent)
        }

        //Return gql user info
        const userGql: UserGql = {
            id: user.userId,
            username: user.username,
            score: score
        }
        return {
            user: userGql
        }
    }

    private async updateAllTimeScore(userId: string, latestEvent: Event): Promise<number> {
        const currentTimeMillis = Date.now()
        const extra = currentTimeMillis - new Date(latestEvent.timestamp).getTime()
        const currentAllTimeScore = await this.repository.getAllTimeScore(userId)
        const finalAllTimeScore = currentAllTimeScore + extra
        await this.repository.saveAllTimeScore(userId, finalAllTimeScore)
        return finalAllTimeScore
    }

    private async calculate24HourScore(userId: string, events: Event[]): Promise<number> {
        if (events.length == 0) {
            //No events in the last 24 hours, get latest event to calculate score
            const event = await this.repository.getLatestEventForUser(userId)
            if (event?.eventType === "HOME") {
                return 100
            } else {
                return 0
            }
        }

        //Filter out duplicate atHome status events
        const filteredEvents = events.filter((event, index) => {
            const previousEvent = events[index - 1]
            return !previousEvent || previousEvent.eventType != event.eventType
        })

        const last24HoursEvents = filteredEvents.sort((a, b) => a.timestamp.localeCompare(b.timestamp))

        //Handle edge case where first event in last 24 hours is AWAY.
        //That means user was home for part of the beginning of 24 hr period.
        //We can assume a fake home event 24 hours ago if they were away
        if (last24HoursEvents && last24HoursEvents[0].eventType === "AWAY") {
            const fakeEvent: Event = {
                userId: "fake",
                timestamp: this.getYesterdayISOString(),
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
        const finalScore = Math.min(timeAtHome / this.getOneDayMillis() * 100, 100)
        return finalScore
    }

    private getOneDayMillis() {
        return 24 * 60 * 60 * 1000
    }

    private getYesterdayMillis() {
        return Date.now() - this.getOneDayMillis()
    }

    private getYesterdayISOString() {
        return new Date(this.getYesterdayMillis()).toISOString()
    }
}