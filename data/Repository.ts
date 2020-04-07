interface Repository {
    updateUsername(userId: string, username: string): Promise<void>
    getCurrentuser(userId: string): Promise<User | undefined>
    updateUserScore(userId: string, score: number): Promise<void>
    getEventsFromStartTime(userId: string, startTimestamp: number) : Promise<Event[]>
    createEvent(userId: string, eventType: EventType, userLocation: Location): Promise<EventFull>
}


