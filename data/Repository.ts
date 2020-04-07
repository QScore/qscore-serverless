interface Repository {
    updateUsername(userId: string, username: string): Promise<void>
    getCurrentuser(userId: string): Promise<User | undefined>
    updateUserScore(userId: string, score: number): Promise<void>
    getEventsFrom(userId: string, startTimestamp: number) : Promise<Event[]>
}

interface User {
    id: String
    username: String
    score: String
}

interface Event {
    readonly timestamp: number
    readonly eventType: "HOME" | "AWAY"
}