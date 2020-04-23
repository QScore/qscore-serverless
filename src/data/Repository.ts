import { GetUserAndEventsResult } from "./mainRepository";
import { Event, User, LeaderboardScore } from './model/Types';

export interface Repository {
    getAllTimeScore(userId: string): Promise<number>
    getAllTimeLeaderboardRank(userId: string): Promise<number>
    getLeaderboardScoreRange(start: number, end: number): Promise<LeaderboardScore[]>
    saveAllTimeScore(userId: string, score: number): Promise<void>
    getUser(userId: string): Promise<User | undefined>
    updateUsername(userId: string, username: string): Promise<void>
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


