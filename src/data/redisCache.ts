import {Redis as RedisInterface} from "ioredis";

const leaderboardAllTimeKey = "leaderboardAllTime"
const lastUpdatedPartialKey = "LASTUPDATED"

export interface LeaderboardScoreRedis {
    readonly userId: string
    readonly score: number
    readonly rank: number
}

export class RedisCache {
    private redis: RedisInterface

    constructor(redis: RedisInterface) {
        this.redis = redis
    }

    async getAllTimeScore(userId: string): Promise<number> {
        const result = await this.redis.zscore(leaderboardAllTimeKey, this.getLeaderboardKey(userId)) ?? "0"
        return parseInt(result)
    }

    async getLeaderboardRank(userId: string): Promise<number> {
        const rank = await this.redis.zrevrank(leaderboardAllTimeKey, this.getLeaderboardKey(userId)) ?? -1
        return rank
    }

    async getLastUpdatedTime(userId: string): Promise<number | undefined> {
        const lastUpdatedStr = await this.redis.get(this.getLastUpdatedKey(userId)) ?? undefined
        if (lastUpdatedStr) {
            return parseInt(lastUpdatedStr)
        }
        return undefined
    }

    async saveScoreToLeaderboard(userId: string, score: number): Promise<void> {
        await this.redis.zadd(leaderboardAllTimeKey, score.toString(), this.getLeaderboardKey(userId))
    }

    async getLeaderboardScoreRange(min: number, max: number): Promise<LeaderboardScoreRedis[]> {
        //Get scores from redis
        const result = await this.redis.zrevrange(leaderboardAllTimeKey, min, max, 'WITHSCORES')
        return this.convertToLeaderboardScoreRedis(result)
    }

    async saveLastUpdatedTime(userId: string, updatedTime: number) {
        await this.redis.set(this.getLastUpdatedKey(userId), updatedTime.toString())
    }

    async removeScore(userId: string) {
        await this.redis.zrem(leaderboardAllTimeKey, this.getLeaderboardKey(userId))
    }

    async saveSocialScore(currentUserId: string, followedUserId: string, score: number) {
        await this.redis.zadd(this.getSocialScoresKey(currentUserId), score.toString(), this.getLeaderboardKey(followedUserId))
    }

    async getSocialLeaderboardScoreRange(userId: string, min: number, max: number): Promise<LeaderboardScoreRedis[]> {
        //Get scores from redis
        const result = await this.redis.zrevrange(this.getSocialScoresKey(userId), min, max, 'WITHSCORES')
        return this.convertToLeaderboardScoreRedis(result)
    }

    async setSocialLeaderboardExpiration(userId: string, seconds: number) {
        await this.redis.expire(this.getSocialScoresKey(userId), seconds)
    }

    private convertToLeaderboardScoreRedis(items: string[]): LeaderboardScoreRedis[] {
        //Separate user ids and scores
        const userIds = items
            .filter((_, index) => {
                return index % 2 === 0;
            })
            .map((key) => {
                return key.split(":")[1]
            })
        const scores = items
            .filter((_, index) => {
                return index % 2 != 0;
            })

        return userIds.map((userId, index) => {
            return {
                userId: userId,
                score: parseInt(scores[index]),
                rank: index + 1
            }
        })
    }

    private getLastUpdatedKey(userId: string) {
        return `${lastUpdatedPartialKey}:${userId}`
    }

    private getLeaderboardKey(userId: string): string {
        return `USER:${userId}`
    }

    private getLatestEventKey(userId: string): string {
        return `USER:${userId}:latestEvent`
    }

    private getSocialScoresKey(userId: string): string {
        return `USER:${userId}:socialScores`
    }
}