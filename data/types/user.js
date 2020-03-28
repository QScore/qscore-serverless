export default gql`
type User {
    id: ID!
    username: String!
    score: Float!
}

schema {
    mutation: Mutation
    query: Query
}

type Mutation {
    createUser(input: CreateUserEventInput!): CreateUserEventPayload
}

input CreateUserEventInput {
    username: String!
}

type CreateUserEventPayload {
    user: User
}

type Query {

}
`