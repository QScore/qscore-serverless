import { resolvers } from '../graphql/types/user'
import sinon, { stubObject } from "ts-sinon";

describe('userResolvers', () => {
    it('should resolve', async() => {
        const context = {
            event: {
                requestContext: {
                    authorizer: {
                        userId: '1234'
                    }
                }
            }
        }
        await resolvers.User.score(null, null, context, null)


    })
})