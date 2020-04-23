import { Repository } from "../../data/repository"
import { Event, EventType, User } from '../../data/model/Types';
import { ApolloError } from "apollo-server-lambda";
import { CreateGeofenceEventPayloadGql } from "../types/geofenceEvent";
import { SearchUsersPayloadGql, UpdateUserInfoPayloadGql, CurrentUserPayloadGql, FollowUserPayloadGql, GetUserPayloadGql, FollowingUsersPayloadGql, FollowedUsersPayloadGql } from '../types/userInterfaces';

export class MainResolver {
    private repository: Repository

    constructor(repository: Repository) {
        this.repository = repository
    }

    async getUser(userId: string): Promise<GetUserPayloadGql> {
        const user = await this.repository.getUser(userId)
        return {
            user: user
        }
    }

    async getFollowers(userId: string): Promise<FollowingUsersPayloadGql> {
        const users = await this.repository.getFollowers(userId)
        return {
            users: users
        }
    }

    async getFollowedUsers(userId: string): Promise<FollowedUsersPayloadGql> {
        const users = await this.repository.getFollowedUsers(userId)
        return {
            users: users
        }
    }

    async unfollowUser(currentUserId: string, userIdToUnfollow: string): Promise<FollowUserPayloadGql> {
        await this.repository.unfollowUser(currentUserId, userIdToUnfollow)
        return {
            userId: userIdToUnfollow
        }
    }

    async followUser(currentUserId: string, userIdToFollow: string): Promise<FollowUserPayloadGql> {
        await this.repository.followUser(currentUserId, userIdToFollow)
        return {
            userId: userIdToFollow
        }
    }

    async createEvent(userId: string, eventType: EventType): Promise<CreateGeofenceEventPayloadGql> {
        const input: Event = {
            eventType: eventType,
            timestamp: new Date().toISOString(),
            userId: userId
        }

        const previousEvent = await this.repository.getLatestEventForUser(userId)
        const event = await this.repository.createEvent(input)

        if (previousEvent && event?.eventType == "AWAY") {
            await this.updateAllTimeScore(userId, previousEvent)
        }
        return {
            geofenceEvent: event
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
                const result: User = Object.assign(user, {
                    isCurrentUserFollowing: followedUserIds.includes(user.userId)
                })
                return result
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
        if (!user) {
            throw new ApolloError("Current user could not be resolved")
        }

        const latestEvent = await this.repository.getLatestEventForUser(userId)
        const score24 = this.calculate24HourScore(events, latestEvent)

        let allTimeScore = 0
        if (latestEvent?.eventType == "HOME") {
            allTimeScore = await this.updateAllTimeScore(userId, latestEvent)
        } else {
            allTimeScore = await this.repository.getAllTimeScore(userId)
        }

        const result: User = Object.assign(user, {
            allTimeScore: allTimeScore,
            score: score24
        })

        return {
            user: result
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

    private calculate24HourScore(events: Event[], latestEvent?: Event): number {
        if (events.length == 0) {
            //No events in the last 24 hours, get latest event to calculate score
            if (latestEvent?.eventType === "HOME") {
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
        let timeAtHome = 0
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

    private getOneDayMillis(): number {
        return 24 * 60 * 60 * 1000
    }

    private getYesterdayMillis(): number {
        return Date.now() - this.getOneDayMillis()
    }

    private getYesterdayISOString(): string {
        return new Date(this.getYesterdayMillis()).toISOString()
    }
}