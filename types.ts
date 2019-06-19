export interface AuthTokenData {
    kind: string
    accessToken: string
}

export interface User {
    id: number
    email: string
    password: string
    passwordResetToken: string
    passwordResetExpires: Date

    facebook?: string
    twitter?: string
    google?: string
    tokens: AuthTokenData[]

    profile: {
        name: string
        gender: string
        picture: string
    }
}
