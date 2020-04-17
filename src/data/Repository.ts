import { GetUserAndEventsResult } from "./DynamoDbRepository";
import { Event, User } from "./model/Types";

export interface Repository {
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
}


