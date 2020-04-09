import { EventType, Event, EventFull } from "./model/Event";
import { Location } from "./model/Location";

export interface Repository {
    updateUsername(userId: string, username: string): Promise<void>
    getCurrentUser(userId: string): Promise<User | undefined>
    updateUserScore(userId: string, score: number): Promise<void>
    getEventsFromStartTime(userId: string, startTimestamp: number) : Promise<Event[]>
    createEvent(userId: string, eventType: EventType, userLocation: Location): Promise<EventFull>
    getLatestEventForUser(userId: string): Promise<EventFull | undefined>
}


