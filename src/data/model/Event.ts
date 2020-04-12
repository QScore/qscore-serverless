//TODO: Convert this to type instead of enum
export enum EventType {
    HOME = "HOME",
    AWAY = "AWAY"
}

export interface Event {
    readonly timestamp: number
    readonly eventType: EventType
}

export interface EventFull extends Event {
    id: string,
    timestamp: number,
    eventType: EventType,
    userLocation: {
        latitude: number,
        longitude: number
    },
    userId: string
}