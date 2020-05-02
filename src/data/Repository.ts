import {GetUserAndEventsResult, UserInfoParams} from "./mainRepository";
import {Event, SearchResult, User} from './model/types';

export interface Repository {
    createUser(userId: string, username: string, avatar?: string): Promise<User>

    getAllTimeScore(userId: string): Promise<number>

    getAllTimeLeaderboardRank(userId: string): Promise<number>

    getLeaderboardScoreRange(start: number, end: number): Promise<User[]>

    saveAllTimeScore(userId: string, score: number, latestEvent: Event): Promise<void>

    getUser(userId: string): Promise<User | undefined>

    updateUserInfo(userId: UserInfoParams): Promise<void>

    getUserAndEventsFromStartTime(userId: string, startTimestamp: string): Promise<GetUserAndEventsResult>

    searchUsersWithCursor(cursor: string): Promise<SearchResult>

    searchUsers(searchQuery: string, limit: number): Promise<SearchResult>

    followUser(currentUserId: string, userIdToFollow: string)

    unfollowUser(currentUserId: string, userIdToUnfollow: string)

    getFollowedUsers(currentUserId: string): Promise<User[]>

    getFollowers(currentUserId: string): Promise<User[]>

    createEvent(event: Event): Promise<Event>

    getLatestEventForUser(userId: string): Promise<Event | undefined>

    getWhichUsersAreFollowed(currentUserId: string, userIdsToCheck: string[]): Promise<string[]>
}


