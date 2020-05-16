import {Event, EventType, User} from './model/types';
import {ApolloError} from "apollo-server-lambda"
import {
    CheckUsernameExistsPayloadGql,
    CreateGeofenceEventPayloadGql,
    CreateUserPayloadGql,
    CurrentUserPayloadGql,
    FollowedUsersPayloadGql,
    FollowingUsersPayloadGql,
    FollowUserPayloadGql,
    GetUserPayloadGql,
    LeaderboardRangePayloadGql,
    SearchUsersPayloadGql,
    UpdateUserInfoPayloadGql
} from '../graphql/graphqlTypes';
import {MainRepository, UserInfoParams} from "./mainRepository";

export class MainResolver {
    constructor(private readonly repository: MainRepository) {
        this.repository = repository
    }

    async createUser(userId: string, username: any): Promise<CreateUserPayloadGql> {
        const user = await this.repository.createUser(userId, username)
        return {
            user: user
        }
    }

    async getLeaderboardRange(currentUserId: string, start: number, end: number): Promise<LeaderboardRangePayloadGql> {
        const users = await this.repository.getLeaderboardScoreRange(currentUserId, start, end)
        return {
            users: users
        }
    }

    async getUser(currentUserId: string, userId: string): Promise<GetUserPayloadGql> {
        const user = await this.repository.getUser(userId)
        if (!user) {
            throw new ApolloError("User could not be resolved for id: " + userId)
        }

        //Calculate all time score
        const latestEvent = await this.repository.getLatestEventForUser(userId)
        let {allTimeScore, rank} = await this.setupScoreForUser(latestEvent, userId)

        //Check if current user is following
        const isCurrentUserFollowing = await this.isCurrentUserFollowing(currentUserId, userId)

        const result: User = {
            userId: user.userId,
            username: user.username,
            avatar: user.avatar,
            score: user.score,
            followerCount: user.followerCount,
            followingCount: user.followingCount,
            isCurrentUserFollowing: isCurrentUserFollowing,
            allTimeScore: allTimeScore,
            rank: rank
        }
        return {
            user: result
        }
    }

    async getFollowers(currentUserId: string, userId: string): Promise<FollowingUsersPayloadGql> {
        return await this.repository.getFollowers(currentUserId, userId)
    }

    async getFollowersWithCursor(currentUserId: string, cursor: string): Promise<FollowedUsersPayloadGql> {
        return await this.repository.getFollowedUsersWithCursor(currentUserId, cursor)
    }

    async getFollowedUsers(currentUserId: string, userId: string): Promise<FollowedUsersPayloadGql> {
        return await this.repository.getFollowedUsers(currentUserId, userId)
    }

    async getFollowedUsersWithCursor(currentUserId: string, cursor: string): Promise<FollowedUsersPayloadGql> {
        return await this.repository.getFollowedUsersWithCursor(currentUserId, cursor)
    }

    async unfollowUser(currentUserId: string, userIdToUnfollow: string): Promise<FollowUserPayloadGql> {
        if (currentUserId === userIdToUnfollow) {
            throw new ApolloError("Cannot unfollow yourself", "400");
        }
        await this.repository.unfollowUser(currentUserId, userIdToUnfollow)
        return {
            userId: userIdToUnfollow
        }
    }

    async followUser(currentUserId: string, userIdToFollow: string): Promise<FollowUserPayloadGql> {
        if (currentUserId == userIdToFollow) {
            throw new ApolloError("Cannot follow yourself", "400");
        }
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

        //Early return if the event type is the same as the previous event
        const previousEvent = await this.repository.getLatestEventForUser(userId)
        if (previousEvent && previousEvent.eventType === input.eventType) {
            return {
                geofenceEvent: input
            }
        }

        //Update the all time score if previously home, now away
        const event = await this.repository.createEvent(input)
        if (previousEvent && previousEvent.eventType == "HOME" && event?.eventType == "AWAY") {
            await this.updateAllTimeScore(userId)
        }
        await this.repository.updateLastUpdatedTime(userId)

        return {
            geofenceEvent: event
        }
    }

    async searchUsersWithCursor(currentUserId: string, cursor: string): Promise<SearchUsersPayloadGql> {
        return await this.repository.searchQueryWithCursor(currentUserId, cursor)
    }

    async searchUsers(currentUserId: string, searchQuery: string, limit: number): Promise<SearchUsersPayloadGql> {
        const searchResult = await this.repository.searchUsers(searchQuery, currentUserId, limit)
        const searchUserIds = searchResult.users.map(user => {
            return user.userId
        })
        if (searchUserIds.length == 0) {
            return {
                users: [],
                nextCursor: undefined
            }
        }
        const followedUserIds = await this.repository.getWhichUsersAreFollowed(currentUserId, searchUserIds)
        return {
            users: searchResult.users.map(user => {
                const result: User = Object.assign(user, {
                    isCurrentUserFollowing: followedUserIds.includes(user.userId)
                })
                return result
            }),
            nextCursor: searchResult.nextCursor
        }
    }

    async updateUserInfo(userInfoParams: UserInfoParams): Promise<UpdateUserInfoPayloadGql> {
        await this.repository.updateUserInfo(userInfoParams)
        const result: UpdateUserInfoPayloadGql = {
            id: userInfoParams.userId,
            username: userInfoParams.userId,
            avatar: userInfoParams.avatar
        }
        return result
    }

    async getCurrentUser(userId: string): Promise<CurrentUserPayloadGql> {
        const startTime = this.getYesterdayISOString()
        const {user, events} = await this.repository.getUserAndEventsFromStartTime(userId, startTime)
        if (!user) {
            throw new ApolloError("Current user could not be resolved")
        }

        const latestEvent = await this.repository.getLatestEventForUser(userId)
        const score24 = this.calculate24HourScore(events, latestEvent)
        //Save 24 hour score
        await this.repository.save24HourScore(userId, score24)

        let {allTimeScore, rank} = await this.setupScoreForUser(latestEvent, userId)

        const result: User = Object.assign(user, {
            allTimeScore: allTimeScore,
            score: score24,
            rank: rank,
            geofenceStatus: latestEvent?.eventType
        })

        return {
            user: result
        }
    }

    async getSocialLeaderboardRange(currentUserId: string, start: number, end: number): Promise<LeaderboardRangePayloadGql> {
        const users = await this.repository.getSocialLeaderboard(currentUserId, start, end)
        return {
            users: users
        }
    }

    async checkUsernameExists(username: string): Promise<CheckUsernameExistsPayloadGql> {
        if (!username) {
            return {
                exists: false
            }
        }
        const exists = await this.repository.checkUsernameExists(username)
        return {
            exists: exists
        }
    }

    private async setupScoreForUser(latestEvent: Event | undefined, userId: string) {
        let allTimeScore = 0
        if (latestEvent?.eventType == "HOME") {
            allTimeScore = await this.updateAllTimeScore(userId)
        } else {
            allTimeScore = await this.repository.getAllTimeScore(userId)
        }
        await this.repository.updateLastUpdatedTime(userId)
        const rank = await this.repository.getAllTimeLeaderboardRank(userId)
        return {allTimeScore, rank};
    }

    private async isCurrentUserFollowing(currentUserId: string, userId: string) {
        const followedUserIds = await this.repository.getWhichUsersAreFollowed(currentUserId, [userId])
        return followedUserIds.includes(userId)
    }

    private async updateAllTimeScore(userId: string): Promise<number> {
        const currentTimeMillis = Date.now()
        const currentAllTimeScore = await this.repository.getAllTimeScore(userId) //This should include last updated time
        const lastUpdatedTime = await this.repository.getLastUpdatedTime(userId) ?? currentTimeMillis
        const extra = (currentTimeMillis - lastUpdatedTime) / 1000 / 10 //Every 10 seconds

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