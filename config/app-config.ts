require('dotenv').config()
export interface AppConfig {
    port: number
    appSecret: string
    loggerLevel: string
    dbConnectionString: string
    googleAuthConfig: {
        clientID: string
        clientSecret: string
        callbackURL: string
    }
    facebookAuthConfig: {
        clientID: string
        clientSecret: string
        callbackURL: string
        profileFields: string[]
        passReqToCallback: boolean
    }
}

export const appConfig: AppConfig = {
    port: process.env.PORT ? parseInt(process.env.PORT, 10) : 5000,
    appSecret: process.env.APP_SECRET || 'super-secret-key!',
    dbConnectionString: process.env.DB_CONNECTION_STRING || '',
    loggerLevel: 'debug',
    googleAuthConfig: {
        clientID: process.env.GOOGLE_KEY,
        clientSecret: process.env.GOOGLE_SECRET,
        callbackURL: `${process.env.BASE_URL}/auth/google/callback`
    },
    facebookAuthConfig: {
        clientID: process.env.FACEBOOK_ID,
        clientSecret: process.env.FACEBOOK_SECRET,
        callbackURL: `${process.env.BASE_URL}/auth/facebook/callback`,
        profileFields: ['name', 'email', 'gender'],
        passReqToCallback: true
    }
}
