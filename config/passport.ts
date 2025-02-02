import passport from 'passport'
import bcrypt from 'bcrypt'
import { Strategy as LocalStrategy } from 'passport-local'
import { Strategy as FacebookStrategy } from 'passport-facebook'
import { Strategy as TwitterStrategy } from 'passport-twitter'
import { OAuth2Strategy as GoogleStrategy } from 'passport-google-oauth'
import _ from 'lodash'
import { User } from '../types'
import { getDb } from '../db'
import { appConfig } from './app-config'

passport.serializeUser((user: User, done) => {
    done(null, user.id)
})

passport.deserializeUser(async (id, done) => {
    const db = await getDb()
    const user = await db.tables.user.findOne({ id })
    done(null, user)
})

/**
 * Sign in using Email and Password.
 */
passport.use(
    new LocalStrategy({ usernameField: 'email' }, async (email, candidatePassword, done) => {
        try {
            const db = await getDb()
            const user: User = await db.tables.user.findOne({ email: email.toLowerCase() })

            if (!user) {
                return done(null, false, { message: `Email ${email} not found.` })
            }

            const passwordMatches = await bcrypt.compare(user.password, candidatePassword)

            if (!passwordMatches) {
                return done(null, false, { message: 'Invalid email or password.' })
            }

            return done(null, user)
        } catch (error) {
            return done(error, null)
        }
    })
)

/**
 * OAuth Strategy Overview
 *
 * - User is already logged in.
 *   - Check if there is an existing account with a provider id.
 *     - If there is, return an error message. (Account merging not supported)
 *     - Else link new OAuth account with currently logged-in user.
 * - User is not logged in.
 *   - Check if it's a returning user.
 *     - If returning user, sign in and we are done.
 *     - Else check if there is an existing account with user's email.
 *       - If there is, return an error message.
 *       - Else create a new account.
 */

/**
 * Sign in with Facebook.
 */
passport.use(
    new FacebookStrategy(
        appConfig.facebookAuthConfig,
        async (req, accessToken, refreshToken, profile, done) => {
            if (req.user) {
                User.findOne({ facebook: profile.id }, (err, existingUser) => {
                    if (err) {
                        return done(err)
                    }
                    if (existingUser) {
                        req.flash('errors', {
                            msg:
                                'There is already a Facebook account that belongs to you. Sign in with that account or delete it, then link it with your current account.'
                        })
                        done(err)
                    } else {
                        User.findById(req.user.id, (err, user) => {
                            if (err) {
                                return done(err)
                            }
                            user.facebook = profile.id
                            user.tokens.push({ kind: 'facebook', accessToken })
                            user.profile.name =
                                user.profile.name ||
                                `${profile.name.givenName} ${profile.name.familyName}`
                            user.profile.gender = user.profile.gender || profile._json.gender
                            user.profile.picture =
                                user.profile.picture ||
                                `https://graph.facebook.com/${profile.id}/picture?type=large`
                            user.save((err) => {
                                req.flash('info', { msg: 'Facebook account has been linked.' })
                                done(err, user)
                            })
                        })
                    }
                })
            } else {
                User.findOne({ facebook: profile.id }, (err, existingUser) => {
                    if (err) {
                        return done(err)
                    }
                    if (existingUser) {
                        return done(null, existingUser)
                    }
                    User.findOne({ email: profile._json.email }, (err, existingEmailUser) => {
                        if (err) {
                            return done(err)
                        }
                        if (existingEmailUser) {
                            req.flash('errors', {
                                msg:
                                    'There is already an account using this email address. Sign in to that account and link it with Facebook manually from Account Settings.'
                            })
                            done(err)
                        } else {
                            const user = new User()
                            user.email = profile._json.email
                            user.facebook = profile.id
                            user.tokens.push({ kind: 'facebook', accessToken })
                            user.profile.name = `${profile.name.givenName} ${
                                profile.name.familyName
                            }`
                            user.profile.gender = profile._json.gender
                            user.profile.picture = `https://graph.facebook.com/${
                                profile.id
                            }/picture?type=large`
                            user.profile.location = profile._json.location
                                ? profile._json.location.name
                                : ''
                            user.save((err) => {
                                done(err, user)
                            })
                        }
                    })
                })
            }
        }
    )
)

/**
 * Sign in with Twitter.
 */
passport.use(
    new TwitterStrategy(
        {
            consumerKey: process.env.TWITTER_KEY,
            consumerSecret: process.env.TWITTER_SECRET,
            callbackURL: `${process.env.BASE_URL}/auth/twitter/callback`,
            passReqToCallback: true
        },
        (req, accessToken, tokenSecret, profile, done) => {
            if (req.user) {
                User.findOne({ twitter: profile.id }, (err, existingUser) => {
                    if (err) {
                        return done(err)
                    }
                    if (existingUser) {
                        req.flash('errors', {
                            msg:
                                'There is already a Twitter account that belongs to you. Sign in with that account or delete it, then link it with your current account.'
                        })
                        done(err)
                    } else {
                        User.findById(req.user.id, (err, user) => {
                            if (err) {
                                return done(err)
                            }
                            user.twitter = profile.id
                            user.tokens.push({ kind: 'twitter', accessToken, tokenSecret })
                            user.profile.name = user.profile.name || profile.displayName
                            user.profile.location = user.profile.location || profile._json.location
                            user.profile.picture =
                                user.profile.picture || profile._json.profile_image_url_https
                            user.save((err) => {
                                if (err) {
                                    return done(err)
                                }
                                req.flash('info', { msg: 'Twitter account has been linked.' })
                                done(err, user)
                            })
                        })
                    }
                })
            } else {
                User.findOne({ twitter: profile.id }, (err, existingUser) => {
                    if (err) {
                        return done(err)
                    }
                    if (existingUser) {
                        return done(null, existingUser)
                    }
                    const user = new User()
                    // Twitter will not provide an email address.  Period.
                    // But a person’s twitter username is guaranteed to be unique
                    // so we can "fake" a twitter email address as follows:
                    user.email = `${profile.username}@twitter.com`
                    user.twitter = profile.id
                    user.tokens.push({ kind: 'twitter', accessToken, tokenSecret })
                    user.profile.name = profile.displayName
                    user.profile.location = profile._json.location
                    user.profile.picture = profile._json.profile_image_url_https
                    user.save((err) => {
                        done(err, user)
                    })
                })
            }
        }
    )
)

/**
 * Sign in with Google.
 */
passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_ID,
            clientSecret: process.env.GOOGLE_SECRET,
            callbackURL: '/auth/google/callback',
            passReqToCallback: true
        },
        (req, accessToken, refreshToken, profile, done) => {
            if (req.user) {
                User.findOne({ google: profile.id }, (err, existingUser) => {
                    if (err) {
                        return done(err)
                    }
                    if (existingUser) {
                        req.flash('errors', {
                            msg:
                                'There is already a Google account that belongs to you. Sign in with that account or delete it, then link it with your current account.'
                        })
                        done(err)
                    } else {
                        User.findById(req.user.id, (err, user) => {
                            if (err) {
                                return done(err)
                            }
                            user.google = profile.id
                            user.tokens.push({ kind: 'google', accessToken })
                            user.profile.name = user.profile.name || profile.displayName
                            user.profile.gender = user.profile.gender || profile._json.gender
                            user.profile.picture = user.profile.picture || profile._json.picture
                            user.save((err) => {
                                req.flash('info', { msg: 'Google account has been linked.' })
                                done(err, user)
                            })
                        })
                    }
                })
            } else {
                User.findOne({ google: profile.id }, (err, existingUser) => {
                    if (err) {
                        return done(err)
                    }
                    if (existingUser) {
                        return done(null, existingUser)
                    }
                    User.findOne({ email: profile.emails[0].value }, (err, existingEmailUser) => {
                        if (err) {
                            return done(err)
                        }
                        if (existingEmailUser) {
                            req.flash('errors', {
                                msg:
                                    'There is already an account using this email address. Sign in to that account and link it with Google manually from Account Settings.'
                            })
                            done(err)
                        } else {
                            const user = new User()
                            user.email = profile.emails[0].value
                            user.google = profile.id
                            user.tokens.push({ kind: 'google', accessToken })
                            user.profile.name = profile.displayName
                            user.profile.gender = profile._json.gender
                            user.profile.picture = profile._json.picture
                            user.save((err) => {
                                done(err, user)
                            })
                        }
                    })
                })
            }
        }
    )
)

/**
 * Login Required middleware.
 */
exports.isAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next()
    }
    res.redirect('/login')
}

/**
 * Authorization Required middleware.
 */
exports.isAuthorized = (req, res, next) => {
    const provider = req.path.split('/').slice(-1)[0]
    const token = req.user.tokens.find((token) => token.kind === provider)
    if (token) {
        next()
    } else {
        res.redirect(`/auth/${provider}`)
    }
}
