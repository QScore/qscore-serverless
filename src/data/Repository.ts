import { GetUserAndEventsResult } from "./dynamoDbRepository";
import { Event, User, LeaderboardScore } from './model/Types';

export interface Repository {
    getLeaderboardRank(userId: string): Promise<number>
    getLeaderboardScoreRange(min: number, max: number, limit: number): Promise<LeaderboardScore[]>
    getTopLeaderboardScores(limit: number): Promise<LeaderboardScore[]>
    save24HourScore(userId: string, score: number): Promise<void>
    getUser(userId: string): Promise<User | undefined>
    updateUser(user: User): Promise<void>
    getUserAndEventsFromStartTime(userId: string, startTimestamp: string): Promise<GetUserAndEventsResult>
    searchUsers(searchQuery: string): Promise<User[]>
    followUser(currentUserId: string, userIdToFollow: string)
    unfollowUser(currentUserId: string, userIdToUnfollow: string)
    getFollowedUsers(currentUserId: string): Promise<User[]>
    getFollowers(currentUserId: string): Promise<User[]>
    createEvent(event: Event): Promise<Event>
    getLatestEventForUser(userId: string): Promise<Event | undefined>
    getWhichUsersAreFollowed(currentUserId: string, userIdsToCheck: string[]): Promise<string[]>
}


