import { EventType, Event, EventFull } from "./model/Event";
import { Location } from "./model/Location";
import { GetUserAndEventsResult } from "./DynamoDbRepository";

export interface Repository {
    updateUsername(userId: string, username: string): Promise<void>
    getCurrentUser(userId: string): Promise<User | undefined>
    updateUserScore(userId: string, score: number): Promise<void>
    getUserAndEventsFromStartTime(userId: string, startTimestamp: string): Promise<GetUserAndEventsResult>
    createEvent(userId: string, eventType: EventType, userLocation: Location): Promise<EventFull>
    getLatestEventForUser(userId: string): Promise<EventFull | undefined>
}


