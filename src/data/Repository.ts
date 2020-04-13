import { GetUserAndEventsResult } from "./DynamoDbRepository";
import { Event, User } from "./model/Types";

export interface Repository {
    getUser(userId: string): Promise<User | undefined>
    getUserAndEventsFromStartTime(userId: string, startTimestamp: string): Promise<GetUserAndEventsResult>
    createEvent(event: Event): Promise<Event>
    getLatestEventForUser(userId: string): Promise<Event | undefined>
}


