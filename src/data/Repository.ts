import { GetUserAndEventsResult } from "./DynamoDbRepository";
import { EventV2 } from "./model/Types";

export interface Repository {
    updateUsername(userId: string, username: string): Promise<void>
    getCurrentUser(userId: string): Promise<User | undefined>
    getUserAndEventsFromStartTime(userId: string, startTimestamp: string): Promise<GetUserAndEventsResult>
    createEvent(event: EventV2): Promise<EventV2>
    getLatestEventForUser(userId: string): Promise<EventV2 | undefined>
}


