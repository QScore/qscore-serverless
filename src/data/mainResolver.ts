import {Event, EventType, User} from './model/types';
import {ApolloError} from "apollo-server-lambda"
import {
    CheckUsernameExistsPayloadGql,
    CreateGeofenceEventPayloadGql,
    CreateUserPayloadGql,
    CurrentUserPayloadGql,
    FollowUserPayloadGql,
    GetUserPayloadGql,
    LeaderboardRangePayloadGql,
    SearchUsersPayloadGql,
    UpdateUserInfoPayloadGql,
    UsersPayloadGql
} from '../graphql/graphqlTypes';
import {filter, map, mergeRight, prop, sortBy} from "ramda";
import {LeaderboardScoreRedis, RedisCache} from "./redisCache";
import {UserDynamo, UserListDynamo} from "./model/dynamoTypes";
import {DynamoRepo, UserInfoParams} from "./dynamoRepo";

export class MainResolver {
    constructor(private readonly dynamo: DynamoRepo, private readonly redis: RedisCache) {
    }

    async createUser(userId: string, username: any): Promise<CreateUserPayloadGql> {
        await this.dynamo.createUser(userId, username)
        return {
            user: {
                userId: userId,
                username: username,
                allTimeScore: 0,
                followerCount: 0,
                followingCount: 0,
                avatar: undefined
            }
        }
    }

    async getLeaderboardRange(currentUserId: string, start: number, end: number): Promise<LeaderboardRangePayloadGql> {
        const users = await this.getLeaderboardScoreRange(currentUserId, start, end)
        return {
            users: users
        }
    }

    async getUser(currentUserId: string, userId: string): Promise<GetUserPayloadGql> {
        const userDynamo = await this.dynamo.getUser(currentUserId, userId)
        if (!userDynamo) {
            throw new ApolloError("User could not be resolved for id: " + userId)
        }
        const user = this.convertUserDynamoToUser(userDynamo)
        const updatedUser = await this.updateSingleUser(currentUserId, user)
        return {
            user: updatedUser
        }
    }

    async getFollowers(currentUserId: string, userId: string): Promise<UsersPayloadGql> {
        const userListDynamo = await this.dynamo.getFollowers(currentUserId, userId)
        return this.updateUserList(currentUserId, userListDynamo)
    }

    async getFollowersWithCursor(currentUserId: string, cursor: string): Promise<UsersPayloadGql> {
        const userListDynamo = await this.dynamo.getFollowedUsersWithCursor(currentUserId, cursor)
        return this.updateUserList(currentUserId, userListDynamo)
    }

    async getFollowedUsers(currentUserId: string, userId: string): Promise<UsersPayloadGql> {
        const userListDynamo = await this.dynamo.getFollowedUsers(currentUserId, userId)
        return this.updateUserList(currentUserId, userListDynamo)
    }

    async getFollowedUsersWithCursor(currentUserId: string, cursor: string): Promise<UsersPayloadGql> {
        const userListDynamo = await this.dynamo.getFollowedUsersWithCursor(currentUserId, cursor)
        return this.updateUserList(currentUserId, userListDynamo)
    }

    async unfollowUser(currentUserId: string, userIdToUnfollow: string): Promise<FollowUserPayloadGql> {
        if (currentUserId === userIdToUnfollow) {
            throw new ApolloError("Cannot unfollow yourself", "400");
        }
        await this.dynamo.unfollowUser(currentUserId, userIdToUnfollow)
        return {
            userId: userIdToUnfollow
        }
    }

    async followUser(currentUserId: string, userIdToFollow: string): Promise<FollowUserPayloadGql> {
        if (currentUserId == userIdToFollow) {
            throw new ApolloError("Cannot follow yourself", "400");
        }
        await this.dynamo.followUser(currentUserId, userIdToFollow)
        //Save social score for user so they show up in the social leaderboards
        const score = await this.redis.getAllTimeScore(userIdToFollow)
        await this.redis.saveSocialScore(currentUserId, userIdToFollow, score)
        return {
            userId: userIdToFollow
        }
    }

    async createEvent(userId: string, eventType: EventType): Promise<CreateGeofenceEventPayloadGql> {
        const input: Event = {
            userId: userId,
            eventType: eventType,
            timestamp: new Date().toISOString()
        }

        //Early return if the event type is the same as the previous event
        const previousEvent = await this.dynamo.getLatestEventForUser(userId)
        if (previousEvent && previousEvent.eventType === eventType) {
            return {
                geofenceEvent: input
            }
        }

        const event = await this.dynamo.createEvent(input.userId, input.eventType, input.timestamp)
        if (previousEvent && previousEvent.eventType == "HOME") {
            await this.updateAllTimeScore(userId)
        } else {
            await this.redis.saveLastUpdatedTime(userId, Date.now())
        }
        return {
            geofenceEvent: event
        }
    }

    async searchUsersWithCursor(currentUserId: string, cursor: string): Promise<SearchUsersPayloadGql> {
        const userListDynamo = await this.dynamo.searchQueryWithCursor(currentUserId, cursor)
        return this.updateUserList(currentUserId, userListDynamo)
    }

    async searchUsers(currentUserId: string, searchQuery: string, limit: number): Promise<SearchUsersPayloadGql> {
        const searchResult = await this.dynamo.searchUsers(searchQuery, currentUserId, limit)
        const searchUserIds = searchResult.userDynamos.map(user => {
            return user.userId
        })
        if (searchUserIds.length == 0) {
            return {
                users: [],
                nextCursor: undefined
            }
        }
        const users = this.convertUserDynamosToUsers(searchResult.userDynamos)
        const followedUserIds = await this.dynamo.getWhichUserIdsAreFollowed(currentUserId, searchUserIds)
        const updateUser = async (user: User): Promise<User> => {
            return mergeRight(user, {
                isCurrentUserFollowing: followedUserIds.includes(user.userId),
                allTimeScore: await this.getAllTimeScore(user.userId),
                rank: await this.getAllTimeLeaderboardRank(user.userId)
            } as User)
        }
        const updatedUsers = await Promise.all(map(updateUser, users))

        return {
            users: updatedUsers,
            nextCursor: searchResult.nextCursor
        }
    }

    async updateUserInfo(userInfoParams: UserInfoParams): Promise<UpdateUserInfoPayloadGql> {
        await this.dynamo.updateUserInfo(userInfoParams)
        const result: UpdateUserInfoPayloadGql = {
            id: userInfoParams.userId,
            username: userInfoParams.userId,
            avatar: userInfoParams.avatar
        }
        return result
    }

    async getCurrentUser(userId: string): Promise<CurrentUserPayloadGql> {
        const startTime = this.getYesterdayISOString()
        const {user, events} = await this.dynamo.getUserAndEventsFromStartTime(userId, startTime)
        if (!user) {
            throw new ApolloError("Current user could not be resolved")
        }

        const latestEvent = await this.dynamo.getLatestEventForUser(userId)
        const score24 = this.calculate24HourScore(events, latestEvent)
        await this.dynamo.save24HourScore(userId, score24) //This is unnecessary

        let allTimeScore = 0
        if (latestEvent?.eventType == "HOME") {
            allTimeScore = await this.updateAllTimeScore(userId)
        } else {
            allTimeScore = await this.getAllTimeScore(userId)
        }
        const rank = await this.getAllTimeLeaderboardRank(userId)

        const result: User = mergeRight(user, {
            allTimeScore: allTimeScore,
            score: score24,
            rank: rank,
            geofenceStatus: latestEvent?.eventType
        } as User)

        return {
            user: result
        }
    }

    async getSocialLeaderboardRange(currentUserId: string, start: number, end: number): Promise<LeaderboardRangePayloadGql> {
        const users = await this.getSocialLeaderboard(currentUserId, start, end)
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
        const exists = await this.dynamo.checkUsernameExists(username)
        return {
            exists: exists
        }
    }

    async getLastUpdatedTime(userId: string): Promise<number | undefined> {
        return await this.redis.getLastUpdatedTime(userId)
    }

    private async updateUserList(currentUserId: string, userListDynamo: UserListDynamo): Promise<UsersPayloadGql> {
        const users = this.convertUserDynamosToUsers(userListDynamo.userDynamos)
        const updatedUsers = await this.updateUsers(currentUserId, users)
        return {
            users: updatedUsers,
            nextCursor: userListDynamo.nextCursor
        }
    }

    private async isCurrentUserFollowing(currentUserId: string, userId: string) {
        const followedUserIds = await this.dynamo.getWhichUserIdsAreFollowed(currentUserId, [userId])
        return followedUserIds.includes(userId)
    }

    private async updateAllTimeScore(userId: string): Promise<number> {
        const currentTimeMillis = Date.now()
        const currentAllTimeScore = await this.getAllTimeScore(userId) //This should include last updated time
        const lastUpdatedTime = await this.getLastUpdatedTime(userId) ?? currentTimeMillis
        const extra = (currentTimeMillis - lastUpdatedTime) / 1000 / 10 //Every 10 seconds

        const finalAllTimeScore = currentAllTimeScore + extra
        await this.redis.saveScoreToLeaderboard(userId, finalAllTimeScore)
        await this.redis.saveSocialScore(userId, userId, finalAllTimeScore)
        await this.redis.saveLastUpdatedTime(userId, currentTimeMillis)
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


    private async getAllTimeScore(userId: string): Promise<number> {
        return await this.redis.getAllTimeScore(userId)
    }

    private async getAllTimeLeaderboardRank(userId: string): Promise<number> {
        return await this.redis.getLeaderboardRank(userId) + 1
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

    private async getSocialLeaderboard(currentUserId: string, start: number, end: number): Promise<User[]> {
        //Check for redis sorted set
        const leaderboard = await this.redis.getSocialLeaderboardScoreRange(currentUserId, start, end)
        const users = await this.buildUsersForLeaderboard(currentUserId, leaderboard)
        const isRankValid = (user: User): boolean => user.rank != undefined && user.rank > 0
        return filter(isRankValid, users)
    }

    private async getLeaderboardScoreRange(currentUserId: string, min: number, max: number): Promise<User[]> {
        //Get leaderboard scores from redis
        const leaderboard = await this.redis.getLeaderboardScoreRange(min, max)
        return this.buildUsersForLeaderboard(currentUserId, leaderboard)
    }

    private async buildUsersForLeaderboard(currentUserId: string, leaderboard: LeaderboardScoreRedis[]): Promise<User[]> {
        //If no scores, early return
        if (leaderboard.length == 0) return []

        //Get users for scores
        const leaderboardUserIds = map(item => item.userId, leaderboard)
        const leaderboardUserDynamos = await this.dynamo.batchGetUsers(leaderboardUserIds)
        const users = this.convertUserDynamosToUsers(leaderboardUserDynamos)
        const updatedUsers = await this.updateUsers(currentUserId, users)
        const sortByRank = sortBy(prop('rank'))
        return sortByRank(updatedUsers)
    }

    private async updateSingleUser(currentUserId: string, user: User): Promise<User> {
        return (await this.updateUsers(currentUserId, [user]))[0]
    }

    private async updateUsers(currentUserId: string, users: User[]): Promise<User[]> {
        //Update current user following status
        const userIdsToCheck: string[] = map((user: User) => user.userId, users)
        const followedUserIds = await this.dynamo.getWhichUserIdsAreFollowed(currentUserId, userIdsToCheck)
        const followedMap = this.convertUserIdsToMap(followedUserIds)

        //Update scores and rank
        const getLeaderboardRank = async (user: User): Promise<number> => {
            const rank = await this.redis.getLeaderboardRank(user.userId)
            if (rank > -1) {
                return rank + 1
            } else {
                return rank
            }
        }

        //Build update promises
        const updatedUserPromises = map(async user => mergeRight(user, {
            isCurrentUserFollowing: followedMap.get(user.userId) ?? false,
            allTimeScore: await this.redis.getAllTimeScore(user.userId),
            rank: await getLeaderboardRank(user)
        } as User), users)

        //Resolve promises
        return await Promise.all(updatedUserPromises)
    }

    private convertUserIdsToMap(userIds: string[]) {
        return new Map(userIds.map(userId => [userId, true]));
    }

    private mapUsersToUserIds(users: User[]) {
        return users.map(item => {
            return item.userId
        })
    }

    private convertUserDynamosToUsers(userDynamos: UserDynamo[]): User[] {
        return map((userDynamo: UserDynamo) => this.convertUserDynamoToUser(userDynamo), userDynamos)
    }

    private convertUserDynamoToUser(userDynamo: UserDynamo): User {
        return {
            userId: userDynamo.userId,
            username: userDynamo.username,
            followerCount: userDynamo.followerCount,
            followingCount: userDynamo.followingCount,
            allTimeScore: userDynamo.allTimeScore,
            avatar: userDynamo.avatar
        }
    }
}
