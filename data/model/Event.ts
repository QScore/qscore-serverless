interface Event {
    readonly timestamp: number
    readonly eventType: EventType
}

interface EventFull extends Event {
    id: string,
    timestamp: number,
    eventType: EventType,
    userLocation: {
        latitude: number,
        longitude: number
    },
    userId: string
}

enum EventType {
    HOME = "HOME",
    AWAY = "AWAY"
}